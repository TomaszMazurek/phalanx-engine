import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import {
  createGLTFLoader,
  loadGLTF,
  type GLTFAddonBundle,
  type GLTFLoaderLike,
} from './GLTFAdapter';

/**
 * Minimal fs surface for the on-disk GLB smoke below. The app tsconfig
 * targets the browser (no @types/node), so node:fs is imported dynamically
 * behind a single documented boundary cast — the test RUNS under vitest's
 * node environment where the module exists. Uint8Array (not Buffer) keeps
 * the cast dependency-free.
 */
interface NodeFs {
  readFileSync(url: URL): Uint8Array;
}
// @ts-expect-error node:fs has no type declarations in this project (browser target)
const fs = (await import('node:fs')) as NodeFs;

/**
 * GLTFAdapter compression-track tests (Phase 3, wave D1).
 *
 * Flag-matrix tests assert WIRING through an injector of structural fakes
 * (the GLTFAddonBundle seam) — no peeking at the constructed loader's
 * private fields. The "real addons" + parse blocks are headless smokes:
 * meshopt decodes fully in node (pure-JS module, embedded wasm), while
 * Draco (browser Worker) and KTX2 (WebGL extension probing) cannot run
 * headless — those stay wiring-asserted here and land in wave E visual
 * verification, per the honest-scoping rule.
 */

class FakeGLTFLoader {
  static readonly constructed: FakeGLTFLoader[] = [];
  dracoLoader: unknown = null;
  ktx2Loader: unknown = null;
  meshoptDecoder: unknown = null;
  constructor() {
    FakeGLTFLoader.constructed.push(this);
  }
  load(): void {
    /* the factory never triggers IO */
  }
  parse(): void {
    /* unused in flag-matrix tests */
  }
  setDRACOLoader(draco: unknown): void {
    this.dracoLoader = draco;
  }
  setKTX2Loader(ktx2: unknown): void {
    this.ktx2Loader = ktx2;
  }
  setMeshoptDecoder(decoder: unknown): void {
    this.meshoptDecoder = decoder;
  }
}

class FakeKTX2Loader {
  static readonly constructed: FakeKTX2Loader[] = [];
  transcoderPath = '';
  detectedRenderers: unknown[] = [];
  constructor() {
    FakeKTX2Loader.constructed.push(this);
  }
  setTranscoderPath(path: string): void {
    this.transcoderPath = path;
  }
  detectSupport(renderer: WebGLRenderer): void {
    this.detectedRenderers.push(renderer);
  }
}

class FakeDRACOLoader {
  static readonly constructed: FakeDRACOLoader[] = [];
  decoderPath = '';
  constructor() {
    FakeDRACOLoader.constructed.push(this);
  }
  setDecoderPath(path: string): void {
    this.decoderPath = path;
  }
}

const MESHOPT_SENTINEL = { sentinel: 'meshopt module' };

/** Fakes implementing the exact seams the factory may call. */
function fakeAddons(): GLTFAddonBundle {
  return {
    GLTFLoader: FakeGLTFLoader,
    KTX2Loader: FakeKTX2Loader,
    DRACOLoader: FakeDRACOLoader,
    MeshoptDecoder: MESHOPT_SENTINEL,
  } satisfies GLTFAddonBundle;
}

/** Structural stand-in whose identity the wiring assertions compare. */
const fakeRenderer = { stub: 'renderer' } as unknown as WebGLRenderer;

function resetConstructed(): void {
  FakeGLTFLoader.constructed.length = 0;
  FakeKTX2Loader.constructed.length = 0;
  FakeDRACOLoader.constructed.length = 0;
}

describe('createGLTFLoader flag matrix (structural fakes)', () => {
  it('no options constructs one plain loader and wires nothing', () => {
    resetConstructed();
    const loader = createGLTFLoader({}, fakeAddons());
    expect(FakeGLTFLoader.constructed).toHaveLength(1);
    expect(FakeGLTFLoader.constructed[0]).toBe(loader);
    expect(FakeKTX2Loader.constructed).toHaveLength(0);
    expect(FakeDRACOLoader.constructed).toHaveLength(0);
    const wired = loader as FakeGLTFLoader;
    expect(wired.dracoLoader).toBeNull();
    expect(wired.ktx2Loader).toBeNull();
    expect(wired.meshoptDecoder).toBeNull();
  });

  it('draco attaches a DRACOLoader pointed at the vendored public/draco/gltf/', () => {
    resetConstructed();
    const loader = createGLTFLoader({ draco: true }, fakeAddons());
    expect(FakeDRACOLoader.constructed).toHaveLength(1);
    expect(FakeDRACOLoader.constructed[0].decoderPath).toBe('draco/gltf/');
    expect((loader as FakeGLTFLoader).dracoLoader).toBe(FakeDRACOLoader.constructed[0]);
    expect(FakeKTX2Loader.constructed).toHaveLength(0);
    expect((loader as FakeGLTFLoader).meshoptDecoder).toBeNull();
  });

  it('meshopt passes the addon module verbatim to setMeshoptDecoder', () => {
    resetConstructed();
    const loader = createGLTFLoader({ meshopt: true }, fakeAddons());
    expect((loader as FakeGLTFLoader).meshoptDecoder).toBe(MESHOPT_SENTINEL);
    expect(FakeDRACOLoader.constructed).toHaveLength(0);
    expect(FakeKTX2Loader.constructed).toHaveLength(0);
  });

  it('ktx2 without a renderer throws before constructing the KTX2Loader', () => {
    resetConstructed();
    expect(() => createGLTFLoader({ ktx2: true }, fakeAddons())).toThrow(
      'GLTFAdapter: ktx2 requires a renderer (KTX2Loader.detectSupport)',
    );
    expect(FakeKTX2Loader.constructed).toHaveLength(0);
    expect((FakeGLTFLoader.constructed[0] as FakeGLTFLoader).ktx2Loader).toBeNull();
  });

  it('ktx2 detects support on the given renderer and wires the vendored basis/ path', () => {
    resetConstructed();
    const loader = createGLTFLoader({ ktx2: true, renderer: fakeRenderer }, fakeAddons());
    expect(FakeKTX2Loader.constructed).toHaveLength(1);
    expect(FakeKTX2Loader.constructed[0].transcoderPath).toBe('basis/');
    expect(FakeKTX2Loader.constructed[0].detectedRenderers).toEqual([fakeRenderer]);
    expect((loader as FakeGLTFLoader).ktx2Loader).toBe(FakeKTX2Loader.constructed[0]);
  });

  it('all three flags together wire everything on one loader', () => {
    resetConstructed();
    const loader = createGLTFLoader(
      { ktx2: true, meshopt: true, draco: true, renderer: fakeRenderer },
      fakeAddons(),
    );
    const wired = loader as FakeGLTFLoader;
    expect(FakeGLTFLoader.constructed).toHaveLength(1);
    expect(wired.dracoLoader).toBe(FakeDRACOLoader.constructed[0]);
    expect(wired.ktx2Loader).toBe(FakeKTX2Loader.constructed[0]);
    expect(wired.meshoptDecoder).toBe(MESHOPT_SENTINEL);
  });
});

