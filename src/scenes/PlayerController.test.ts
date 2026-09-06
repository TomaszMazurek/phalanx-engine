import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BINDINGS } from '../core/Bindings';
import { GameLoop } from '../core/GameLoop';
import { InputSystem } from '../core/InputSystem';
import { PlayerController } from './PlayerController';

/**
 * PlayerController tests drive a faithful mini-frame in the node
 * environment: substeps first, then the consumer's update(), then
 * InputSystem.update() (which clears edges — InputSystem is registered
 * LAST in the real Engine). KeyboardEvent/Window/navigator are absent in
 * node, so the harness stubs them: a FakeKeyboardEvent subclass makes
 * `instanceof KeyboardEvent` pass inside InputSystem's handlers, and one
 * EventTarget plays both the DOM target and `window`.
 */

/** Node has no KeyboardEvent; InputSystem type-checks with instanceof. */
class FakeKeyboardEvent extends Event {
  readonly code: string;
  readonly repeat: boolean;

  constructor(type: 'keydown' | 'keyup', init: { code: string; repeat?: boolean }) {
    super(type);
    this.code = init.code;
    this.repeat = init.repeat ?? false;
  }
}

/** Exact-math physics profile: dt = 1/60, jump 2, gravity 240. */
const DT = GameLoop.FIXED_DT;
const JUMP = 2; // units/s — one step up: 2/60 = 1/30
const GRAVITY = 240; // units/s^2 — vy after step 1: 2 - 240/60 = -2 → lands exactly on step 2

function createHarness(): {
  input: InputSystem;
  keyDown: (code: string) => void;
  keyUp: (code: string) => void;
} {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent);
  vi.stubGlobal('navigator', { getGamepads: (): Iterable<null> => [] });
  const input = new InputSystem(DEFAULT_BINDINGS, target);
  input.start();
  return {
    input,
    keyDown: (code) => target.dispatchEvent(new FakeKeyboardEvent('keydown', { code })),
    keyUp: (code) => target.dispatchEvent(new FakeKeyboardEvent('keyup', { code })),
  };
}

