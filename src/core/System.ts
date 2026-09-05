/**
 * System contract — the engine's extension point.
 *
 * A System is any self-contained piece of engine functionality (rendering,
 * input, physics, asset streaming, ...). The Engine owns the lifecycle; the
 * System only reacts. Systems must not depend on each other directly —
 * communication goes through the owning scene/app (Phase 2: EventBus).
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
   * Called once per frame with the frame delta time in seconds.
   * Variable timestep for now — fixed-timestep simulation with interpolation
   * is Phase 2 work (see docs/phase-1-foundation.md, task 2).
   */
  update?(dt: number, elapsed: number): void;

  /** Called when the engine stops. */
  stop?(): void;

  /** Called once, on engine disposal — free resources here. */
  dispose?(): void;
}
