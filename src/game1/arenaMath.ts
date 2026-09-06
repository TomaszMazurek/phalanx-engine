/**
 * Arena math (Game 1, Sprint 0) — play-area bounds, spawn pad data and
 * the wall-clamp helpers.
 *
 * PlayerController (engine, unmodified) has no bounds concept, so the
 * product layer clamps at the INPUT level: ArenaClampedInput gates the
 * move axes when the player stands at a wall (axis reads 0 outward, full
 * inward — no dead zone, unlike a cosmetic-only clamp that lets the
 * simulation drift outside). clampToArena then absorbs the sub-step
 * overshoot (≤ one step of movement) for every visual/gameplay consumer.
 */
import type { XZ } from './aimMath';

/** Inclusive play-area bounds for the player, world units. */
export interface ArenaBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * 40×40 arena: walls centered at ±20 with 1-unit thickness → inner wall
 * face at 19.5; the player body radius 0.5 clamps at ±19 (body face meets
 * the wall face exactly).
 */
export const ARENA_BOUNDS: ArenaBounds = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };

/** Spawn pads at the four wall midpoints (180° rotational symmetry, D4). */
export const SPAWN_PADS: readonly XZ[] = [
  { x: 0, z: -18 },
  { x: 0, z: 18 },
  { x: -18, z: 0 },
  { x: 18, z: 0 },
];

/**
 * Gate one move axis against the walls. moveY convention (PlayerController):
 * +1 walks world −Z, −1 walks world +Z — hence +moveY gates at minZ.
 * Only the OUTWARD direction is zeroed; retreating stays full-strength.
 */
export function gateMoveAxis(
  axis: 'moveX' | 'moveY',
  value: number,
  pos: XZ,
  bounds: ArenaBounds,
): number {
  if (axis === 'moveX') {
    if (value > 0 && pos.x >= bounds.maxX) return 0;
    if (value < 0 && pos.x <= bounds.minX) return 0;
    return value;
  }
  if (value > 0 && pos.z <= bounds.minZ) return 0; // +moveY → z decreases
  if (value < 0 && pos.z >= bounds.maxZ) return 0; // −moveY → z increases
  return value;
}

/** Clamp a point into the play area (absorbs sub-step wall overshoot). */
export function clampToArena(pos: XZ, bounds: ArenaBounds): XZ {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, pos.x)),
    z: Math.min(bounds.maxZ, Math.max(bounds.minZ, pos.z)),
  };
}
