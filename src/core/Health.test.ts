import { describe, expect, it } from 'vitest';
import { Health } from './Health';

/**
 * Pins the Health value-object contract (src/core/Health.ts): clamped
 * damage/heal semantics, "died on this call" reporting, ratio, and reset()
 * as the only sanctioned revive. Engine-generic — no game concepts here.
 */
describe('Health', () => {
  it('defaults current to max; ratio 1; alive', () => {
    const health = new Health(100);
    expect(health.max).toBe(100);
    expect(health.current).toBe(100);
    expect(health.ratio).toBe(1);
    expect(health.isDead).toBe(false);
  });

  it('accepts an explicit current, clamped into [0, max]', () => {
    expect(new Health(100, 40).current).toBe(40);
    expect(new Health(100, 150).current).toBe(100); // no overheal at birth
    expect(new Health(100, -5).current).toBe(0); // no negative at birth
  });

  it('rejects invalid max (non-positive or non-finite)', () => {
    expect(() => new Health(0)).toThrow(RangeError);
    expect(() => new Health(-10)).toThrow(RangeError);
    expect(() => new Health(Number.NaN)).toThrow(RangeError);
    expect(() => new Health(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('damage reduces current and returns true only on the killing call', () => {
    const health = new Health(100);
    expect(health.damage(30)).toBe(false);
    expect(health.current).toBe(70);
    expect(health.damage(70)).toBe(true); // exactly lethal
    expect(health.current).toBe(0);
    expect(health.isDead).toBe(true);
  });

  it('damage(0) is a no-op that reports no death', () => {
    const health = new Health(50);
    expect(health.damage(0)).toBe(false);
    expect(health.current).toBe(50);
    expect(health.isDead).toBe(false);
  });

  it('overkill clamps at 0 — never negative; further damage reports no new death', () => {
    const health = new Health(10);
    expect(health.damage(1000)).toBe(true); // died this call
    expect(health.current).toBe(0);
    expect(health.damage(50)).toBe(false); // already dead — no transition
    expect(health.current).toBe(0);
  });

  it('heal restores health but clamps at max (no overheal)', () => {
    const health = new Health(100, 40);
    health.heal(30);
    expect(health.current).toBe(70);
    health.heal(999);
    expect(health.current).toBe(100);
    expect(health.ratio).toBe(1);
  });

  it('heal(0) on a full bar is a no-op', () => {
    const health = new Health(100);
    health.heal(0);
    expect(health.current).toBe(100);
  });

  it('heal works from 0 — dead health comes back alive', () => {
    const health = new Health(100);
    health.kill();
    expect(health.isDead).toBe(true);
    health.heal(25);
    expect(health.current).toBe(25);
    expect(health.isDead).toBe(false);
    expect(health.ratio).toBe(0.25);
  });

  it('kill() zeroes current from any state', () => {
    const health = new Health(100, 60);
    health.kill();
    expect(health.current).toBe(0);
    expect(health.isDead).toBe(true);
    health.kill(); // idempotent
    expect(health.current).toBe(0);
  });

  it('reset() revives to full max', () => {
    const health = new Health(80, 10);
    health.damage(10);
    health.reset();
    expect(health.current).toBe(80);
    expect(health.ratio).toBe(1);
    expect(health.isDead).toBe(false);
  });
});
