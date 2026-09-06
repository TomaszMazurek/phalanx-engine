import { describe, expect, it } from 'vitest';
import { pointerToNdc, rayPlanePoint, xzDirection } from './aimMath';

/**
 * Aim math seams (src/game1/aimMath.ts) — the pure half of the twin-stick
 * aiming: pointer px → NDC, ray → ground-plane point, player → aim point
 * direction. The impure half (THREE.Raycaster + camera) lives in
 * AimSystem and stays browser-only.
 */
describe('pointerToNdc', () => {
  it('maps the viewport center to (0, 0)', () => {
    expect(pointerToNdc(960, 540, 1920, 1080)).toEqual({ x: 0, y: 0 });
  });

  it('maps the four corners to the NDC corners (y flips)', () => {
    expect(pointerToNdc(0, 0, 1920, 1080)).toEqual({ x: -1, y: 1 });
    expect(pointerToNdc(1920, 0, 1920, 1080)).toEqual({ x: 1, y: 1 });
    expect(pointerToNdc(0, 1080, 1920, 1080)).toEqual({ x: -1, y: -1 });
    expect(pointerToNdc(1920, 1080, 1920, 1080)).toEqual({ x: 1, y: -1 });
  });
});

describe('rayPlanePoint', () => {
  it('lands on the aimed point of the horizontal plane', () => {
    // Camera-style ray: origin high behind the arena, aimed at (2, 0.9, -3).
    const origin = { x: 0, y: 16, z: 12 };
    const target = { x: 2, y: 0.9, z: -3 };
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;
    const length = Math.hypot(dx, dy, dz);
    const dir = { x: dx / length, y: dy / length, z: dz / length };

    const hit = rayPlanePoint(origin, dir, 0.9);
    expect(hit).not.toBeNull();
    expect(hit?.x).toBeCloseTo(2, 9);
    expect(hit?.y).toBeCloseTo(0.9, 9);
    expect(hit?.z).toBeCloseTo(-3, 9);
  });

  it('returns null for a ray parallel to the plane', () => {
    expect(rayPlanePoint({ x: 0, y: 16, z: 12 }, { x: 1, y: 0, z: 0 }, 0.9)).toBeNull();
  });

  it('returns null when the plane is behind the ray', () => {
    // Pointing up from above the plane: the intersection has t < 0.
    expect(rayPlanePoint({ x: 0, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }, 0.9)).toBeNull();
  });
});

describe('xzDirection', () => {
  it('normalizes the XZ delta to a unit vector', () => {
    expect(xzDirection({ x: 0, z: 0 }, { x: 3, z: 4 })).toEqual({ x: 0.6, z: 0.8 });
  });

  it('points backward when the target is behind the player', () => {
    expect(xzDirection({ x: 5, z: 5 }, { x: 5, z: 2 })).toEqual({ x: 0, z: -1 });
  });

  it('returns null for a degenerate (zero-length) delta', () => {
    expect(xzDirection({ x: 1, z: 1 }, { x: 1, z: 1 })).toBeNull();
  });
});
