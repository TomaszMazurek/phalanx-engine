import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import { loadGLTF } from './GLTFAdapter';

/**
 * MeshFactory — primitive geometries by name (task 5) + glTF model shapes
 * (Phase 3, wave C3).
 *
 * Replaces `legacy/scripts/Shape.js` and its `eval("new THREE." + shapeName + ...)`
 * with a plain registry of constructors. `Circle` needs DoubleSide, so the
 * registry carries the side flag and the caller applies it to materials.
 *
 * Model ids live in the disjoint `model:<name>` namespace (never a bare
 * primitive name), so `isModelId` is a pure prefix check and the primitive
 * map below stays untouched; `list()` exposes both namespaces — primitives
 * first — which is exactly what the DevPanel shape dropdown consumes.
 */
interface ShapeEntry {
  create: () => THREE.BufferGeometry;
  side: THREE.Side;
}

const SHAPES: Record<string, ShapeEntry> = {
  Box: { create: () => new THREE.BoxGeometry(170, 170, 170), side: THREE.FrontSide },
  Sphere: { create: () => new THREE.SphereGeometry(120, 32, 32), side: THREE.FrontSide },
  Cone: { create: () => new THREE.ConeGeometry(150, 200, 32), side: THREE.FrontSide },
  Cylinder: { create: () => new THREE.CylinderGeometry(100, 100, 200, 32), side: THREE.FrontSide },
  Torus: { create: () => new THREE.TorusGeometry(100, 40, 16, 100), side: THREE.FrontSide },
  TorusKnot: {
    create: () => new THREE.TorusKnotGeometry(100, 40, 16, 100),
    side: THREE.FrontSide,
  },
  Dodecahedron: { create: () => new THREE.DodecahedronGeometry(150), side: THREE.FrontSide },
  Icosahedron: { create: () => new THREE.IcosahedronGeometry(150), side: THREE.FrontSide },
  Octahedron: { create: () => new THREE.OctahedronGeometry(150), side: THREE.FrontSide },
  Tetrahedron: { create: () => new THREE.TetrahedronGeometry(150), side: THREE.FrontSide },
  Circle: { create: () => new THREE.CircleGeometry(170, 32), side: THREE.DoubleSide },
};

/**
 * Model id → public/ URI. Same demo asset GameplayScene preloads
 * (MODEL_URI in examples/GameplayScene.ts) — not imported from there on
 * purpose: render/ must not depend on examples/.
 */
const MODELS: Record<string, string> = {
  'model:demo-cube': 'models/demo-cube.gltf',
};

/** Namespace prefix for glTF model shape ids (see the class doc). */
export const MODEL_PREFIX = 'model:';

/** True for ids in the `model:<name>` namespace (pure prefix check). */
export function isModelId(id: string): boolean {
  return id.startsWith(MODEL_PREFIX);
}

/**
 * Give `geometry` a `uv1` copy of `uv` if it has `uv` but no `uv1` yet —
 * aoMap reads channel 1 in modern three.js. Idempotent; a uv-less geometry
 * (e.g. the demo cube is vertex-colored only) is left alone.
 */
export function ensureUv1(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute('uv');
  if (uv && !geometry.getAttribute('uv1')) {
    geometry.setAttribute('uv1', uv.clone());
  }
}

/**
 * Load a model shape through the AssetManager cache and return a CLONE of
 * the glTF scene — clone-vs-shared DECISION: the viewer shows two copies
 * side by side, and a shared instance would make both share one transform
 * (rotation/position writes would collide), so every caller gets its own
 * `.clone()`. The clone SHARES geometries and materials with the cached
 * original (three.js clone semantics) — exactly what the material pipeline
 * wants: one GPU upload, N display instances, cache-owned resources never
 * disposed by consumers.
 */
export async function loadModelShape(id: string, assets: AssetManager): Promise<THREE.Object3D> {
  const uri = MODELS[id];
  if (!uri) {
    throw new Error(`MeshFactory: unknown model "${id}"`);
  }
  const gltf = await assets.load(uri, loadGLTF);
  const scene = gltf.scene.clone();
  // Same uv1 duplication primitives get. The geometry is shared with the
  // cache, so this is a one-time idempotent enrichment of the cached asset;
  // clones made later find uv1 already present and skip it.
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      ensureUv1(child.geometry);
    }
  });
  return scene;
}

export class MeshFactory {
  static list(): string[] {
    return [...Object.keys(SHAPES), ...Object.keys(MODELS)];
  }

  static sideOf(shapeName: string): THREE.Side {
    return (SHAPES[shapeName] ?? SHAPES.Sphere).side;
  }

  /** Create a primitive geometry. Adds a `uv1` copy of `uv` so `aoMap`
   * (which reads channel 1 in modern three.js) works without extra setup. */
  static create(shapeName: string): THREE.BufferGeometry {
    const entry = SHAPES[shapeName];
    if (!entry) {
      throw new Error(`MeshFactory: unknown shape "${shapeName}"`);
    }
    const geometry = entry.create();
    ensureUv1(geometry);
    return geometry;
  }
}
