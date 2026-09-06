/**
 * System contract v2 — the engine's extension point (Phase 2).
 *
 * A System is any self-contained piece of engine functionality (rendering,
 * input, physics, asset streaming, ...). The Engine owns the lifecycle; the
 * System only reacts. Systems must not depend on each other directly —
 * communication goes through the owning scene/app.
 *
 * Breaking change vs Phase 1: `update(dt, elapsed)` became two methods.
 *  - `fixedUpdate(fixedDt)` — the deterministic simulation step. Called with
 *    a constant FIXED_DT, zero or more times per rendered frame (see GameLoop).
 *    All game logic belongs here.
 *  - `update(dt, alpha)` — per-frame work tied to the render rate: rendering,
 *    camera controls, input edge polling. `alpha` is the interpolation
 *    fraction of the current fixed step, in [0, 1); combine it with
 *    Interpolated snapshots to render smooth motion (see core/Interpolated.ts).
 *  - the old `elapsed` parameter is gone; systems that need wall-clock time
 *    keep their own accumulator in `fixedUpdate`.
 *
 * Phase 1 rule (docs/phase-1-foundation.md): no `any`, no globals.
 */
export interface System {
  /** Stable identifier, used for diagnostics and (later) ordering. */
  readonly name: string;

  /** Called once, before the first frame. May be async (asset loading). */
  init?(): void | Promise<void>;

  /** Called when the engine starts (after all systems initialized). */
  start?(): void;

  /**
   * Deterministic simulation step, constant `FIXED_DT` (1/60 s).
   * Called zero or more times per rendered frame — the GameLoop decides.
   */
  fixedUpdate?(fixedDt: number): void;

  /**
   * Per-frame work (render, input edges, camera).
   * `alpha` = accumulator / FIXED_DT, in [0, 1) — the interpolation fraction
   * between the last two fixed steps.
   */
  update?(dt: number, alpha: number): void;

  /** Called when the engine stops. */
  stop?(): void;

  /** Called once, on engine disposal — free resources here. */
  dispose?(): void;
}