describe('PlayerController', () => {
  let harness: ReturnType<typeof createHarness>;
  let controller: PlayerController;

  /** Controller under test with exact-math options and no auto-jump. */
  function makePlayer(speed = 0): PlayerController {
    return new PlayerController(harness.input, { speed, jumpSpeed: JUMP, gravity: GRAVITY });
  }

  /**
   * One rendered frame, GameLoop order: N substeps → consumer update() →
   * InputSystem update() (edge clear + gamepad poll — the "registered last"
   * contract). Keyboard input is injected between frames, like real DOM
   * events arriving between ticks.
   */
  function frame(substeps = 1, alpha = 0): void {
    for (let i = 0; i < substeps; i++) {
      controller.fixedUpdate(DT);
    }
    controller.update(DT, alpha);
    harness.input.update(DT, alpha);
  }

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.input.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('moves along the ground plane at exact fixed-step arithmetic', () => {
    controller = makePlayer(2); // 2 units/s
    harness.keyDown('KeyD'); // moveX +1

    for (let i = 0; i < 60; i++) controller.fixedUpdate(DT); // 1 simulated second

    expect(controller.position.x.value).toBeCloseTo(2, 10); // 60 * 2 * 1/60
    expect(controller.position.y.value).toBe(0);
    expect(controller.position.z.value).toBe(0);
  });

  it('normalizes diagonal input to unit length', () => {
    controller = makePlayer(2);
    harness.keyDown('KeyW'); // moveY +1
    harness.keyDown('KeyD'); // moveX +1

    for (let i = 0; i < 60; i++) controller.fixedUpdate(DT);

    // (1,1)/√2 * 2 * 1 s = √2 per axis — not the √2-times-faster diagonal
    // an unnormalized (1,1) * speed would produce.
    expect(controller.position.x.value).toBeCloseTo(Math.sqrt(2), 10);
    expect(controller.position.z.value).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('does not read raw key edges in fixedUpdate — jump goes through the update-phase buffer', () => {
    controller = makePlayer();
    harness.keyDown('Space'); // pressed edge recorded…

    controller.fixedUpdate(DT); // …but a raw edge read here would jump already

    expect(controller.position.y.value).toBe(0); // stayed grounded
  });

  it('buffers the jump edge in update() and consumes it in the first fixed step of the NEXT frame', () => {
    controller = makePlayer();
    harness.keyDown('Space');

    frame(); // substeps ran before the buffer existed — real GameLoop order
    expect(controller.position.y.value).toBe(0);

    frame(); // substep consumes the buffer: vy = 2, y = 1/30
    expect(controller.position.y.value).toBeCloseTo(JUMP * DT, 10);

    frame(); // no re-consumption: vy = -2 → lands exactly at 0
    expect(controller.position.y.value).toBe(0);
  });

  it('hop trajectory lands exactly at y=0 and stays grounded', () => {
    controller = makePlayer();
    harness.keyDown('Space');

    frame(); // buffer only
    frame(); // consume: y = 1/30, vy: 2 → -2
    frame(); // y = 0, vy clamped to 0
    expect(controller.position.y.value).toBe(0);

    for (let i = 0; i < 10; i++) frame(); // grounded — no drift, no re-jump
    expect(controller.position.y.value).toBe(0);
    expect(controller.position.x.value).toBe(0); // no horizontal input
  });

  it('consumes airborne jump requests and drops them (no double jump), then jumps again once grounded', () => {
    controller = new PlayerController(harness.input, { jumpSpeed: 4, gravity: 120 }); // 6-step hop
    harness.keyDown('Space');
    frame(); // buffer
    frame(); // consume: vy = 4, y = 4/60
    frame(); // vy = 2, y = 6/60

    // Re-press = release first: InputSystem ignores a keydown for an already
    // held key (browser auto-repeat contract), so a held Space must be lifted.
    harness.keyUp('Space');
    harness.keyDown('Space'); // user taps jump mid-air (y = 6/60)
    frame(); // substep: vy = 0, y = 6/60 ; update buffers ; edges cleared
    frame(); // substep: flag consumed while airborne → DROPPED ; vy stays -2 → y = 6/60 - 2/60 = 4/60
    expect(controller.position.y.value).toBeCloseTo(4 * DT, 10); // a vy reset to 4 would give 10/60

    frame(); // vy = -4 → y = 4/60 - 4/60 = 0, clamped
    frame(); // stays grounded (y = 0, vy = 0)
    expect(controller.position.y.value).toBe(0);

    harness.keyUp('Space');
    harness.keyDown('Space'); // fresh tap, grounded now
    frame(); // buffer
    frame(); // consume → hop again
    expect(controller.position.y.value).toBeCloseTo(4 * DT, 10);
  });

  it('interpolates between the last two fixed states (alpha 0 / 0.5 / 1)', () => {
    controller = makePlayer(6); // 6 units/s → one step advances x by 0.1
    harness.keyDown('KeyD');

    controller.fixedUpdate(DT); // x: 0 → 0.1

    expect(controller.interpolatedPosition(0).x).toBe(0);
    expect(controller.interpolatedPosition(0.5).x).toBeCloseTo(0.05, 10);
    expect(controller.interpolatedPosition(1).x).toBeCloseTo(0.1, 10);

    controller.update(DT, 0.5); // frame phase caches the interpolated read
    expect(controller.lastRenderedPosition.x).toBeCloseTo(0.05, 10);
  });

  it('reads the seed position before any fixed step', () => {
    controller = makePlayer(2);

    expect(controller.interpolatedPosition(0.7)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('releasing the key stops the movement on the next step', () => {
    controller = makePlayer(2);
    harness.keyDown('KeyD');
    controller.fixedUpdate(DT);
    harness.keyUp('KeyD');
    controller.fixedUpdate(DT);

    const xAfterRelease = controller.position.x.value; // moved one step, then held still
    controller.fixedUpdate(DT);
    expect(controller.position.x.value).toBeCloseTo(xAfterRelease, 10);
  });
});
