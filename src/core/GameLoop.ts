/**
 * GameLoop — fixed-timestep loop with render interpolation
 * ("Fix Your Timestep!", Glenn Fiedler — docs/phase-2-core.md, task 1).
 *
 * Per rendered frame:
 *   1. accumulate the frame delta,
 *   2. run `onFixedStep(FIXED_DT)` while the accumulator covers whole steps
 *      (capped at MAX_SUBSTEPS to stop the spiral of death),
 *   3. call `onFrame(dt, alpha)` with the leftover fraction `alpha`.
 *
 * Systems then render at the alpha between the last two simulation states,
 * which decouples simulation rate from display refresh (60 Hz logic on a
 * 144 Hz panel, or the reverse, both without stutter).
 *
 * Pure TypeScript, no rendering dependencies — the Engine wires systems into
 * the two callbacks; the loop only owns timing.
 */

/** Phases the GameLoop drives. Wired by the Engine (composition root). */
export interface GameLoopCallbacks {
  /** One deterministic simulation step of `fixedDt` seconds. */
  onFixedStep(fixedDt: number): void;
  /** One rendered frame. `alpha` is the interpolation fraction in [0, 1). */
  onFrame(dt: number, alpha: number): void;
}

export class GameLoop {
  /** Fixed simulation step, seconds. 60 Hz logic. */
  static readonly FIXED_DT = 1 / 60;

  /** Substep cap per frame. 5 × FIXED_DT ≈ 83 ms of catch-up budget. */
  static readonly MAX_SUBSTEPS = 5;

  /**
   * Frame delta clamp, seconds. Protects the accumulator from huge jumps
   * after a background tab / breakpoint pause (spiral-of-death guard #1;
   * the substep cap is guard #2, the panic reset is guard #3).
   */
  static readonly MAX_DELTA = 0.1;

  private readonly callbacks: GameLoopCallbacks;

  private running = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private accumulator = 0;
  private warnedPanic = false;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
  }

  /** Start the loop. Idempotent. Resets timing state and the panic flag. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.accumulator = 0;
    this.warnedPanic = false;
    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop the loop. Timing state is kept — `start()` resets it anyway. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min((now - this.lastFrameTime) / 1000, GameLoop.MAX_DELTA);
    this.lastFrameTime = now;

    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= GameLoop.FIXED_DT && steps < GameLoop.MAX_SUBSTEPS) {
      this.callbacks.onFixedStep(GameLoop.FIXED_DT);
      this.accumulator -= GameLoop.FIXED_DT;
      steps++;
    }

    // Panic guard: even after MAX_SUBSTEPS we cannot catch up (sustained
    // overload). Ditch the backlog instead of freezing behind it, and warn
    // once per run (a flag, not per-frame spam).
    if (this.accumulator >= GameLoop.FIXED_DT) {
      this.accumulator = 0;
      if (!this.warnedPanic) {
        console.warn(
          `[GameLoop] panic: frame took >${GameLoop.MAX_SUBSTEPS} fixed steps; ` +
            `simulation time dropped to stay in sync with the render rate.`,
        );
        this.warnedPanic = true;
      }
    }

    const alpha = this.accumulator / GameLoop.FIXED_DT;
    this.callbacks.onFrame(dt, alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };
}