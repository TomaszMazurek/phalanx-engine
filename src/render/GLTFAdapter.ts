import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';

/**
 * GLTFAdapter — the three.js-facing glTF loader (Phase 2, task 5; the
 * compression track is Phase 3, wave D1).
 *
 * Lives in `render/` because it produces three.js objects; the three-free
 * {@link !AssetManager} in `assets/` calls it as a factory:
 * `assets.load('models/x.gltf', loadGLTF)`.
 *
 * Compression is OPT-IN per load (design law, phase-3 plan): the module-level
 * `bareLoader` below is today's plain GLTFLoader — untouched, no extensions,
 * exactly what Phase 2 shipped (its trap #7 scope cut). Only calls that pass
 * {@link GLTFLoaderOptions} build a FRESH configured loader through
 * {@link createGLTFLoader}; nothing mutates any loader's defaults globally.
 *
 * Decoder/transcoder files are vendored from the three build in
 * node_modules (docs/phase-3-materials.md, trap #4: their version must match
 * three 0.185) into public/basis/ and public/draco/gltf/ — the paths are
 * page-relative like every other public/ asset (vite base './').
 *
 * colorSpace: textures embedded in a glTF file get their color space set by
 * GLTFLoader per the spec (baseColor sRGB, data maps linear) — nothing to
 * configure. Visual verification (the "flat PBR" failure mode) is wave D/E.
 */

/**
 * Structural slice of GLTFLoader this adapter consumes. Narrow on purpose —
 * constructor + the three extension setters + load — so tests can inject
 * recording fakes (see {@link GLTFAddonBundle}) instead of peeking at the
 * loader's private fields to assert wiring.
 */
export interface GLTFLoaderLike {
  load(
    uri: string,
    onLoad: (gltf: GLTF) => void,
    onProgress: (event: ProgressEvent) => void,
    onError: (error: unknown) => void,
  ): unknown;
  /** Parse in-memory bytes — the headless (no-fetch, no-WebGL) smoke seam. */
  parse(
    data: ArrayBuffer | string,
    path: string,
    onLoad: (gltf: GLTF) => void,
    onError: (error: unknown) => void,
  ): unknown;
  setDRACOLoader(draco: unknown): unknown;
  setKTX2Loader(ktx2: unknown): unknown;
  setMeshoptDecoder(decoder: unknown): unknown;
}

/** Structural slice of KTX2Loader used by {@link createGLTFLoader}. */
export interface KTX2LoaderLike {
  setTranscoderPath(path: string): unknown;
  detectSupport(renderer: WebGLRenderer): unknown;
}

/** Structural slice of DRACOLoader used by {@link createGLTFLoader}. */
export interface DRACOLoaderLike {
  setDecoderPath(path: string): unknown;
}

/**
 * The three.js glTF addon surface the factory wires. Default = the real
 * addons (module scope, below); tests pass structural fakes to assert the
 * wiring calls — same pattern as the ModelLoader/GameplayScene seam.
 */
export interface GLTFAddonBundle {
  GLTFLoader: new () => GLTFLoaderLike;
  KTX2Loader: new () => KTX2LoaderLike;
  DRACOLoader: new () => DRACOLoaderLike;
  /** Passed verbatim to `setMeshoptDecoder` (opaque here). */
  MeshoptDecoder: unknown;
}

const REAL_ADDONS: GLTFAddonBundle = {
  GLTFLoader: GLTFLoader,
  KTX2Loader: KTX2Loader,
  DRACOLoader: DRACOLoader,
  MeshoptDecoder: MeshoptDecoder,
};

/**
 * KTX2 transcoder path — public/basis/ holds the two files three 0.185
 * loads from it: basis_transcoder.js + basis_transcoder.wasm (vendored
 * verbatim from three/examples/jsm/libs/basis/, byte-identical).
 */
const KTX2_TRANSCODER_PATH = 'basis/';

/**
 * Draco decoder path — public/draco/gltf/ holds draco_decoder.js,
 * draco_decoder.wasm and draco_wasm_wrapper.js (the `gltf/` decoder
 * variant, vendored verbatim from three/examples/jsm/libs/draco/gltf/).
 */
const DRACO_DECODER_PATH = 'draco/gltf/';

/** Per-load opt-in compression flags for {@link createGLTFLoader}. */
export interface GLTFLoaderOptions {
  /**
   * KHR_texture_basisu: transcode KTX2 textures on load. Requires
   * `renderer` — KTX2Loader.detectSupport(renderer) probes the GPU's
   * compressed-texture extensions to pick a target format, and that needs
   * a live (initialized) renderer. Throws without one.
   */
  ktx2?: boolean;
  /**
   * EXT_meshopt_compression: MeshoptDecoder (pure-JS module with embedded
   * wasm — nothing vendored, it is bundled by the build from three/addons).
   * Runs headless: the decoder awaits its own wasm `ready` promise, so
   * `setMeshoptDecoder(MeshoptDecoder)` needs no manual awaiting.
   */
  meshopt?: boolean;
  /** KHR_draco_mesh_compression: Draco mesh decoding via public/draco/gltf/. */
  draco?: boolean;
  /** Required when `ktx2: true`. */
  renderer?: WebGLRenderer;
}

/**
 * Build a GLTFLoader with the requested compression extensions attached.
 *
 * Cost model (honest, not yet profiled): a fresh configured loader per call.
 * DRACOLoader instances lazily fetch their decoder on first compressed
 * buffer and spawn workers that outlive the loader (three's shared-pool
 * design) — repeated draco loads re-fetch unless the browser cache serves
 * public/. If profiling ever shows that hurting, hoist ONE configured
 * loader per flag-set to module scope; the opt-in contract stays the same.
 */
export function createGLTFLoader(
  options: GLTFLoaderOptions = {},
  addons: GLTFAddonBundle = REAL_ADDONS,
): GLTFLoaderLike {
  const loader = new addons.GLTFLoader();
  if (options.draco === true) {
    const draco = new addons.DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    loader.setDRACOLoader(draco);
  }
  if (options.meshopt === true) {
    loader.setMeshoptDecoder(addons.MeshoptDecoder);
  }
  if (options.ktx2 === true) {
    if (!options.renderer) {
      throw new Error(
        'GLTFAdapter: ktx2 requires a renderer (KTX2Loader.detectSupport)',
      );
    }
    const ktx2 = new addons.KTX2Loader();
    ktx2.setTranscoderPath(KTX2_TRANSCODER_PATH);
    ktx2.detectSupport(options.renderer);
    loader.setKTX2Loader(ktx2);
  }
  return loader;
}

/**
 * Today's Phase 2 loader: plain GLTFLoader, no extensions, shared by every
 * options-less loadGLTF call. Never decorated — see the design law in the
 * module doc.
 */
const bareLoader: GLTFLoaderLike = new GLTFLoader();

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
 *
 * Passing `options` routes through {@link createGLTFLoader} (opt-in
 * compression); omitting them keeps the plain Phase 2 loader — every
 * existing call site (GameplayScene, MeshFactory, viewer) is unchanged.
 */
export function loadGLTF(
  uri: string,
  onProgress?: (ratio: number) => void,
  options?: GLTFLoaderOptions,
): Promise<GLTF> {
  const loader: GLTFLoaderLike = options ? createGLTFLoader(options) : bareLoader;
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