describe('createGLTFLoader with the real three addons (headless smokes)', () => {
  it('constructs and configures a draco+meshopt loader without WebGL', () => {
    const loader = createGLTFLoader({ draco: true, meshopt: true });
    // Reaching here means the real GLTFLoader/DRACOLoader/MeshoptDecoder
    // addon imports and wiring all exist and run in three 0.185 headlessly
    // (ktx2 is the only flag that needs a live renderer).
    expect(loader).toBeDefined();
  });

  it('constructs a KTX2Loader against a stub renderer via real detectSupport', () => {
    // detectSupport only READS renderer.extensions (three 0.185 source) —
    // a structural stub with has() => false takes the safe all-unsupported
    // path, proving the real wiring runs without a GPU.
    const stubRenderer = {
      extensions: { has: () => false },
    } as unknown as WebGLRenderer;
    const loader = createGLTFLoader({ ktx2: true, renderer: stubRenderer });
    expect(loader).toBeDefined();
  });
});

/**
 * three's FileLoader constructs DOM `ProgressEvent`s while streaming response
 * chunks (three.core.js FileLoader readData); node has no DOM — stub the
 * constructor with the only shape the loader reads (same pattern as the
 * InputSystem tests' KeyboardEvent stub). Browser runs are unaffected.
 */
class ProgressEventStub {
  readonly lengthComputable: boolean;
  readonly loaded: number;
  readonly total: number;
  constructor(
    _type: string,
    init: { lengthComputable?: boolean; loaded?: number; total?: number },
  ) {
    this.lengthComputable = init?.lengthComputable ?? false;
    this.loaded = init?.loaded ?? 0;
    this.total = init?.total ?? 0;
  }
}
if (typeof globalThis.ProgressEvent === 'undefined') {
  (globalThis as { ProgressEvent?: unknown }).ProgressEvent = ProgressEventStub;
}

/** Minimal valid glTF (one triangle) as a fetchable data: URI — no network. */
// The JSON payload is pure ASCII, so the browser-global btoa (also present
// in node 16+) base64-encodes it — Buffer has no type declarations here.
const TRIANGLE_URI = `data:model/gltf+json;base64,${btoa(
  JSON.stringify({
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [
      {
        uri: 'data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA',
        byteLength: 36,
      },
    ],
  }),
)}`;

describe('loadGLTF routing (headless via data: URIs)', () => {
  it('options-less calls load the plain model through the bare loader', async () => {
    const gltf = await loadGLTF(TRIANGLE_URI);
    expect(gltf.scene.type).toBe('Group');
    expect(gltf.scene.children).toHaveLength(1);
  });

  it('options route through the factory and still load (meshopt wired, model uncompressed)', async () => {
    const gltf = await loadGLTF(TRIANGLE_URI, undefined, { meshopt: true });
    expect(gltf.scene.type).toBe('Group');
    expect(gltf.scene.children).toHaveLength(1);
  });

  it('parse errors reject with the URI named', async () => {
    const badUri = 'data:model/gltf+json;base64,AAAA';
    await expect(loadGLTF(badUri)).rejects.toThrow('failed to load "' + badUri + '"');
  });
});

describe('meshopt GLB parse smoke (real decoder, headless)', () => {
  const glbPath = new URL('../../public/models/demo-cube-meshopt.glb', import.meta.url);

  it('decodes EXT_meshopt_compression through the configured loader', async () => {
    const loader: GLTFLoaderLike = createGLTFLoader({ meshopt: true });
    const gltf = await new Promise<GLTF>((resolvePromise, reject) => {
      const bytes = fs.readFileSync(glbPath);
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      loader.parse(
        data as ArrayBuffer,
        '',
        (parsed) => resolvePromise(parsed),
        (error) => reject(error),
      );
    });
    const mesh = gltf.scene.children[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    // The demo cube's 24 vertices arrive DECODED from EXT_meshopt_compression
    // buffers — this is the end-to-end proof of the meshopt wiring.
    expect((mesh as THREE.Mesh).geometry.getAttribute('position').count).toBe(24);
  });
});
