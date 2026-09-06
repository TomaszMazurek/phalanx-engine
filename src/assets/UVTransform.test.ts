import { describe, expect, it } from 'vitest';
import { DEFAULT_MATERIAL_DEFINITION } from './MaterialDefinition';
import { applyUV, composeUVMatrix, type Matrix3Tuple, type MatUv } from './UVTransform';

/**
 * Contract under test — the exact three.js Texture.updateMatrix() convention
 * (see the extraction note in UVTransform.ts): with S = diag(repeat.x,
 * repeat.y) and R(θ) = [[cos θ, sin θ], [− sin θ, cos θ]],
 *
 *     uv' = center + S · R(θ) · (uv − center) + offset
 *
 * i.e. rotation about `center` FIRST, repeat scaling AFTER, and the offset
 * added raw (unrotated, unscaled) in final texture space.
 */
function uvParams(overrides: Partial<MatUv> = {}): MatUv {
  return { repeat: [1, 1], offset: [0, 0], rotation: 0, center: [0.5, 0.5], ...overrides };
}

/** Applies the row-major 3×3 tuple to the homogeneous point [u, v, 1]. */
function applyTuple(m: Matrix3Tuple, u: number, v: number): [number, number] {
  return [m[0] * u + m[1] * v + m[2], m[3] * u + m[4] * v + m[5]];
}

/** Entry-wise numeric matrix comparison — three's `- sy * s` yields `-0` at
 *  rotation 0, which is numerically 0 but fails strict toEqual. */
function expectMatrixClose(
  m: Matrix3Tuple,
  expected: [number, number, number, number, number, number, number, number, number],
): void {
  m.forEach((entry, i) => expect(entry).toBeCloseTo(expected[i], 12));
}

