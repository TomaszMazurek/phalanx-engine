import { describe, expect, it } from 'vitest';
import { DebugHUD } from './DebugHUD';

/**
 * DebugHUD contract — headless mode only (no DOM in the node test env).
 * The with-root branch (textContent mirror) is constructor glue covered by
 * visual acceptance, per the Wave D slice-2 task note.
 */
describe('DebugHUD', () => {
  it('converges to ~60 FPS after 60 frames of dt=1/60', () => {
    const hud = new DebugHUD();
    for (let frame = 0; frame < 60; frame++) {
      hud.update(1 / 60, 0.5, 1, true);
    }
    expect(Math.abs(hud.fps - 60)).toBeLessThan(2);
    expect(hud.text).toMatch(/^FPS 60 \|/);
  });

  it('converges to ~30 FPS after 30 frames of dt=1/30', () => {
    const hud = new DebugHUD();
    for (let frame = 0; frame < 30; frame++) {
      hud.update(1 / 30, 0.25, 2, false);
    }
    expect(Math.abs(hud.fps - 30)).toBeLessThan(1.5);
  });

  it('reflects the last update: steps, alpha (two decimals), interp ON/OFF', () => {
    const hud = new DebugHUD();
    hud.update(1 / 60, 0.42, 3, false);
    expect(hud.text).toBe('FPS 60 | steps 3 | alpha 0.42 | interp OFF');

    hud.update(1 / 60, 1, 0, true);
    expect(hud.text).toBe('FPS 60 | steps 0 | alpha 1.00 | interp ON');
  });

  /**
   * EMA spike robustness. Math for the bounds (FPS_SMOOTHING = α = 0.1):
   * the smoothed value moves toward each instant sample by α of the gap, so
   * a single dt=0.1 frame (instant 10 fps — exactly GameLoop.MAX_DELTA, the
   * largest unclamped frame production can produce) landing on a converged
   * 60 fps base yields exactly 0.9·60 + 0.1·10 = 55: one spike can never
   * move fps more than α·(instant − smoothed) = 5 here, so fps stays in the
   * derived [50, 60] band — far inside any [40, 80] flicker gate. The
   * residual error then decays geometrically, error(n) = 5·0.9ⁿ, giving
   * 5·0.9³⁰ ≈ 0.21 fps after 30 steady frames — reconverged to ~60.
   */
  it('one dt=0.1 spike dents fps by at most α of the gap, then it reconverges to ~60', () => {
    const hud = new DebugHUD();
    for (let frame = 0; frame < 60; frame++) {
      hud.update(1 / 60, 0.5, 1, true);
    }
    expect(hud.fps).toBeCloseTo(60, 9);

    hud.update(0.1, 0.5, 1, true); // the 100 ms spike
    expect(hud.fps).toBeGreaterThanOrEqual(50);
    expect(hud.fps).toBeLessThanOrEqual(60);
    expect(hud.fps).toBeCloseTo(55, 9); // 0.9·60 + 0.1·10, exactly

    for (let frame = 0; frame < 30; frame++) {
      hud.update(1 / 60, 0.5, 1, true);
    }
    expect(Math.abs(hud.fps - 60)).toBeLessThan(0.5);
  });

  it('guards dt<=0: fps stays NaN-free, other fields still update', () => {
    const hud = new DebugHUD();
    hud.update(0, 0.75, 2, true); // first frame, zero dt
    expect(Number.isFinite(hud.fps)).toBe(true);
    expect(hud.text).toBe('FPS 0 | steps 2 | alpha 0.75 | interp ON');

    hud.update(1 / 60, 0.75, 1, true); // recovers from the first valid frame
    expect(hud.text).toMatch(/^FPS 60 \|/);
  });
});
