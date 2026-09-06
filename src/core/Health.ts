/**
 * Health — system-agnostic damage/heal value object (Game 1, Sprint 0:
 * docs/games/GAME-1-plan.md, "combat (damage/health)").
 *
 * Deliberately tiny and engine-generic: no owner, no events, no game
 * concepts. A Health instance is a clamped [0, max] pool; the game decides
 * what "dying" means (round end, respawn, animation) by reacting to the
 * boolean returned by `damage`/`kill`.
 *
 * Clamp semantics (both directions):
 *  - damage never goes below 0 (overkill stays at exactly 0);
 *  - heal never goes above max (no overheal; v1 keeps the pool minimal —
 *    a future shield/overheal layer would be a separate concept, not a flag);
 *  - negative amounts are clamped to 0, i.e. damage(-x) / heal(-x) are no-ops.
 *
 * Death is derived (`current <= 0`), not stored: `heal` from 0 revives, and
 * `reset()` is the sanctioned full revive. `damage` returns true only on the
 * alive → dead transition of THAT call — overkill on a living pool reports
 * once, further damage on a dead pool reports false.
 */
export class Health {
  readonly max: number;

  private currentHealth: number;

  constructor(max: number, current: number = max) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new RangeError(`Health: max must be a positive finite number, got ${max}`);
    }
    this.max = max;
    this.currentHealth = Math.min(max, Math.max(0, current));
  }

  /** Current health, always within [0, max]. */
  get current(): number {
    return this.currentHealth;
  }

  /** Health fraction in [0, 1] — ready for HUD bars. */
  get ratio(): number {
    return this.currentHealth / this.max;
  }

  /** True when the pool is empty. Derived, so healing revives. */
  get isDead(): boolean {
    return this.currentHealth <= 0;
  }

  /**
   * Apply damage. Returns true if and only if this call killed the pool
   * (alive → dead transition) — overkill counts, repeat hits on a corpse
   * do not.
   */
  damage(amount: number): boolean {
    const clamped = Math.max(0, amount);
    const wasAlive = this.currentHealth > 0;
    this.currentHealth = Math.max(0, this.currentHealth - clamped);
    return wasAlive && this.currentHealth <= 0;
  }

  /** Restore health, clamped at max (no overheal). Heals from 0 (revives). */
  heal(amount: number): void {
    const clamped = Math.max(0, amount);
    this.currentHealth = Math.min(this.max, this.currentHealth + clamped);
  }

  /** Empty the pool immediately. Idempotent. */
  kill(): void {
    this.currentHealth = 0;
  }

  /** Full revive: back to max, regardless of previous state. */
  reset(): void {
    this.currentHealth = this.max;
  }
}
