import type { System } from './System';

/**
 * Engine — minimal Phase 1 bootstrap (task 2 of docs/phase-1-foundation.md).
 *
 * Owns:
 *  - system lifecycle: init → start → (update loop) → stop → dispose,
 *  - the frame loop: plain requestAnimationFrame with clamped delta time.
 *
 * Deliberately renderer-agnostic: this module must not import three.js
 * (plan decision #5). Fixed-timestep logic with interpolation is Phase 2
 * work — until then `update` receives a variable, clamped `dt`.
 */
export class Engine {
  private readonly systems: System[] = [];

  private running = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private elapsed = 0;

  /**
   * Delta-time clamp (seconds). Protects the simulation from huge jumps
   * after a background tab / breakpoint pause; also protects `dt = 0`
   * first-frame edge cases.
   */
  private static readonly MAX_DELTA = 0.1;

  /** Register systems in execution order. Chainable. */
  addSystem(...systems: System[]): this {
    if (this.running) {
      throw new Error('Engine.addSystem() called while engine is running');
    }
    this.systems.push(...systems);
    return this;
  }

  /** Initialize all systems in registration order. */
  async init(): Promise<void> {
    for (const system of this.systems) {
      await system.init?.();
    }
  }

  /** Start the frame loop. Idempotent. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();

    for (const system of this.systems) {
      system.start?.();
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Stop the frame loop. Systems keep their state — `start()` can resume. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const system of this.systems) {
      system.stop?.();
    }
  }

  /** Stop and permanently tear down all systems. */
  dispose(): void {
    this.stop();
    for (const system of this.systems) {
      system.dispose?.();
    }
    this.systems.length = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min((now - this.lastFrameTime) / 1000, Engine.MAX_DELTA);
    this.lastFrameTime = now;
    this.elapsed += dt;

    for (const system of this.systems) {
      system.update?.(dt, this.elapsed);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}
