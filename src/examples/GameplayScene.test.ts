import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { DEFAULT_BINDINGS } from '../core/Bindings';
import { EventBus } from '../core/EventBus';
import { GameLoop } from '../core/GameLoop';
import { InputSystem } from '../core/InputSystem';
import { PlayerController } from '../scenes/PlayerController';
import type { GameEvents } from './GameEvents';
import type { LoadedModel, ModelLoader, RenderOutputTarget } from './GameplayScene';
import { GameplayScene, MODEL_URI } from './GameplayScene';

/**
 * GameplayScene tests pin the PRELOAD CONTRACT (docs/phase-2-core.md,
 * wave D, task 6): the glTF model goes through the AssetManager — factory
 * called exactly once per URI, progress in [0,1] reaching 1, cache hit on
 * the second visit (plan trap #5) — plus the system registration order the
 * PlayerController/InputSystem edge contract requires.
 *
 * Headless by design: the injected loader is deferred, the render target is
 * a structural fake, InputSystem never starts unless a keyboard harness
 * stubs window/KeyboardEvent/navigator (the PlayerController.test.ts
 * pattern — node has none of them). enter() DOES run in the render-output
 * test: it constructs three objects, which are plain JS and node-safe; only
 * the WebGL renderer itself (RenderSystem: clearRenderOutput, the
 * onResize/unsubscribe registry, the resize listener calling handlers) is
 * NOT unit-testable — its constructor needs a real canvas + WebGL context.
 * That part is manual acceptance (see docs/phase-2-core.md retro item 1).
 */

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * Did `promise` settle yet? `Promise.race` against an already-fulfilled
 * sentinel: it wins only while `promise` is genuinely pending.
 */
async function settlement(promise: Promise<unknown>): Promise<'settled' | 'pending'> {
  return await Promise.race([promise.then(() => 'settled' as const), 'pending' as const]);
}

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

/** Fake model node: records position writes, satisfies ModelNode structurally. */
class FakeModelNode {
  readonly positions: Array<[number, number, number]> = [];
  readonly position = {
    set: (x: number, y: number, z: number): void => {
      this.positions.push([x, y, z]);
    },
  };
}

/**
 * Fake render target: records setRenderOutput calls and clearRenderOutput
 * counts, and keeps LIVE resize subscriptions — onResize returns a real
 * unsubscribe mirroring RenderSystem's, so enter/exit wiring is observable
 * (who subscribed, when it stopped firing).
 */
function createFakeRender(): {
  target: RenderOutputTarget;
  outputs: Array<{ scene: THREE.Scene; camera: THREE.Camera }>;
  clearCount: () => number;
  handlerCount: () => number;
  fireResize: () => void;
} {
  const outputs: Array<{ scene: THREE.Scene; camera: THREE.Camera }> = [];
  const handlers: Array<() => void> = [];
  let clears = 0;
  const target: RenderOutputTarget = {
    setRenderOutput: (scene, camera) => {
      outputs.push({ scene, camera });
    },
    clearRenderOutput: () => {
      clears += 1;
    },
    onResize: (handler) => {
      handlers.push(handler);
      return () => {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      };
    },
  };
  return {
    target,
    outputs,
    clearCount: () => clears,
    handlerCount: () => handlers.length,
    fireResize: () => {
      for (const handler of [...handlers]) {
        handler();
      }
    },
  };
}

/** Deferred fake loader recording URIs and emitted per-asset progress. */
function createFakeLoader(): {
  loader: (uri: string, onProgress?: (ratio: number) => void) => Promise<LoadedModel>;
  uris: string[];
  progressEmitted: number[];
  resolveNext: (model: LoadedModel) => void;
} {
  const uris: string[] = [];
  const progressEmitted: number[] = [];
  let gate: ReturnType<typeof deferred<LoadedModel>> | null = null;
  return {
    loader: (uri, onProgress) => {
      uris.push(uri);
      gate = deferred<LoadedModel>();
      if (onProgress) {
        onProgress(0.5);
        progressEmitted.push(0.5);
      }
      return gate.promise;
    },
    uris,
    progressEmitted,
    resolveNext: (model) => {
      gate?.resolve(model);
    },
  };
}

function makeDeps(
  assets: AssetManager,
  loadModel: ModelLoader,
  render: RenderOutputTarget = createFakeRender().target,
) {
  const input = new InputSystem(DEFAULT_BINDINGS, new EventTarget());
  const events = new EventBus<GameEvents>();
  return { deps: { render, assets, input, events, loadModel }, input, events };
}

