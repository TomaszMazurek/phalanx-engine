import * as THREE from 'three';

/**
 * MeshFactory — primitive geometries by name (task 5).
 *
 * Replaces `legacy/scripts/Shape.js` and its `eval("new THREE." + shapeName + ...)`
 * with a plain registry of constructors. `Circle` needs DoubleSide, so the
 * registry carries the side flag and the caller applies it to materials.
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

export class MeshFactory {
  static list(): string[] {
    return Object.keys(SHAPES);
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
    const uv = geometry.getAttribute('uv');
    if (uv) {
      geometry.setAttribute('uv1', uv.clone());
    }
    return geometry;
  }
}
