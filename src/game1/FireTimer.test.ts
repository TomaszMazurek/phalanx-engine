import { describe, expect, it } from 'vitest';
import { FireTimer } from './FireTimer';

/**
 * FireTimer (src/game1/FireTimer.ts) — the hold-fire cooldown state
 * machine, pure over an explicit simulation clock (ms).
 */
describe('FireTimer', () => {
  it('rejects non-positive cooldowns at construction', () => {
    expect(() => new FireTimer(0)).toThrow(RangeError);
    expect(() => new FireTimer(-5)).toThrow(RangeError);
  });

  it('fires immediately, then enforces the 140 ms cooldown', () => {
    const timer = new FireTimer(140);
    expect(timer.tryFire(0)).toBe(true);
    expect(timer.tryFire(139)).toBe(false);
    expect(timer.tryFire(140)).toBe(true);
  });

  it('paces repeated shots at exactly one cooldown after each shot', () => {
    const timer = new FireTimer(140);
    timer.tryFire(140); // allowed from the initial state
    expect(timer.tryFire(279)).toBe(false);
    expect(timer.tryFire(280)).toBe(true);
  });

  it('is data-driven: a different cooldown changes the pacing', () => {
    const timer = new FireTimer(50);
    expect(timer.tryFire(0)).toBe(true);
    expect(timer.tryFire(49)).toBe(false);
    expect(timer.tryFire(50)).toBe(true);
  });
});
