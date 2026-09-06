import type { SceneLifecycleEvents } from '../scenes/Scene';

/**
 * GameEvents — the Phase 2 demo app's event map.
 *
 * Extends the SceneManager lifecycle events by INTERSECTION (the pattern
 * documented in scenes/Scene.ts): new keys only, shared keys keep identical
 * payload types, so an `EventBus<GameEvents>` assigns to
 * `SceneContext['events']` without casts.
 *
 * Navigation events ('menu/play', 'game/back') carry no business data — the
 * subscriber (main.ts) only switches scenes. `via` documents the trigger for
 * logging and future telemetry without pretending to more structure than
 * the demo has.
 */
export type GameEvents = SceneLifecycleEvents & {
  /** The menu's Play button was clicked — switch to the gameplay scene. */
  'menu/play': { via: 'ui' };
  /** The gameplay scene asked to return (Escape / pad binding) — back to menu. */
  'game/back': { via: 'input' };
};
