/**
 * Combat math (Game 1, Sprint 0) — pure hitscan and seek-step helpers.
 *
 * Hitscan is ray-vs-sphere over SIMULATION positions, not three meshes:
 * deterministic, allocation-cheap and testable headless. Each enemy is
 * approximated by one sphere (capsule body ≈ sphere at chest height) —
 * good enough for a hitscan at arena scale, documented approximation.
 */
import type { Vec3, XZ } from './aimMath';

/** A hit-test sphere: center plus radius (world units). */
export interface SphereLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

/** One ray hit: which sphere (index into the passed array), how far, where. */
export interface RayHit {
  readonly index: number;
  readonly distance: number;
  readonly point: Vec3;
}

/**
 * Nearest sphere hit along the ray, or null. `dir` must be normalized.
 *
 * Handles the origin-inside-a-sphere case (muzzle inside a touching
 * runner) by accepting the smallest NON-NEGATIVE root; fully-behind
 * spheres are ignored.
 */
export function nearestSphereHit(
  origin: Vec3,
  dir: Vec3,
  spheres: readonly SphereLike[],
): RayHit | null {
  let best: RayHit | null = null;

  for (const [index, sphere] of spheres.entries()) {
    const ocx = origin.x - sphere.x;
    const ocy = origin.y - sphere.y;
    const ocz = origin.z - sphere.z;
    const b = ocx * dir.x + ocy * dir.y + ocz * dir.z;
    const c = ocx * ocx + ocy * ocy + ocz * ocz - sphere.radius * sphere.radius;
    const discriminant = b * b - c;
    if (discriminant < 0) continue;

    const root = Math.sqrt(discriminant);
    let t = -b - root;
    if (t < 0) t = -b + root; // origin inside the sphere → the exit hit
    if (t < 0) continue; // sphere entirely behind the ray

    if (best === null || t < best.distance) {
      best = {
        index,
        distance: t,
        point: {
          x: origin.x + dir.x * t,
          y: origin.y + dir.y * t,
          z: origin.z + dir.z * t,
        },
      };
    }
  }

  return best;
}

/**
 * One seek step: move `pos` toward `target` by at most speed·dt, never
 * overshooting (the runner lands exactly on the target on the final step).
 */
export function stepToward(pos: XZ, target: XZ, speed: number, dt: number): XZ {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-9) return { x: target.x, z: target.z };
  const step = Math.min(speed * dt, distance);
  return {
    x: pos.x + (dx / distance) * step,
    z: pos.z + (dz / distance) * step,
  };
}
