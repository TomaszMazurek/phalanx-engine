import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import type { EnvironmentPreset } from '../assets/EnvManifest';
import { loadHDR } from './HDRAdapter';

/** Constructor dependencies, injected for testability like RenderSystem's. */
export interface EnvironmentSystemDeps {
  /** Owns the WebGL context; PMREM generation renders through it. */
  renderer: THREE.WebGLRenderer;
  /** Scene whose IBL/background this system drives. */
  scene: THREE.Scene;
  /** URI→promise cache; keeps re-applying an environment off the network. */
  assets: AssetManager;
}

/**
 * EnvironmentSystem — image-based lighting from manifest presets
 * (Phase 3, Wave B1).
 *
 * Modern IBL, no legacy hacks: one PMREM-processed environment texture is
 * assigned to `scene.environment` (the renderer routes it to every
 * MeshStandardMaterial — no per-material `envMap`/`envMapIntensity` poking,
 * which is what `scene.environmentIntensity` replaces, verified honored in
 * three 0.185 WebGLRenderer). Background modes per preset:
 * - 'off'    → scene.background = null.
 * - 'skybox' → the PMREM texture, backgroundBlurriness 0 (sharpest mip).
 * - 'blur'   → the PMREM texture, backgroundBlurriness = preset.blurAmount.
 *
 * Why the PMREM texture as background and not the raw equirect DataTexture:
 * WebGLBackground only takes the skybox box-mesh path for cube textures or
 * CubeUVReflectionMapping (the PMREM output's mapping) — the raw loader
 * texture keeps UVMapping and would draw as a FLAT plane. The PMREM texture
 * additionally makes backgroundBlurriness meaningful: it selects the
 * pre-filtered mip chain.
 *
 * PMREM ONCE per environment (plan trap): generation renders many mip levels
 * through the GPU; results are cached in this system by hdri URI, so
 * re-applying an environment costs a cache hit, not a re-bake. The raw HDR
 * DataTextures are cached one level up, by {@link AssetManager} — this
 * system never disposes them (caller lifetime, see dispose()).
 */
export class EnvironmentSystem {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly assets: AssetManager;
  private readonly generator: THREE.PMREMGenerator;
  /** hdri URI → PMREM render target (the "bake once" cache). */
  private readonly pmremCache = new Map<string, THREE.WebGLRenderTarget>();
  private disposed = false;

  constructor(deps: EnvironmentSystemDeps) {
    this.renderer = deps.renderer;
    this.scene = deps.scene;
    this.assets = deps.assets;
    this.generator = new THREE.PMREMGenerator(this.renderer);
  }

  /**
   * Apply an environment preset: load the HDRI (AssetManager-cached —
   * re-apply of a previously used preset hits the cache, no network),
   * PMREM-generate it once per URI, then set scene.environment (+intensity)
   * and scene.background per the preset's background mode.
   *
   * Presets are expected to come from a validated manifest
   * (validateEnvManifest) or normalizeEnvPreset; malformed values are not
   * re-checked here.
   */
  async apply(preset: EnvironmentPreset): Promise<void> {
    if (this.disposed) {
      throw new Error('EnvironmentSystem: apply() called after dispose()');
    }
    const hdri = await this.assets.load(preset.hdri, loadHDR);
    // Generate-then-cache synchronously: two concurrent apply() calls for
    // the same URI await the SAME AssetManager promise, whose continuations
    // run in registration (call) order — so the first caller bakes and the
    // second always observes the cache entry.
    let target = this.pmremCache.get(preset.hdri);
    if (!target) {
      target = this.generator.fromEquirectangular(hdri);
      this.pmremCache.set(preset.hdri, target);
    }
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = preset.intensity;
    switch (preset.background) {
      case 'skybox':
        this.scene.background = target.texture;
        this.scene.backgroundBlurriness = 0;
        break;
      case 'blur':
        this.scene.background = target.texture;
        this.scene.backgroundBlurriness = preset.blurAmount;
        break;
      case 'off':
        this.scene.background = null;
        this.scene.backgroundBlurriness = 0;
        break;
    }
  }

  /**
   * Teardown: clears the scene's environment/background references, frees
   * every cached PMREM render target and the generator's internal
   * resources. The RAW HDR DataTextures are NOT disposed here — they belong
   * to the AssetManager cache; whoever owns that cache (app lifetime,
   * usually) decides via release()/disposeAll() and disposes the textures.
   */
  dispose(): void {
    this.scene.environment = null;
    this.scene.background = null;
    for (const target of this.pmremCache.values()) {
      target.dispose();
    }
    this.pmremCache.clear();
    this.generator.dispose();
    this.disposed = true;
  }
}
