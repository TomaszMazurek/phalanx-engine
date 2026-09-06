import { describe, expect, it } from 'vitest';
import { AssetManager } from '../assets/AssetManager';
import { DEFAULT_BINDINGS } from '../core/Bindings';
import { EventBus } from '../core/EventBus';
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
 * a structural fake, InputSystem never starts (constructor only). No three
 * object is constructed in any tested path — enter() (real three content)
 * is Wave F manual acceptance.
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

/** Fake model node: records position writes, satisfies ModelNode structurally. */
class FakeModelNode {
  readonly positions: Array<[number, number, number]> = [];
  readonly position = {
    set: (x: number, y: number, z: number): void => {
      this.positions.push([x, y, z]);
    },
  };
}

/** Fake renderer: satisfies RenderOutputTarget (scene never entered in tests). */
const fakeRender: RenderOutputTarget = {
  setRenderOutput: (): void => {
    /* never called — enter() is not exercised here */
  },
};

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

function makeDeps(assets: AssetManager, loadModel: ModelLoader) {
  const input = new InputSystem(DEFAULT_BINDINGS, new EventTarget());
  const events = new EventBus<GameEvents>();
  return { deps: { render: fakeRender, assets, input, events, loadModel }, input, events };
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
