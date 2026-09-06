import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { DataTexture } from 'three';

/**
 * HDRAdapter — the three.js-facing RADIANCE .hdr loader (Phase 3, Wave B1).
 *
 * Lives in `render/` because it produces three.js objects; the three-free
 * {@link !AssetManager} in `assets/` calls it as a factory:
 * `assets.load('env/studio.hdr', loadHDR)` — same shape as
 * {@link !loadGLTF} in GLTFAdapter.
 *
 * RGBELoader vs HDRLoader (verified against three 0.185 sources): the task's
 * RGBELoader import path still exists but is a deprecated two-line subclass
 * that console.warns on every construction
 * (node_modules/three/examples/jsm/loaders/RGBELoader.js, "@deprecated,
 * r180"). This adapter wraps HDRLoader — the identical loader RGBELoader
 * extends, same parse, same output, no warning.
 *
 * Color space (verified, no manual override needed): HDRLoader.parse returns
 * `colorSpace: LinearSRGBColorSpace` (HDRLoader.js, end of parse) and
 * DataTextureLoader applies `texture.colorSpace = texData.colorSpace`
 * (DataTextureLoader.js). The DataTexture therefore arrives LINEAR, which is
 * exactly what PMREM generation requires — do not "fix" it to sRGB.
 *
 * The texture keeps the default UVMapping. That is fine for PMREM input
 * (PMREMGenerator.fromEquirectangular ignores `mapping`), but it must NOT be
 * assigned to scene.background directly: WebGLBackground only takes the
 * skybox path for cube textures or CubeUVReflectionMapping — a UV-mapped
 * texture would render as a FLAT plane behind the scene. EnvironmentSystem
 * therefore always backgrounds the PMREM result, never the raw DataTexture.
 */

const loader = new HDRLoader();

/** Wrap any loader error in an Error naming the failed URI. */
function describe(uri: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`HDRAdapter: failed to load "${uri}": ${error.message}`);
  }
  return new Error(`HDRAdapter: failed to load "${uri}": ${String(error)}`);
}

/**
 * Load an equirectangular RADIANCE .hdr asset (linear half-float
 * DataTexture), reporting [0..1] progress while the bytes stream.
 * Network/parse errors reject with the URI; the caller (usually
 * AssetManager) decides whether to retry.
 */
export function loadHDR(
  uri: string,
  onProgress?: (ratio: number) => void,
): Promise<DataTexture> {
  return new Promise<DataTexture>((resolve, reject) => {
    loader.load(
      uri,
      (texture) => resolve(texture),
      (event: ProgressEvent) => {
        // Emit only when the total is known; unknown-size responses would
        // report a meaningless 0.
        if (onProgress && event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      },
      (error: unknown) => reject(describe(uri, error)),
    );
  });
}
