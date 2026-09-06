import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * GLTFAdapter — the three.js-facing glTF loader (Phase 2, task 5).
 *
 * Lives in `render/` because it produces three.js objects; the three-free
 * {@link !AssetManager} in `assets/` calls it as a factory:
 * `assets.load('models/x.gltf', loadGLTF)`.
 *
 * Deliberate scope cut (docs/phase-2-core.md, trap #7): NO Draco, KTX2 or
 * meshopt decompression — plain glTF/glb only, no loader decorators. That is
 * Phase 3+ work; the loader stays dependency-free and fast here.
 *
 * colorSpace: textures embedded in a glTF file get their color space set by
 * GLTFLoader per the spec (baseColor sRGB, data maps linear) — nothing to
 * configure. Visual verification (the "flat PBR" failure mode) is Wave D.
 */

const loader = new GLTFLoader();

/** Wrap any loader error in an Error naming the failed URI. */
function describe(uri: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`GLTFAdapter: failed to load "${uri}": ${error.message}`);
  }
  return new Error(`GLTFAdapter: failed to load "${uri}": ${String(error)}`);
}

/**
 * Load a glTF/GLB asset, reporting [0..1] progress while the bytes stream.
 * Network/parse errors reject; the caller (usually AssetManager) decides
 * whether to retry.
 */
export function loadGLTF(
  uri: string,
  onProgress?: (ratio: number) => void,
): Promise<GLTF> {
  return new Promise<GLTF>((resolve, reject) => {
    loader.load(
      uri,
      (gltf) => resolve(gltf),
      (event: ProgressEvent) => {
        // Emit only when the total is known; unknown-size responses would
        // report a meaningless 0.
        if (onProgress && event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      },
      // The declared event type is ErrorEvent, but GLTFLoader forwards plain
      // Errors from parse failures too — accept both via `unknown`.
      (error: unknown) => reject(describe(uri, error)),
    );
  });
}