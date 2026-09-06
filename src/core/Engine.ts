import type { System } from './System';
import { GameLoop } from './GameLoop';

/**
 * Engine — composition root and system lifecycle (Phase 2 refactor).
 *
 * The Engine owns: system registration, lifecycle (init → start → stop →
 * dispose) and the wiring of systems into the GameLoop's two phases. It no
 * longer owns the frame loop itself — that moved to GameLoop (fixed timestep
 * with interpolation, "Fix Your Timestep"); the Engine is renderer-agnostic
 * and must never import three.js (plan decision #5).
 */
export class Engine {
  private readonly systems: System[] = [];
  private readonly loop: GameLoop;

  constructor() {
    this.loop = new GameLoop({
      onFixedStep: (fixedDt) => {
        for (const system of this.systems) {
          system.fixedUpdate?.(fixedDt);
        }
      },
      onFrame: (dt, alpha) => {
        for (const system of this.systems) {
          system.update?.(dt, alpha);
        }
      },
    });
  }

  /** Register systems in execution order. Chainable. */
  addSystem(...systems: System[]): this {
    if (this.loop.isRunning) {
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

  /** Start the fixed-timestep loop. Idempotent. */
  start(): void {
    if (this.loop.isRunning) return;
    for (const system of this.systems) {
      system.start?.();
    }
    this.loop.start();
  }

  /** Stop the loop. Systems keep their state — `start()` can resume. */
  stop(): void {
    this.loop.stop();
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
    return this.loop.isRunning;
  }
}