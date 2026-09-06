import type { EventBus } from '../core/EventBus';
import type { InputSystem } from '../core/InputSystem';
import type { System } from '../core/System';

/**
 * Scene lifecycle events, emitted by SceneManager through the app's EventBus
 * (Phase 2, docs/phase-2-core.md, task 4). Kept minimal on purpose.
 *
 * A TYPE ALIAS, not an interface: EventBus constrains its map to
 * `Record<string, unknown>` and interfaces lack the implicit index signature
 * that type literals get — `EventBus<SomeInterface>` would not compile.
 *
 * Apps extend it by INTERSECTION (new keys only — do not narrow the lifecycle
 * payloads, the bus stores handlers in Sets and a narrowed payload breaks
 * handler variance):
 *
 * ```ts
 * type GameEvents = SceneLifecycleEvents & {
 *   'player:died': { respawnIn: number };
 * };
 *
 * const bus = new EventBus<GameEvents>();
 * ```
 *
 * `bus` is assignable to `SceneContext['events']`: the shared keys carry
 * identical payload types after the intersection, so the structural check
 * (including EventBus's private handler Sets) passes — no casts anywhere.
 */
export type SceneLifecycleEvents = {
  /** A scene switch was accepted; preload started (or finished instantly). */
  'scene/switchStarted': { sceneId: string };
  /** A scene finished mounting (systems initialized and entered). */
  'scene/entered': { sceneId: string };
  /** A scene stopped being active; its successor is mounted. */
  'scene/exited': { sceneId: string };
};

/**
 * SceneContext — what the app hands to every scene (constructor DI).
 *
 * `events` is the app-wide bus: SceneManager emits the lifecycle events
 * above on it and scenes subscribe/publish their own (through the app's
 * extended, wider-typed view). `input` is the shared InputSystem — register
 * it LAST among engine systems (see its class doc for the edge-ordering
 * contract). AssetManager joins this context in Wave C; until then scenes
 * receive already-loaded resources via their constructors.
 */
export interface SceneContext {
  readonly events: EventBus<SceneLifecycleEvents>;
  readonly input: InputSystem;
}

/**
 * Scene — a factory of systems plus the scene's own resources
 * (plan decision: "sceny nie są Systemami — to kontenery systemów").
 * SceneManager drives the whole cycle:
 *
 *   preload        background; the current scene keeps rendering/ticking
 *      ↓
 *   createSystems  → init() awaited per system → start() when the loop runs
 *      ↓            → enter()
 *   running        systems receive fixedUpdate/update through SceneManager
 *      ↓
 *   exit           stopped being active; successor is mounted
 *      ↓
 *   dispose        after the successor is fully up — permanent teardown
 *
 * exit vs dispose (plan trap #5): exit means "no longer active", dispose
 * means "gone for good". Switching back does NOT reuse the instance — the
 * app creates a fresh Scene object (or, from Wave C on, an asset cache may
 * make the re-preload instant).
 */
export abstract class Scene {
  /** Stable identifier — diagnostics, lifecycle events, debug tooling. */
  abstract readonly id: string;

  /**
   * Load scene resources in the background; report progress in [0, 1].
   * The default implementation has nothing to load and resolves immediately.
   * Rejections propagate: SceneManager stays on the current scene and the
   * error travels to the `switchTo` caller.
   */
  async preload(_onProgress: (ratio: number) => void): Promise<void> {}

  /** Systems of this scene, in execution order. Called once, when mounting. */
  abstract createSystems(): System[];

  /** The scene became active (systems initialized and started). */
  enter?(): void;

  /** The scene stopped being active (its successor is mounted). */
  exit?(): void;

  /** Permanent teardown — free listeners, GPU resources, etc. */
  dispose?(): void;
}