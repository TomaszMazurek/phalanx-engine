import { describe, expect, it } from 'vitest';
import { Interpolated } from './Interpolated';

/**
 * Pins the scalar contract behind fixed-timestep rendering
 * (src/core/Interpolated.ts): read(alpha) lerps between the last two pushed
 * values, an untouched instance is frozen at its seeded initial, and push()
 * shifts current -> previous so read(0) always speaks the previous step.
 */
describe('Interpolated', () => {
  it('read(0) returns the previous value; read(alpha) lerps linearly toward current', () => {
    const interpolated = new Interpolated();
    interpolated.push(10);
    interpolated.push(20);

    expect(interpolated.read(0)).toBe(10);
    expect(interpolated.read(0.5)).toBe(15);
    expect(interpolated.read(0.999)).toBeCloseTo(19.99, 10);
  });

  it('before any push, read returns the seeded initial for any alpha', () => {
    expect(new Interpolated().read(0.5)).toBe(0); // default seed

    const seeded = new Interpolated(7);
    for (const alpha of [0, 0.25, 0.5, 0.999]) {
      expect(seeded.read(alpha)).toBe(7);
    }
    expect(seeded.value).toBe(7);
  });

  it('push shifts current -> previous, so read(0) speaks the middle value', () => {
    const interpolated = new Interpolated();
    interpolated.push(1);
    interpolated.push(2);
    interpolated.push(3);

    expect(interpolated.read(0)).toBe(2); // previous step, not the oldest
    expect(interpolated.value).toBe(3); // .value is the raw latest, no lerp
  });

  it('constant-delta accumulation stays monotonic across sampled alphas', () => {
    const interpolated = new Interpolated(0);
    let last = Number.NEGATIVE_INFINITY;

    for (let step = 1; step <= 5; step += 1) {
      interpolated.push(step * 10);
      for (const alpha of [0, 0.25, 0.5, 0.75, 0.999]) {
        const value = interpolated.read(alpha);
        expect(value).toBeGreaterThanOrEqual(last);
        last = value;
      }
    }
  });
});
