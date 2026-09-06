import { describe, expect, it } from 'vitest';
import { nearestSphereHit, stepToward } from './combatMath';

/**
 * Combat math seams (src/game1/combatMath.ts): hitscan ray-vs-sphere and
 * the runner seek step. Both are pure over positions — the systems feed
 * them simulation state, never meshes.
 */
describe('nearestSphereHit', () => {
  const origin = { x: 0, y: 0.9, z: 0 };
  const east = { x: 1, y: 0, z: 0 };

  it('returns the NEAREST sphere hit with distance and point', () => {
    // Two spheres on the ray axis: oc = (-2, 0.2, 0), b = -2,
    // c = 4.04 - 0.3025, disc = 0.2625 → t = 2 - √0.2625 ≈ 1.4877.
    const spheres = [
      { x: 5, y: 0.7, z: 0, radius: 0.55 },
      { x: 2, y: 0.7, z: 0, radius: 0.55 },
    ];
    const hit = nearestSphereHit(origin, east, spheres);
    expect(hit?.index).toBe(1);
    expect(hit?.distance).toBeCloseTo(2 - Math.sqrt(0.2625), 9);
    expect(hit?.point.x).toBeCloseTo(2 - Math.sqrt(0.2625), 9);
    expect(hit?.point.y).toBeCloseTo(0.9, 9);
    expect(hit?.point.z).toBeCloseTo(0, 9);
  });

  it('returns null when every sphere misses the ray', () => {
    const spheres = [{ x: 5, y: 0.7, z: 4, radius: 0.55 }];
    expect(nearestSphereHit(origin, east, spheres)).toBeNull();
  });

  it('ignores spheres behind the ray origin', () => {
    const spheres = [{ x: -5, y: 0.7, z: 0, radius: 0.55 }];
    expect(nearestSphereHit(origin, east, spheres)).toBeNull();
  });

  it('still hits when the origin is inside a sphere (muzzle in the body)', () => {
    const hit = nearestSphereHit(
      { x: 2, y: 0.7, z: 0 },
      east,
      [{ x: 2, y: 0.7, z: 0, radius: 0.55 }],
    );
    expect(hit?.index).toBe(0);
    expect(hit?.distance).toBeCloseTo(0.55, 9);
    expect(hit?.point.x).toBeCloseTo(2.55, 9);
  });
});

describe('stepToward', () => {
  it('moves one speed·dt step toward the target', () => {
    expect(stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, 4, 0.5)).toEqual({ x: 2, z: 0 });
  });

  it('normalizes diagonal movement', () => {
    // Target 3-4-5 away, speed 5, dt 1 → exactly the target in one step.
    expect(stepToward({ x: 0, z: 0 }, { x: 3, z: 4 }, 5, 1)).toEqual({ x: 3, z: 4 });
  });

  it('never overshoots the target', () => {
    expect(stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, 4, 3)).toEqual({ x: 10, z: 0 });
  });

  it('snaps instantly when already at the target', () => {
    expect(stepToward({ x: 7, z: -2 }, { x: 7, z: -2 }, 4, 0.5)).toEqual({ x: 7, z: -2 });
  });
});