describe('GameplayScene — preload contract', () => {
  it('loads the demo model through AssetManager exactly once, with [0,1] progress reaching 1', async () => {
    const fake = createFakeLoader();
    const assets = new AssetManager();
    const { deps } = makeDeps(assets, fake.loader);
    const scene = new GameplayScene(deps);

    const progress: number[] = [];
    const preload = scene.preload((ratio) => progress.push(ratio));

    // (a) exactly one factory call, with the canonical URI
    expect(fake.uris).toEqual([MODEL_URI]);
    expect(fake.uris).toEqual(['models/demo-cube.gltf']);

    // (e) guard: preload does not settle before the factory resolves
    expect(await settlement(preload)).toBe('pending');

    fake.resolveNext({ scene: new FakeModelNode() });
    await preload;

    // (b) aggregated progress stayed in [0,1] and reached 1
    expect(progress.length).toBeGreaterThan(0);
    for (const ratio of progress) {
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('second scene preloading the same URI hits the cache — loader NOT re-invoked', async () => {
    const fake = createFakeLoader();
    const assets = new AssetManager();
    const first = new GameplayScene(makeDeps(assets, fake.loader).deps);
    const firstPreload = first.preload(() => {});
    fake.resolveNext({ scene: new FakeModelNode() });
    await firstPreload;
    expect(fake.uris).toHaveLength(1);

    const second = new GameplayScene(makeDeps(assets, fake.loader).deps);
    const progress: number[] = [];
    await second.preload((ratio) => progress.push(ratio));

    expect(fake.uris).toHaveLength(1); // cache hit — no network-shaped call
    expect(progress[progress.length - 1]).toBe(1); // still reports completion
  });
});

describe('GameplayScene — systems', () => {
  it('createSystems order: player (PlayerController) → mesh-sync → hud', async () => {
    const fake = createFakeLoader();
    const assets = new AssetManager();
    const scene = new GameplayScene(makeDeps(assets, fake.loader).deps);
    const preload = scene.preload(() => {});
    fake.resolveNext({ scene: new FakeModelNode() });
    await preload;

    const systems = scene.createSystems();

    expect(systems[0]).toBeInstanceOf(PlayerController);
    expect(systems.map((s) => s.name)).toEqual(['player', 'mesh-sync', 'hud']);
  });
});

describe('GameplayScene — mesh-sync interpolation branches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Keyboard harness in node: one EventTarget plays the DOM target and window. */
  function createKeyboardHarness(): {
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

  /**
   * Interp-ON must copy the frame's interpolated read (mid-step lerp);
   * interp-OFF must copy the RAW latest fixed-step value — Interpolated's
   * `.value`, not read(1): read(alpha)'s domain is [0,1), so the old
   * read(1) shortcut was off-contract and allocated a throwaway
   * PlayerPosition per frame (phase-2 retro nit).
   */
  it('ON copies the interpolated midpoint; OFF copies the raw fixed-step value', async () => {
    const harness = createKeyboardHarness();
    const node = new FakeModelNode();
    const fakeLoader = createFakeLoader();
    const assets = new AssetManager();
    const { deps } = makeDeps(assets, fakeLoader.loader);
    const scene = new GameplayScene({ ...deps, input: harness.input });
    const preload = scene.preload(() => {});
    fakeLoader.resolveNext({ scene: node });
    await preload;

    const systems = scene.createSystems();
    const maybePlayer = systems[0]; // order pinned by the test above
    if (!(maybePlayer instanceof PlayerController)) {
      throw new Error('GameplayScene.createSystems[0] must be the PlayerController');
    }
    const player = maybePlayer;
    const meshSync = systems[1];
    const dt = GameLoop.FIXED_DT;
    const alpha = 0.5;
    const step = 4 * dt; // default speed 4, one fixed step of +X (KeyD)

    // Frame 1: one fixed step (+X), then the frame phase at alpha 0.5.
    harness.keyDown('KeyD');
    player.fixedUpdate?.(dt);
    player.update(dt, alpha); // caches the lerped read
    meshSync.update?.(dt, alpha); // interp ON (default) → copies the lerp
    harness.input.update(dt, alpha); // edge clear — input runs LAST

    expect(node.positions.at(-1)).toEqual([step / 2, 0, 0]); // lerped midpoint

    // Toggle OFF (KeyI edge) — no new fixed step, only the branch changes.
    harness.keyDown('KeyI');
    meshSync.update?.(dt, alpha);
    harness.input.update(dt, alpha);

    expect(node.positions.at(-1)).toEqual([
      player.position.x.value,
      player.position.y.value,
      player.position.z.value,
    ]); // the raw latest fixed-step state, exactly
    expect(player.position.x.value).toBeCloseTo(step, 10);
    expect(node.positions).toHaveLength(2); // one write per frame, no extras
  });
});

describe('GameplayScene — render output lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * enter() runs here against a stubbed window (viewport dims) and a real
   * THREE.Object3D model; exit() must then unsubscribe the camera's resize
   * handler AND clear the render output — the frozen-last-frame-behind-the-
   * menu bug (phase-2 retro nit) and the listener leak in one contract.
   */
  it('enter() subscribes camera aspect to render.onResize; exit() unsubscribes and clears the output', async () => {
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });
    const render = createFakeRender();
    const fakeLoader = createFakeLoader();
    const assets = new AssetManager();
    const scene = new GameplayScene(makeDeps(assets, fakeLoader.loader, render.target).deps);
    const preload = scene.preload(() => {});
    fakeLoader.resolveNext({ scene: new THREE.Object3D() });
    await preload;

    scene.enter();

    // Output pointed at a real scene through a PerspectiveCamera whose
    // aspect matches the stubbed viewport…
    expect(render.outputs).toHaveLength(1);
    const output = render.outputs[0];
    expect(output.scene).toBeInstanceOf(THREE.Scene);
    if (!(output.camera instanceof THREE.PerspectiveCamera)) {
      throw new Error('GameplayScene must render through a PerspectiveCamera');
    }
    const camera = output.camera;
    expect(camera.aspect).toBeCloseTo(800 / 600, 10);

    // …and the projection subscribed to resizes (CameraRig's pattern).
    expect(render.handlerCount()).toBe(1);
    const rebuild = vi.spyOn(camera, 'updateProjectionMatrix');
    vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 600 });
    render.fireResize();
    expect(camera.aspect).toBe(2);
    expect(rebuild).toHaveBeenCalledTimes(1);

    // exit(): unsubscribe + clear — no frozen frame behind the menu, no
    // stale handler firing after the scene is gone.
    scene.exit();
    expect(render.clearCount()).toBe(1);
    expect(render.handlerCount()).toBe(0);
    render.fireResize();
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(camera.aspect).toBe(2);
  });
});

