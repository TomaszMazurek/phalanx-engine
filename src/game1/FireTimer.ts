/**
 * FireTimer (Game 1, Sprint 0) — the hold-fire cooldown state machine,
 * pure over an explicit simulation clock in milliseconds (the weapon
 * system accumulates fixed-step time and owns the clock).
 */
export class FireTimer {
  private nextAllowedMs = 0;

  private readonly cooldownMs: number;

  constructor(cooldownMs: number) {
    if (!Number.isFinite(cooldownMs) || cooldownMs <= 0) {
      throw new RangeError(`FireTimer: cooldownMs must be a positive finite number, got ${cooldownMs}`);
    }
    this.cooldownMs = cooldownMs;
  }

  /**
   * Try to fire at simulation time `nowMs`: true (and the cooldown starts)
   * when allowed, false while cooling down. Fresh timers can fire at t=0.
   */
  tryFire(nowMs: number): boolean {
    if (nowMs < this.nextAllowedMs) return false;
    this.nextAllowedMs = nowMs + this.cooldownMs;
    return true;
  }
}
