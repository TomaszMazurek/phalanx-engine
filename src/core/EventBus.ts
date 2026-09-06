/**
 * EventBus — typed publish/subscribe channel for cross-system communication
 * (Phase 2, docs/phase-2-core.md: "komunikacja między systemami bez sprzężenia").
 *
 * Systems must not depend on each other directly (Phase 1 rule, src/core/System.ts);
 * they publish and subscribe through this bus instead. Typed over an `EventMap`
 * interface (event name → payload type), so every `emit`/`on` call is checked
 * against the declared contract — no stringly-typed magic.
 *
 * Leak discipline: `on()` returns an unsubscribe function and scenes/systems
 * MUST call it (or `off`) in `exit`/`dispose`. `listenerCount()` exists for
 * diagnostics — the phase acceptance criteria track listener leaks across
 * scene switches.
 *
 * Usage:
 * ```ts
 * interface GameEvents {
 *   'scene:entered': { sceneId: string };
 *   'enemy:killed': { points: number };
 * }
 *
 * const bus = new EventBus<GameEvents>();
 *
 * const unsubscribe = bus.on('enemy:killed', ({ points }) => {
 *   score.add(points);
 * });
 *
 * bus.emit('scene:entered', { sceneId: 'menu' });
 *
 * unsubscribe(); // call in dispose() — the bus never guesses lifetimes
 * ```
 */
/** Per-event handler storage. A mapped type keeps payload types airtight:
 * a `Map<keyof EventMap, Set<Handler>>` would force a contravariance cast
 * when calling handlers, this does not. */
type ListenerMap<EventMap extends Record<string, unknown>> = {
  [K in keyof EventMap]?: Set<(payload: EventMap[K]) => void>;
};

export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly listeners: ListenerMap<EventMap> = {};

  /**
   * Subscribe to an event. Returns an idempotent unsubscribe function —
   * store it and call it in `exit`/`dispose` (see leak discipline above).
   */
  on<K extends keyof EventMap>(key: K, handler: (payload: EventMap[K]) => void): () => void {
    this.channel(key).add(handler);
    return () => {
      this.off(key, handler);
    };
  }

  /**
   * Subscribe for a single delivery. Unregisters BEFORE invoking, so a
   * re-entrant `emit` of the same event from inside the handler does not
   * double-fire. Use the returned function to cancel before first delivery.
   */
  once<K extends keyof EventMap>(key: K, handler: (payload: EventMap[K]) => void): () => void {
    const wrapped = (payload: EventMap[K]): void => {
      this.off(key, wrapped);
      handler(payload);
    };
    return this.on(key, wrapped);
  }

  /** Precise removal of a previously subscribed handler. Removing an unknown
   * handler (or from an event with no listeners) is a no-op. Note: a `once`
   * subscription can only be cancelled via the function it returned — the
   * bus stores the wrapper, not the original handler. */
  off<K extends keyof EventMap>(key: K, handler: (payload: EventMap[K]) => void): void {
    this.listeners[key]?.delete(handler);
  }

  /**
   * Deliver an event to all current subscribers. Iterates a snapshot of the
   * handler list, so subscribing/unsubscribing from inside a handler (during
   * the emit) is safe and affects only future emissions. Handler exceptions
   * are not caught — a broken subscriber should be visible in the console,
   * not silently swallowed; later subscribers in the same emit are skipped
   * after a throw (keep handlers side-effect-isolated).
   */
  emit<K extends keyof EventMap>(key: K, payload: EventMap[K]): void {
    const channel = this.listeners[key];
    if (!channel) return;
    for (const handler of [...channel]) {
      handler(payload);
    }
  }

  /** Number of live subscriptions — total, or for one event. Grows between
   * scene switches ⇒ somebody forgot to unsubscribe. */
  listenerCount(key?: keyof EventMap): number {
    if (key !== undefined) {
      return this.listeners[key]?.size ?? 0;
    }
    let total = 0;
    for (const channel of Object.values(this.listeners)) {
      total += channel?.size ?? 0;
    }
    return total;
  }

  private channel<K extends keyof EventMap>(key: K): Set<(payload: EventMap[K]) => void> {
    const existing = this.listeners[key];
    if (existing) return existing;
    const created = new Set<(payload: EventMap[K]) => void>();
    this.listeners[key] = created;
    return created;
  }
}
