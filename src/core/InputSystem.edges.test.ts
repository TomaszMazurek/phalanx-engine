import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BINDINGS } from './Bindings';
import type { BindingsConfig } from './Bindings';
import { InputSystem } from './InputSystem';

/**
 * Edge-semantics tests for InputSystem (Phase 3, wave 0.2 nit fixes N5-N7):
 * blur/disconnect released edges, contextmenu suppression, deadzone
 * rescaling. Node has no DOM event classes, so the harness stubs them the
 * same way as src/scenes/PlayerController.test.ts: fake subclasses make the
 * `instanceof` checks inside InputSystem's handlers pass, and one
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

/**
 * Node has no MouseEvent. cancelable:true so a prevented contextmenu
 * actually reports `defaultPrevented` — that is what these tests assert.
 */
class FakeMouseEvent extends Event {
  readonly button: number;

  constructor(type: 'mousedown' | 'mouseup' | 'contextmenu', init: { button: number }) {
    super(type, { cancelable: true });
    this.button = init.button;
  }
}

/** Node has no GamepadEvent; InputSystem type-checks with instanceof. */
class FakeGamepadEvent extends Event {
  readonly gamepad: Gamepad;

  constructor(
    type: 'gamepadconnected' | 'gamepaddisconnected',
    init: { gamepad: Gamepad },
  ) {
    super(type);
    this.gamepad = init.gamepad;
  }
}

/** Minimal Gamepad: only the fields pollGamepads() reads. */
function makeGamepad(axes: number[], pressedButtons: number[] = []): Gamepad {
  return {
    id: 'fake-pad',
    axes,
    buttons: [0, 1, 2, 3].map((index) => ({ pressed: pressedButtons.includes(index) })),
  } as unknown as Gamepad;
}

function createHarness(bindings: BindingsConfig = DEFAULT_BINDINGS): {
  input: InputSystem;
  target: EventTarget;
  keyDown: (code: string) => void;
  setGamepad: (pad: Gamepad | null) => void;
} {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('KeyboardEvent', FakeKeyboardEvent);
  vi.stubGlobal('MouseEvent', FakeMouseEvent);
  vi.stubGlobal('GamepadEvent', FakeGamepadEvent);
  vi.stubGlobal('navigator', { getGamepads: (): Iterable<Gamepad | null> => [] });
  const input = new InputSystem(bindings, target);
  input.start();
  return {
    input,
    target,
    keyDown: (code) => target.dispatchEvent(new FakeKeyboardEvent('keydown', { code })),
    setGamepad: (pad) =>
      vi.stubGlobal('navigator', { getGamepads: (): Iterable<Gamepad | null> => [pad] }),
  };
}

describe('InputSystem edges (N5): blur and gamepad disconnect record released edges', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.input.stop();
    vi.unstubAllGlobals();
  });

  it('emits a released edge for a keyboard-held action on blur', () => {
    harness.keyDown('Space'); // jump held
    expect(harness.input.isDown('jump')).toBe(true);

    harness.target.dispatchEvent(new Event('blur')); // alt-tab mid-press

    expect(harness.input.isDown('jump')).toBe(false);
    expect(harness.input.wasReleasedThisFrame('jump')).toBe(true);
  });

  it('emits a released edge for a mouse-held action on blur', () => {
    harness.target.dispatchEvent(new FakeMouseEvent('mousedown', { button: 0 })); // primary held

    harness.target.dispatchEvent(new Event('blur'));

    expect(harness.input.isDown('primary')).toBe(false);
    expect(harness.input.wasReleasedThisFrame('primary')).toBe(true);
  });

  it('records no released edges on blur when nothing is held', () => {
    harness.target.dispatchEvent(new Event('blur'));

    expect(harness.input.wasReleasedThisFrame('jump')).toBe(false);
  });

  it('clears the blur-released edge on the next update (one-frame edge contract)', () => {
    harness.keyDown('Space');
    harness.target.dispatchEvent(new Event('blur'));

    harness.input.update(0, 0); // registered-last clear

    expect(harness.input.wasReleasedThisFrame('jump')).toBe(false);
  });

  it('emits a released edge for a pad-held action on gamepad disconnect', () => {
    harness.setGamepad(makeGamepad([], [0])); // pad button 0 → jump/confirm
    harness.input.update(0, 0); // frame poll: button 0 becomes held
    expect(harness.input.isDown('jump')).toBe(true);

    harness.target.dispatchEvent(
      new FakeGamepadEvent('gamepaddisconnected', { gamepad: makeGamepad([], [0]) }),
    );

    expect(harness.input.isDown('jump')).toBe(false);
    expect(harness.input.wasReleasedThisFrame('jump')).toBe(true);
  });
});

describe('InputSystem edges (N6): contextmenu suppression is opt-in per binding', () => {
  /** button 2 opts in, button 0 is bound WITHOUT preventDefault (control case). */
  const AIM_BINDINGS: BindingsConfig = {
    actions: {
      aim: [{ kind: 'mouse', button: 2, preventDefault: true }],
      primary: [{ kind: 'mouse', button: 0 }],
    },
    axes: {},
  };

  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness(AIM_BINDINGS);
  });

  afterEach(() => {
    harness.input.stop();
    vi.unstubAllGlobals();
  });

  it('prevents contextmenu for a bound+preventDefault button, not for others', () => {
    const rightButton = new FakeMouseEvent('contextmenu', { button: 2 });
    harness.target.dispatchEvent(rightButton);
    expect(rightButton.defaultPrevented).toBe(true);

    const otherButton = new FakeMouseEvent('contextmenu', { button: 0 }); // bound, no opt-in
    harness.target.dispatchEvent(otherButton);
    expect(otherButton.defaultPrevented).toBe(false);
  });

  it('stops suppressing contextmenu after stop() removes the listener', () => {
    harness.input.stop();

    const rightButton = new FakeMouseEvent('contextmenu', { button: 2 });
    harness.target.dispatchEvent(rightButton);
    expect(rightButton.defaultPrevented).toBe(false);
  });
});

describe('InputSystem edges (N7): deadzone rescales [dz,1] onto [0,1], sign preserved', () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.input.stop();
    vi.unstubAllGlobals();
  });

  /** moveX = gamepad axis 0, direction +1 (DEFAULT_BINDINGS) — raw maps 1:1. */
  it.each<[number, number]>([
    [0.1, 0], // below deadzone
    [0.1499, 0], // just below deadzone
    [0.15, 0], // exactly at the deadzone
    [0.32, 0.2], // (0.32-0.15)/0.85
    [0.575, 0.5], // midpoint rescale
    [1, 1], // full deflection
    [-0.1, 0],
    [-0.1499, 0],
    [-0.15, 0],
    [-0.32, -0.2],
    [-0.575, -0.5],
    [-1, -1],
  ])('moveX with stick at %s reads %s', (raw, expected) => {
    harness.setGamepad(makeGamepad([raw]));
    harness.input.update(0, 0); // frame poll picks up padAxes

    expect(harness.input.getAxis('moveX')).toBeCloseTo(expected, 10);
  });

  it('still clamps the rescaled stick on top of digital input', () => {
    harness.setGamepad(makeGamepad([0.575])); // → +0.5 analog
    harness.keyDown('KeyD'); // moveX positive: +1 digital
    harness.input.update(0, 0);

    expect(harness.input.getAxis('moveX')).toBe(1); // clamped, not 1.5
  });
});