/**
 * Minimal DOM stub for the HUD seam (node env has no document — the vitest
 * default): HudSystem.init() mounts a root div on document.body and hands it
 * to DebugHUD, whose constructor appends the display element and whose
 * update() mirrors its text into that element's textContent. Stubbing the
 * two entry points (createElement, body.appendChild) makes the HUD readout —
 * including the steps count — observable headlessly.
 */
class FakeHudElement {
  style: { cssText: string } = { cssText: '' };
  textContent = '';
  readonly children: FakeHudElement[] = [];

  appendChild(child: FakeHudElement): FakeHudElement {
    this.children.push(child);
    return child;
  }

  remove(): void {
    // HudSystem.dispose() unmounts the root; nothing to reclaim in the stub.
  }
}

function stubDocumentForHud(): { hudText: () => string } {
  const body = new FakeHudElement();
  vi.stubGlobal('document', {
    createElement: () => new FakeHudElement(),
    body,
  });
  return {
    // body → HudSystem's root div → DebugHUD's display div.
    hudText: (): string => body.children[0]?.children[0]?.textContent ?? '',
  };
}

describe('GameplayScene — HUD steps/frame counting', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * HudSystem is module-private with private counters, so the observable
   * seam is the DebugHUD DOM mirror its init() mounts (DebugHUD.update
   * writes this.text — which embeds the steps count — into textContent).
   * The mini-loop drives the system exactly like the engine does: zero or
   * more fixedUpdate(FIXED_DT), then ONE update(dt, alpha) per frame.
   */
  it('feeds the per-frame fixed-step count to the HUD and resets it between frames', async () => {
    const { hudText } = stubDocumentForHud();
    const fakeLoader = createFakeLoader();
    const assets = new AssetManager();
    const scene = new GameplayScene(makeDeps(assets, fakeLoader.loader).deps);
    const preload = scene.preload(() => {});
    fakeLoader.resolveNext({ scene: new FakeModelNode() });
    await preload;

    const hud = scene.createSystems().find((system) => system.name === 'hud');
    if (!hud) {
      throw new Error('GameplayScene.createSystems must register a hud system');
    }
    hud.init?.();

    const dt = GameLoop.FIXED_DT;
    const frame = (steps: number, alpha: number): void => {
      for (let i = 0; i < steps; i++) {
        hud.fixedUpdate?.(dt);
      }
      hud.update?.(dt, alpha);
    };

    // A frame with 2 fixed steps → the HUD saw steps=2.
    frame(2, 0.5);
    expect(hudText()).toBe('FPS 60 | steps 2 | alpha 0.50 | interp ON');

    // A frame with 0 fixed steps → steps=0, not a stale value.
    frame(0, 0.25);
    expect(hudText()).toBe('FPS 60 | steps 0 | alpha 0.25 | interp ON');

    // The counter reset after each frame: 2 steps here read as 2, not
    // 2+0+2=4 — no accumulation across frames.
    frame(2, 0.75);
    expect(hudText()).toBe('FPS 60 | steps 2 | alpha 0.75 | interp ON');

    hud.dispose?.(); // unmount the stubbed DOM root
  });
});
