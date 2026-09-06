/**
 * UVTransform — pure texture-space UV math, three-free (src/assets boundary:
 * no three.js imports; the render/ adapter feeds this straight into a three
 * Texture.matrix / material uniforms).
 *
 * Extraction note (three 0.185.1, the exact convention replicated here):
 *
 * - node_modules/three/src/textures/Texture.js, updateMatrix():
 *     this.matrix.setUvTransform( this.offset.x, this.offset.y, this.repeat.x,
 *         this.repeat.y, this.rotation, this.center.x, this.center.y );
 *
 * - node_modules/three/src/math/Matrix3.js, setUvTransform( tx, ty, sx, sy, rotation, cx, cy ):
 *     const c = Math.cos( rotation );
 *     const s = Math.sin( rotation );
 *     this.set(
 *         sx * c, sx * s, - sx * ( c * cx + s * cy ) + cx + tx,
 *         - sy * s, sy * c, - sy * ( - s * cx + c * cy ) + cy + ty,
 *         0, 0, 1
 *     );
 *
 * - Applied in GLSL as a COLUMN vector (uv_vertex.glsl.js):
 *     vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
 *
 * Closed form of that matrix, with S = diag(repeat.x, repeat.y) and
 * R(θ) = [[cos θ, sin θ], [− sin θ, cos θ]]:
 *
 *     uv' = center + S · R(θ) · (uv − center) + offset
 *
 * Composition order: rotate about `center` FIRST, scale by repeat AFTER
 * (S sits outside R, so with non-uniform repeat each axis of repeat rides its
 * own matrix row), then the offset is added raw in final texture space —
 * it is neither rotated nor scaled. flipY handling is deliberately ABSENT:
 * in three it is a renderer/texture-upload concern, not part of this matrix.
 *
 * MaterialDefinition's `center` defaults to [0.5, 0.5] (texel-center pivot);
 * three's own Texture.center defaults to (0, 0). The formula is identical —
 * only the parameter differs.
 */

import type { MaterialDefinition } from './MaterialDefinition';

/** The `uv` block of a material definition (repeat/offset/rotation/center). */
export type MatUv = MaterialDefinition['uv'];

/** Row-major 3×3 matrix as a flat tuple [a, b, c, d, e, f, g, h, i]:
 *  | a b c |     uv' = (a·u + b·v + c, d·u + e·v + f) for the homogeneous point [u, v, 1]
 *  | d e f |
 *  | g h i |   (g, h, i) = (0, 0, 1) — affine. */
export type Matrix3Tuple = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * The three.js UV transform as a row-major 3×3 tuple, entry-for-entry equal
 * to Matrix3.setUvTransform(offset.x, offset.y, repeat.x, repeat.y, rotation,
 * center.x, center.y) (three stores its Matrix3 column-major internally; the
 * ROW-major flat tuple is the same matrix, laid out the way it multiplies).
 *
 * Loading this tuple into a THREE.Matrix3: use `matrix.set(...tuple)` (row-major
 * arguments) — NEVER `matrix.fromArray(tuple)`, which consumes column-major
 * and silently transposes the transform for any rotation ≠ 0.
 */
export function composeUVMatrix(uv: MatUv): Matrix3Tuple {
  const c = Math.cos(uv.rotation);
  const s = Math.sin(uv.rotation);
  const [sx, sy] = uv.repeat;
  const [cx, cy] = uv.center;
  const [tx, ty] = uv.offset;
  return [
    sx * c,
    sx * s,
    -sx * (c * cx + s * cy) + cx + tx,
    -sy * s,
    sy * c,
    -sy * (-s * cx + c * cy) + cy + ty,
    0,
    0,
    1,
  ];
}

/**
 * Applies the transform to a single point without building the matrix
 * (allocation-light path). Must stay arithmetically identical to
 * {@link composeUVMatrix} followed by multiplication — the test suite pins
 * this invariant.
 */
export function applyUV(uv: MatUv, u: number, v: number): [number, number] {
  const c = Math.cos(uv.rotation);
  const s = Math.sin(uv.rotation);
  const [sx, sy] = uv.repeat;
  const [cx, cy] = uv.center;
  const [tx, ty] = uv.offset;
  const du = u - cx;
  const dv = v - cy;
  return [sx * (c * du + s * dv) + cx + tx, sy * (-s * du + c * dv) + cy + ty];
}
