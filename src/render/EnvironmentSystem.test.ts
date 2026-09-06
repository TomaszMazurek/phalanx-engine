import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import type { EnvironmentPreset } from '../assets/EnvManifest';
import { EnvironmentSystem } from './EnvironmentSystem';

/**
 * Structural fakes over EnvironmentSystem's ACTUAL dependency shape:
 *
 * - renderer: only ever consumed by `new THREE.PMREMGenerator(renderer)`,
 *   whose constructor just stores the reference (verified in three 0.185) —
 *   an empty object suffices. The one GPU-touching call,
 *   `generator.fromEquirectangular()`, is intercepted on the PROTOTYPE and
 *   returns a REAL WebGLRenderTarget (headless-constructible; its dispose
 *   dispatches a real event). `generator.dispose()` is null-safe when no
 *   generation ever ran, so it executes for real.
 * - scene: a plain object with exactly the four fields apply()/dispose()
 *   write.
 * - assets: a REAL AssetManager, pre-seeded per URI with a controllable
 *   promise — precisely the cache entry EnvironmentSystem's own load() call
 *   would hit.
 */

const STUDIO_URI = 'env/studio.hdr';

function preset(partial: Partial<EnvironmentPreset> = {}): EnvironmentPreset {
  return {
    id: 'studio',
    name: 'Studio',
    hdri: STUDIO_URI,
    background: 'off',
    blurAmount: 0,
    intensity: 1,
    ...partial,
  };
}

interface World {
  system: EnvironmentSystem;
  scene: {
    environment: THREE.Texture | null;
    environmentIntensity: number;
    background: THREE.Texture | null;
    backgroundBlurriness: number;
  };
  /** Prototype spy on the PMREM bake — count = how many times we baked. */
  bake: ReturnType<typeof spyOnBake>;
  /** The fake bake result; its dispose event tracks target freeing. */
  target: THREE.WebGLRenderTarget;
}

function spyOnBake() {
  return vi.spyOn(THREE.PMREMGenerator.prototype, 'fromEquirectangular');
}

/** A system wired to one hdri URI whose load resolves to `hdriPromise`. */
function makeSystem(hdriPromise: Promise<unknown>): World {
  const scene = {
    environment: null as THREE.Texture | null,
    environmentIntensity: 1,
    background: null as THREE.Texture | null,
    backgroundBlurriness: 0,
  };
  const assets = new AssetManager();
  void assets.load(STUDIO_URI, () => hdriPromise);
  const target = new THREE.WebGLRenderTarget(4, 4);
  const bake = spyOnBake().mockReturnValue(target);
  const system = new EnvironmentSystem({
    renderer: {} as THREE.WebGLRenderer,
    scene: scene as unknown as THREE.Scene,
    assets,
  });
  return { system, scene, bake, target };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EnvironmentSystem (contract, structural fakes)', () => {
  it("mode 'off': environment + intensity set, background cleared", async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    await world.system.apply(preset({ intensity: 1.5 }));
    expect(world.scene.environment).toBe(world.target.texture);
    expect(world.scene.environmentIntensity).toBe(1.5);
    expect(world.scene.background).toBeNull();
    expect(world.bake).toHaveBeenCalledTimes(1);
  });

  it("mode 'skybox': background set to the PMREM texture, blurriness 0 (sharpest mip)", async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    await world.system.apply(preset({ background: 'skybox', blurAmount: 0.7 }));
    expect(world.scene.background).toBe(world.target.texture);
    expect(world.scene.backgroundBlurriness).toBe(0);
  });

  it("mode 'blur': background set to the PMREM texture, blurriness = preset blurAmount", async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    await world.system.apply(
      preset({ background: 'blur', blurAmount: 0.6, intensity: 0.9 }),
    );
    expect(world.scene.background).toBe(world.target.texture);
    expect(world.scene.backgroundBlurriness).toBe(0.6);
    expect(world.scene.environmentIntensity).toBe(0.9);
  });

  it('cache hit: re-applying the same hdri never re-bakes (fromEquirectangular ONCE)', async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    await world.system.apply(preset()); // bakes
    await world.system.apply(preset({ background: 'skybox' })); // cache hit
    expect(world.bake).toHaveBeenCalledTimes(1);
    expect(world.scene.background).toBe(world.target.texture); // mode still honored
  });

  it('dispose(): clears scene refs, frees cached targets and the generator', async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    const targetDisposed = vi.fn();
    world.target.addEventListener('dispose', targetDisposed);
    const generatorDisposed = vi
      .spyOn(THREE.PMREMGenerator.prototype, 'dispose')
      .mockImplementation(() => undefined); // assertion-only: never touches internals
    await world.system.apply(preset({ background: 'blur', blurAmount: 0.4 }));

    world.system.dispose();

    expect(world.scene.environment).toBeNull();
    expect(world.scene.background).toBeNull();
    expect(targetDisposed).toHaveBeenCalledTimes(1);
    expect(generatorDisposed).toHaveBeenCalledTimes(1);
  });

  it('apply() after dispose() rejects (guard before the load)', async () => {
    const world = makeSystem(Promise.resolve(new THREE.DataTexture()));
    world.system.dispose();
    await expect(world.system.apply(preset())).rejects.toThrow(/after dispose/);
  });

  it('dispose() DURING an in-flight load: no resurrection, no bake, no leak', async () => {
    let resolveHdri!: (texture: THREE.DataTexture) => void;
    const pending = new Promise<THREE.DataTexture>((resolve) => {
      resolveHdri = resolve;
    });
    const world = makeSystem(pending);
    const applied = world.system.apply(preset({ background: 'skybox' }));
    world.system.dispose(); // the app is torn down while the hdr is still loading

    resolveHdri(new THREE.DataTexture());
    await expect(applied).resolves.toBeUndefined(); // bail, not throw

    // The late continuation must not bake on the freed generator…
    expect(world.bake).not.toHaveBeenCalled();
    // …nor resurrect the environment dispose() just cleared.
    expect(world.scene.environment).toBeNull();
    expect(world.scene.background).toBeNull();
  });
});