describe('UVTransform', () => {
  it('identity transform maps uv to itself', () => {
    const uv = DEFAULT_MATERIAL_DEFINITION().uv; // repeat [1,1], offset [0,0], rotation 0, center [0.5,0.5]
    expectMatrixClose(composeUVMatrix(uv), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const [u2, v2] = applyUV(uv, 0.37, 0.42);
    expect(u2).toBeCloseTo(0.37, 12);
    expect(v2).toBeCloseTo(0.42, 12);
  });

  it('repeat scales coordinates (around the rotation center)', () => {
    // three's own Texture default center is (0, 0): a plain per-axis scale.
    const originCenter = uvParams({ repeat: [2, 3], center: [0, 0] });
    expectMatrixClose(composeUVMatrix(originCenter), [2, 0, 0, 0, 3, 0, 0, 0, 1]);
    const [u1, v1] = applyUV(originCenter, 0.5, 0.25);
    expect(u1).toBeCloseTo(1, 12);
    expect(v1).toBeCloseTo(0.75, 12);
    // MaterialDefinition defaults center to [0.5, 0.5]: scaling around that pivot.
    const halfCenter = uvParams({ repeat: [2, 2] });
    const [u2] = applyUV(halfCenter, 0.25, 0.25);
    expect(u2).toBeCloseTo(0, 12);
    const [, v3] = applyUV(halfCenter, 0.75, 0.75);
    expect(v3).toBeCloseTo(1, 12);
  });

  it('offset shifts in final texture space', () => {
    const uv = uvParams({ offset: [0.25, -0.5], center: [0, 0] });
    const [u2, v2] = applyUV(uv, 0.1, 0.6);
    expect(u2).toBeCloseTo(0.35, 12);
    expect(v2).toBeCloseTo(0.1, 12);
    const m = composeUVMatrix(uv);
    expect(m[2]).toBeCloseTo(0.25, 12);
    expect(m[5]).toBeCloseTo(-0.5, 12);
  });

  it('rotation +π/2 around [0.5, 0.5] cycles the corners (0,0)→(0,1)→(1,1)→(1,0)', () => {
    // Expected values computed from the extracted formula, NOT guessed:
    //   u' = c·(u−.5) + s·(v−.5) + .5 with c≈0, s=1  →  u' = v
    //   v' = −s·(u−.5) + c·(v−.5) + .5               →  v' = 1 − u
    const uv = uvParams({ rotation: Math.PI / 2 });
    const corners: Array<[number, number]> = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ];
    for (let i = 0; i < corners.length; i++) {
      const next = corners[(i + 1) % corners.length];
      const [u2, v2] = applyUV(uv, corners[i][0], corners[i][1]);
      expect(u2).toBeCloseTo(next[0], 12);
      expect(v2).toBeCloseTo(next[1], 12);
    }
  });

  it('rotation −π/2 cycles the corners the other way (0,0)→(1,0)→(1,1)→(0,1)', () => {
    // Sign-convention counterpart: with s = sin(−π/2) = −1,
    //   u' = c·(u−.5) + s·(v−.5) + .5 = −(v−.5) + .5 = 1 − v
    //   v' = −s·(u−.5) + c·(v−.5) + .5 = (u−.5) + .5 = u
    const uv = uvParams({ rotation: -Math.PI / 2 });
    const inputs: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const expected: Array<[number, number]> = [
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    for (let i = 0; i < inputs.length; i++) {
      const [u2, v2] = applyUV(uv, inputs[i][0], inputs[i][1]);
      expect(u2).toBeCloseTo(expected[i][0], 12);
      expect(v2).toBeCloseTo(expected[i][1], 12);
    }
  });

  it('combined repeat+offset+rotation composes in three order (hand-derived)', () => {
    // uv = { repeat: [2, 4], offset: [0.1, -0.2], rotation: π/2, center: [0.5, 0.5] }, point (1, 0).
    // Closed form uv' = center + S·R(θ)·(uv − center) + offset with R = [[c, s], [−s, c]]:
    //   uv − center               = (0.5, −0.5)
    //   R·(0.5, −0.5), c≈0, s=1   = (c·0.5 + s·(−0.5), −s·0.5 + c·(−0.5)) = (−0.5, −0.5)  ← rotation FIRST
    //   S·(−0.5, −0.5)            = (2·(−0.5), 4·(−0.5))                  = (−1, −2)      ← repeat scales AFTER
    //   + center + offset         = (−1 + 0.5 + 0.1, −2 + 0.5 − 0.2)      = (−0.4, −1.7)
    // The matrix linear part [[sx·c, sx·s], [−sy·s, sy·c]] bakes this order in.
    const uv = uvParams({ repeat: [2, 4], offset: [0.1, -0.2], rotation: Math.PI / 2 });
    const m = composeUVMatrix(uv);
    expect(m[0]).toBeCloseTo(0, 12); // sx·c
    expect(m[1]).toBeCloseTo(2, 12); // sx·s ← the X repeat rides the sin term: S∘R, not R∘S
    expect(m[2]).toBeCloseTo(-0.4, 12); // −sx·(c·cx + s·cy) + cx + tx = −2·0.5 + 0.6
    expect(m[3]).toBeCloseTo(-4, 12); // −sy·s
    expect(m[4]).toBeCloseTo(0, 12); // sy·c
    expect(m[5]).toBeCloseTo(2.3, 12); // −sy·(−s·cx + c·cy) + cy + ty = −4·(−0.5) + 0.3
    const [u2, v2] = applyUV(uv, 1, 0);
    expect(u2).toBeCloseTo(-0.4, 12);
    expect(v2).toBeCloseTo(-1.7, 12);
  });

  it('non-uniform repeat scales the rotated coordinates, not the other way', () => {
    // Input (0,1), repeat [2,4], rotation π/2, center [0.5,0.5], offset 0:
    //   three order (rotate, then scale): (0,1)−c=(−.5,.5); R·=(c·−.5+s·.5, −s·−.5+c·.5)=(.5,.5);
    //                                     S·=(2·.5, 4·.5)=(1,2); +c=(1.5, 2.5)
    //   wrong order (scale, then rotate): S·=(2·−.5, 4·.5)=(−1,2);
    //                                     R·=(c·−1+s·2, −s·−1+c·2)=(2,1); +c=(2.5, 1.5)
    const uv = uvParams({ repeat: [2, 4], rotation: Math.PI / 2 });
    const [u2, v2] = applyUV(uv, 0, 1);
    expect(u2).toBeCloseTo(1.5, 12);
    expect(v2).toBeCloseTo(2.5, 12);
  });

  it('rotation keeps the pivot fixed for arbitrary centers', () => {
    const uv = uvParams({ rotation: Math.PI / 3, center: [0.25, 0.75] });
    const [u2, v2] = applyUV(uv, 0.25, 0.75);
    expect(u2).toBeCloseTo(0.25, 12);
    expect(v2).toBeCloseTo(0.75, 12);
  });

  it('applyUV matches its composed matrix applied to [uv, 1]', () => {
    const paramSets: MatUv[] = [
      DEFAULT_MATERIAL_DEFINITION().uv,
      uvParams({ repeat: [2, 3], offset: [0.1, -0.2], rotation: Math.PI / 6, center: [0.25, 0.75] }),
      uvParams({ repeat: [0.5, 1.5], offset: [2, -3], rotation: -Math.PI / 4, center: [0.1, 0.9] }),
      uvParams({ repeat: [2, 4], offset: [0.1, -0.2], rotation: Math.PI / 2 }),
    ];
    const points: Array<[number, number]> = [
      [0, 0],
      [0.25, 0.5],
      [1, 1],
      [-0.3, 1.7],
    ];
    for (const uv of paramSets) {
      const m = composeUVMatrix(uv);
      expect([m[6], m[7], m[8]]).toEqual([0, 0, 1]); // affine bottom row
      for (const [u, v] of points) {
        const [u2, v2] = applyUV(uv, u, v);
        const [mu, mv] = applyTuple(m, u, v);
        expect(u2).toBeCloseTo(mu, 12);
        expect(v2).toBeCloseTo(mv, 12);
      }
    }
  });
});
