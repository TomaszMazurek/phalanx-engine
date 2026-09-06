import { describe, expect, it } from 'vitest';
import { TraumaShake } from './CameraShake';

/**
 * Pins the PURE TraumaShake math (src/render/CameraShake.ts): amplitude is
 * maxShake · trauma² driven by sin/cos combos of the time input — zero at
 * rest, bounded by maxShake, exactly quadratic in trauma, and decaying via
 * update(). applyToCamera is the thin three.js-touching half and is
 * untested by design.
 */

/** Runs `callback` over a dense time sweep — one screen-refresh-equivalent. */
function sweep(callback: (timeSeconds: number) => void): void {
  for (let index = 0; index <= 120; index += 1) {
    callback((index * (1 / 60)) / 2); // half-ticks → half-second sweep
  }
}

describe('TraumaShake', () => {
  it('offset is exactly zero at trauma 0', () => {
    const shake = new TraumaShake();
    sweep((timeSeconds) => {
      expect(shake.offsetAt(timeSeconds)).toEqual({ x: 0, y: 0 });
    });
  });

  it('offset components are bounded by maxShake at full trauma', () => {
    const maxShake = 0.35;
    const shake = new TraumaShake({ maxShake });
    shake.addTrauma(1);
    sweep((timeSeconds) => {
      const offset = shake.offsetAt(timeSeconds);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(maxShake);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(maxShake);
    });
  });

  it('amplitude scales with trauma squared, not linearly', () => {
    const full = new TraumaShake({ maxShake: 0.5 });
    full.addTrauma(1);
    const half = new TraumaShake({ maxShake: 0.5 });
    half.addTrauma(0.5);

    const timeSeconds = 0.123;
    const fullOffset = full.offsetAt(timeSeconds);
    const halfOffset = half.offsetAt(timeSeconds);
    // trauma 0.5 → amplitude factor 0.25 of the trauma-1 shake at any time
    expect(halfOffset.x).toBeCloseTo(fullOffset.x * 0.25, 12);
    expect(halfOffset.y).toBeCloseTo(fullOffset.y * 0.25, 12);
  });

  it('locks the parametric formula at t = 0 (x from sin, y from cos)', () => {
    const shake = new TraumaShake({ maxShake: 0.4 });
    shake.addTrauma(1);
    expect(shake.offsetAt(0)).toEqual({ x: 0, y: 0.4 });
  });

  it('addTrauma accumulates and clamps into [0, 1]; negative input is ignored', () => {
    const shake = new TraumaShake();
    expect(shake.trauma).toBe(0);
    shake.addTrauma(0.7);
    expect(shake.trauma).toBeCloseTo(0.7, 10);
    shake.addTrauma(0.7);
    expect(shake.trauma).toBe(1);
    shake.addTrauma(-0.5);
    expect(shake.trauma).toBe(1);
  });

  it('update(dt) decays trauma linearly toward 0 and never below', () => {
    const shake = new TraumaShake({ traumaDecay: 1 });
    shake.addTrauma(1);
    shake.update(0.5);
    expect(shake.trauma).toBeCloseTo(0.5, 10);
    shake.update(10); // far past empty
    expect(shake.trauma).toBe(0);
    expect(shake.offsetAt(1)).toEqual({ x: 0, y: 0 }); // decayed = still
  });

  it('offsetAt is pure: same state and time give identical results', () => {
    const shake = new TraumaShake();
    shake.addTrauma(0.8);
    const first = shake.offsetAt(0.321);
    const second = shake.offsetAt(0.321);
    expect(second).toEqual(first);
    expect(shake.trauma).toBeCloseTo(0.8, 10); // querying does not decay
  });

  it('x and y traces are incommensurate (not a single diagonal line)', () => {
    const shake = new TraumaShake({ maxShake: 1 });
    shake.addTrauma(1);
    const ratios: number[] = [];
    sweep((timeSeconds) => {
      const { x, y } = shake.offsetAt(timeSeconds);
      if (Math.abs(y) > 0.01) ratios.push(x / y);
    });
    const distinct = new Set(ratios.map((ratio) => ratio.toFixed(3)));
    expect(distinct.size).toBeGreaterThan(10); // phase space is 2-D, not a line
  });
});
