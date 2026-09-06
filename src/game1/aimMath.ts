/**
 * Aim math (Game 1, Sprint 0) — the pure half of twin-stick aiming.
 *
 * The impure half (THREE.Raycaster + camera unprojection) lives in
 * game1/systems/AimSystem; everything computable without a camera OBJECT
 * is here so it stays headless-testable: pointer pixels → NDC, a ray
 * against the horizontal aim plane, and the player→aim-point direction.
 */

/** A 3-component vector (structural slice — THREE.Vector3 satisfies it). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A 2-component vector (structural slice — THREE.Vector2 satisfies it). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** A position/direction on the ground plane (world XZ). */
export interface XZ {
  readonly x: number;
  readonly z: number;
}

/**
 * Height of the aim plane (and the weapon ray), world units. Kept at
 * chest height so the mouse crosshair, the tracer and the hitscan ray all
 * live on the same plane — the crosshair lies about where shots go.
 */
export const AIM_PLANE_Y = 0.9;

/**
 * Pointer position (client px) → normalized device coordinates in
 * [-1, 1]², y pointing UP (the DOM y axis points down, so it flips).
 */
export function pointerToNdc(px: number, py: number, width: number, height: number): Vec2 {
  return {
    x: (px / width) * 2 - 1,
    y: -(py / height) * 2 + 1,
  };
}

/**
 * Intersect a ray with the horizontal plane y = planeY. `dir` must be
 * normalized (the THREE.Raycaster contract). Returns the hit point, or
 * null when the ray is parallel to the plane or the plane is behind the
 * origin (pointer at the horizon) — callers keep their last aim then.
 */
export function rayPlanePoint(origin: Vec3, dir: Vec3, planeY: number): Vec3 | null {
  if (Math.abs(dir.y) < 1e-9) return null;
  const t = (planeY - origin.y) / dir.y;
  if (t < 0) return null;
  return { x: origin.x + dir.x * t, y: planeY, z: origin.z + dir.z * t };
}

/**
 * Unit XZ direction from `from` to `to` (the y axis is ignored — aiming is
 * a ground-plane concept). Returns null for a zero-length delta so callers
 * can keep their previous aim instead of inventing a direction.
 */
export function xzDirection(from: XZ, to: XZ): XZ | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;
  return { x: dx / length, z: dz / length };
}
