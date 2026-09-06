import type { System } from '../core/System';
import type { Scene, SceneContext } from './Scene';

/**
 * SceneProgressUI — the progress surface of an async scene switch
 * (Phase 2, docs/phase-2-core.md, task 4).
 *
 * SceneManager stays DOM-free; the app adapts its overlay (e.g.
 * editor/LoadingOverlay — Wave D wraps `show()` as `root.classList.remove`).
 * `setProgress` receives a ratio clamped to [0, 1].
 */
export interface SceneProgressUI {
  show(): void;
  setProgress(ratio: number): void;
  hide(): void;
}

/** A mounted scene plus the systems created from it. */
interface MountedScene {
  readonly scene: Scene;
  readonly systems: System[];
}

/**
 * SceneManager — asynchronous scene switching with background preloading
 * (Phase 2, docs/phase-2-core.md, task 4).
 *
 * Registered ONCE in the Engine as a regular System; it manages the active
 * scene's systems itself and forwards `fixedUpdate`/`update` to them. This
 * sidesteps the Engine.addSystem()-throws-while-running constraint without
 * the Engine ever learning what a scene is (Engine stays the composition
 * root; SceneManager is the scene container).
 *
 * NOT generic over the app's event map, on purpose: emitting lifecycle
 * payloads through a generic `EventMap extends SceneLifecycleEvents` cannot
 * be done without casts (the app's payload could be a narrower subtype of
 * the base one). Instead the app widens the map by intersection (see
 * Scene.ts) — shared keys keep identical payload types, so its bus assigns
 * to `SceneContext['events']` structurally. Zero casts, zero variance holes.
 *
 * Switch flow (`switchTo`), the whole flow holds a `pending` slot so a second
 * request during a switch is IGNORED (plan trap #6, "ignore" strategy —
 * simplest and deterministic):
 *
 *   1. preload the next scene in the background — the current scene keeps
 *      rendering and simulating; progress goes to SceneProgressUI;
 *   2. mount atomically: create the new systems, swap the `mounted` pointer
 *      and raise the `entering` gate. The gate stops ALL delegation (the old
 *      scene must not tick after exit, the new one must not tick before
 *      enter) — and because the pointer swap itself is synchronous, no rAF
 *      tick can ever observe a half-swapped state;
 *   3. phase out the old scene: exit() (≠ dispose, plan trap #5);
 *   4. bring up the new scene: init() awaited per system → start() when the
 *      loop is running → enter();
 *   5. lower the gate, hide the progress UI, then — and only then — stop and
 *      dispose the old scene and its systems (dispose AFTER the successor
 *      is fully up).
 *
 * Failure: if preload or mounting throws, the current scene stays active
 * (or, for a failed first mount, the manager is simply empty), the progress
 * UI is hidden and a descriptive error — with the original as `cause` — is
 * rethrown to the `switchTo` caller.
 */
export class SceneManager implements System {
  readonly name = 'scene-manager';

  private readonly context: SceneContext;
  private readonly progressUI: SceneProgressUI;

  private mounted: MountedScene | null = null;
  private pending: Scene | null = null;
  private initialScene: Scene | null = null;
  /** True while a scene is being mounted (systems initializing). */
  private entering = false;
  private running = false;

  constructor(context: SceneContext, progressUI: SceneProgressUI) {
    this.context = context;
    this.progressUI = progressUI;
  }

  // === Public API ===

  /**
   * Scene to mount during `init()` — before the engine starts, so the first
   * `start()` finds it fully entered and the app never renders an empty
   * frame. Ignored (warned) once a scene is mounted or loading.
   */
  setInitialScene(scene: Scene): void {
    if (this.mounted || this.pending) {
      console.warn(
        `[SceneManager] setInitialScene("${scene.id}") ignored — a scene is already mounted or loading`,
      );
      return;
    }
    this.initialScene = scene;
  }

