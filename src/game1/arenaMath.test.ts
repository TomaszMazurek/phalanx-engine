import { describe, expect, it } from 'vitest';
import { ARENA_BOUNDS, clampToArena, gateMoveAxis } from './arenaMath';

/**
 * Arena math seams (src/game1/arenaMath.ts): axis gating for the wall
 * clamp (see ArenaClampedInput) and the cosmetic clamp used by every
 * gameplay consumer of the player position.
 *
 * moveY convention (PlayerController): moveY +1 walks world −Z ("into the
 * screen" from the default camera on +Z) — so +moveY is gated at minZ and
 * −moveY at maxZ.
 */
const BOUNDS = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };

describe('gateMoveAxis', () => {
  it('passes axes through untouched inside the arena', () => {
    const center = { x: 0, z: 0 };
    expect(gateMoveAxis('moveX', 1, center, BOUNDS)).toBe(1);
    expect(gateMoveAxis('moveX', -1, center, BOUNDS)).toBe(-1);
    expect(gateMoveAxis('moveY', 1, center, BOUNDS)).toBe(1);
    expect(gateMoveAxis('moveY', -1, center, BOUNDS)).toBe(-1);
  });

  it('blocks +moveX at the east wall, keeps retreat open', () => {
    const eastWall = { x: 19, z: 0 };
    expect(gateMoveAxis('moveX', 1, eastWall, BOUNDS)).toBe(0);
    expect(gateMoveAxis('moveX', -1, eastWall, BOUNDS)).toBe(-1);
  });

  it('blocks -moveX at the west wall', () => {
    expect(gateMoveAxis('moveX', -1, { x: -19, z: 0 }, BOUNDS)).toBe(0);
  });

  it('blocks +moveY (world −z) at the north wall', () => {
    expect(gateMoveAxis('moveY', 1, { x: 0, z: -19 }, BOUNDS)).toBe(0);
  });

  it('blocks -moveY (world +z) at the south wall', () => {
    expect(gateMoveAxis('moveY', -1, { x: 0, z: 19 }, BOUNDS)).toBe(0);
  });

  it('blocks only the outward axis at a corner', () => {
    const corner = { x: 19, z: 19 };
    expect(gateMoveAxis('moveX', 1, corner, BOUNDS)).toBe(0);
    expect(gateMoveAxis('moveY', -1, corner, BOUNDS)).toBe(0);
    expect(gateMoveAxis('moveX', -1, corner, BOUNDS)).toBe(-1);
    expect(gateMoveAxis('moveY', 1, corner, BOUNDS)).toBe(1);
  });
});

describe('clampToArena', () => {
  it('clamps each axis independently', () => {
    expect(clampToArena({ x: 25, z: -25 }, BOUNDS)).toEqual({ x: 19, z: -19 });
  });

  it('leaves interior points untouched', () => {
    expect(clampToArena({ x: 3, z: -7 }, BOUNDS)).toEqual({ x: 3, z: -7 });
  });
});

describe('ARENA_BOUNDS / SPAWN_PADS (data)', () => {
  it('arena is symmetric with pads on all four wall midpoints', async () => {
    const { SPAWN_PADS } = await import('./arenaMath');
    expect(ARENA_BOUNDS.minX).toBe(-ARENA_BOUNDS.maxX);
    expect(ARENA_BOUNDS.minZ).toBe(-ARENA_BOUNDS.maxZ);
    expect(SPAWN_PADS.length).toBe(4);
    for (const pad of SPAWN_PADS) {
      expect(Math.abs(pad.x)).toBeLessThanOrEqual(ARENA_BOUNDS.maxX);
      expect(Math.abs(pad.z)).toBeLessThanOrEqual(ARENA_BOUNDS.maxZ);
    }
  });
});