  /** Switch to `scene`; see the class doc for the flow and failure policy. */
  async switchTo(scene: Scene): Promise<void> {
    if (this.pending || this.entering) {
      console.info(
        `[SceneManager] switch to "${scene.id}" ignored — another switch is in flight`,
      );
      return;
    }
    if (this.mounted?.scene === scene) {
      console.info(`[SceneManager] switch to "${scene.id}" ignored — already active`);
      return;
    }

    this.pending = scene;
    this.context.events.emit('scene/switchStarted', { sceneId: scene.id });
    this.progressUI.show();
    this.progressUI.setProgress(0);

    try {
      await scene.preload((ratio) => {
        this.progressUI.setProgress(clamp01(ratio));
      });
      // Stale guard: the manager was disposed (or reset) mid-preload.
      if (this.pending !== scene) return;
      await this.mount(scene);
    } catch (error) {
      this.progressUI.hide();
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`SceneManager: switch to "${scene.id}" failed: ${detail}`, {
        cause: error,
      });
    } finally {
      if (this.pending === scene) {
        this.pending = null;
      }
    }
  }

  /** Id of the active scene (or null before the first mount). */
  get activeSceneId(): string | null {
    return this.mounted?.scene.id ?? null;
  }

  /** True while a switch is in flight (preload or mount phase). */
  get isSwitching(): boolean {
    return this.pending !== null || this.entering;
  }

  // === System lifecycle (SceneManager is an Engine-registered System) ===

  async init(): Promise<void> {
    if (!this.initialScene) return;
    const initial = this.initialScene;
    this.initialScene = null;
    await this.switchTo(initial);
  }

  start(): void {
    this.running = true;
    if (!this.mounted) return;
    for (const system of this.mounted.systems) {
      system.start?.();
    }
  }

  stop(): void {
    this.running = false;
    if (!this.mounted) return;
    for (const system of this.mounted.systems) {
      system.stop?.();
    }
  }

  fixedUpdate(fixedDt: number): void {
    if (!this.mounted || this.entering) return;
    for (const system of this.mounted.systems) {
      system.fixedUpdate?.(fixedDt);
    }
  }

  update(dt: number, alpha: number): void {
    if (!this.mounted || this.entering) return;
    for (const system of this.mounted.systems) {
      system.update?.(dt, alpha);
    }
  }

  dispose(): void {
    // Drop an in-flight switch: its scene was never entered, so it is not
    // ours to dispose. The stale guard in switchTo() aborts it silently.
    this.pending = null;
    this.initialScene = null;
    this.entering = false;
    if (!this.mounted) return;
    for (const system of this.mounted.systems) {
      system.dispose?.();
    }
    this.mounted.scene.dispose?.();
    this.mounted = null;
  }

  // === Internals ===

  /**
   * Mount `scene` over the current one. The pointer swap is synchronous, so
   * delegation never sees a half-swapped state; the `entering` gate (checked
   * in fixedUpdate/update) covers the async remainder: from old.exit() until
   * new.enter() no scene ticks — the old one because it is swapped out, the
   * new one because it is not ready. The old scene is stopped and disposed
   * only after the successor is fully up (plan trap #5).
   */
  private async mount(scene: Scene): Promise<void> {
    const old = this.mounted;
    // May throw (scene factory code) — then nothing has been touched yet.
    const systems = scene.createSystems();

    this.mounted = { scene, systems };
    this.entering = true;

    try {
      if (old) {
        old.scene.exit?.();
        this.context.events.emit('scene/exited', { sceneId: old.scene.id });
      }

      for (const system of systems) {
        await system.init?.();
        // Stale guard: the manager was disposed while initializing systems.
        if (this.mounted?.scene !== scene) return;
      }
      if (this.running) {
        for (const system of systems) {
          system.start?.();
        }
      }
      scene.enter?.();
      this.context.events.emit('scene/entered', { sceneId: scene.id });
      this.progressUI.hide();
      this.entering = false;
    } finally {
      if (old) {
        for (const system of old.systems) {
          system.stop?.();
        }
        old.scene.dispose?.();
      }
      if (this.entering && this.mounted?.scene === scene) {
        // Mount failed mid-flight: lower the gate so the (broken) scene at
        // least keeps ticking — the error has already traveled to the caller.
        this.entering = false;
      }
    }
  }
}

/** Clamp a preload progress ratio into [0, 1]. */
function clamp01(ratio: number): number {
  return Math.min(1, Math.max(0, ratio));
}