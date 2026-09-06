import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus';

/**
 * Pins the EventBus delivery contract (src/core/EventBus.ts):
 * snapshot iteration (subscribe/unsubscribe during emit affects only future
 * emissions), once() unregister-before-invoke (re-entrancy safe), idempotent
 * unsubscribe, and listenerCount() as the leak diagnostics surface.
 *
 * Note on throwing handlers: the implementation DOCUMENTS (emit JSDoc) that
 * exceptions are not caught and later snapshot members are skipped. These
 * tests pin that documented behavior — the bus deliberately does not swallow
 * or isolate handler errors.
 */
// Type alias, not interface: only aliases get the implicit index signature
// that EventBus's `Record<string, unknown>` constraint requires.
type TestEvents = {
  ping: { seq: number };
  greet: { who: string };
};

describe('EventBus', () => {
  it('delivers payloads to subscribers of the emitted key only', () => {
    const bus = new EventBus<TestEvents>();
    const pings: number[] = [];
    const greets: string[] = [];

    bus.on('ping', ({ seq }) => pings.push(seq));
    bus.on('greet', ({ who }) => greets.push(who));

    bus.emit('ping', { seq: 1 });
    bus.emit('greet', { who: 'scene' });

    expect(pings).toEqual([1]);
    expect(greets).toEqual(['scene']);
  });

  it('emitting an event with no subscribers is a no-op', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.emit('ping', { seq: 0 })).not.toThrow();
  });

  it('the returned unsubscribe is idempotent', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const unsubscribe = bus.on('ping', handler);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow(); // second call: no-op, not an error
    bus.emit('ping', { seq: 1 });

    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('emit iterates a snapshot: a handler subscribing during emit misses the current event', () => {
    const bus = new EventBus<TestEvents>();
    const log: string[] = [];

    bus.on('ping', () => {
      log.push('first');
      bus.on('ping', () => log.push('late-joiner')); // joins mid-emit
    });
    bus.on('ping', () => log.push('second'));

    bus.emit('ping', { seq: 1 });
    expect(log).toEqual(['first', 'second']); // late joiner skipped for this emit

    bus.emit('ping', { seq: 2 });
    expect(log).toEqual(['first', 'second', 'first', 'second', 'late-joiner']);
  });

  it('emit iterates a snapshot: unsubscribing a later listener during emit does not cancel it for this emit', () => {
    const bus = new EventBus<TestEvents>();
    const log: string[] = [];

    let unsubscribeB: () => void = () => {};
    const unsubscribeA = bus.on('ping', () => {
      log.push('A');
      unsubscribeB(); // removes B mid-emit — B was already snapshotted
    });
    unsubscribeB = bus.on('ping', () => log.push('B'));

    bus.emit('ping', { seq: 1 });
    expect(log).toEqual(['A', 'B']); // B fires this time despite the mid-emit off

    bus.emit('ping', { seq: 2 });
    expect(log).toEqual(['A', 'B', 'A']); // B is gone from the next emit
    unsubscribeA();
  });

  it('once fires exactly once even when the handler re-emits the same event re-entrantly', () => {
    const bus = new EventBus<TestEvents>();
    let fires = 0;

    bus.once('ping', (payload) => {
      fires += 1;
      if (payload.seq < 3) {
        bus.emit('ping', { seq: payload.seq + 1 }); // classic double-fire trap
      }
    });

    bus.emit('ping', { seq: 1 });
    expect(fires).toBe(1);
    expect(bus.listenerCount('ping')).toBe(0); // unregistered BEFORE invoking
  });

  it('once can be cancelled via its returned function; off(original) is a no-op (the bus stores the wrapper)', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();

    const cancel = bus.once('ping', handler);
    expect(() => bus.off('ping', handler)).not.toThrow(); // documented no-op
    cancel(); // the real way to cancel a once before delivery

    bus.emit('ping', { seq: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('off of a never-subscribed handler is a no-op', () => {
    const bus = new EventBus<TestEvents>();
    expect(() => bus.off('ping', () => {})).not.toThrow();
  });

  it('listenerCount reports per-key and total counts (0 for unknown keys)', () => {
    const bus = new EventBus<TestEvents>();
    expect(bus.listenerCount()).toBe(0);

    const unsubscribeFirst = bus.on('ping', () => {});
    bus.on('ping', () => {});
    bus.on('greet', () => {});

    expect(bus.listenerCount('ping')).toBe(2);
    expect(bus.listenerCount('greet')).toBe(1);
    expect(bus.listenerCount('unknown' as keyof TestEvents)).toBe(0);
    expect(bus.listenerCount()).toBe(3);

    unsubscribeFirst();
    expect(bus.listenerCount('ping')).toBe(1);
    expect(bus.listenerCount()).toBe(2);
  });

  it('a throwing handler propagates its error and later snapshot members are skipped (documented contract)', () => {
    // Source contract (EventBus.emit JSDoc): exceptions are NOT caught — the
    // error propagates out of emit and later subscribers in the SAME emit are
    // skipped. The tasking brief expected later handlers to still fire; the
    // implementation deliberately does the opposite, so this pins the
    // documented behavior instead of "fixing" the source.
    const bus = new EventBus<TestEvents>();
    const log: string[] = [];

    const unsubscribeThrower = bus.on('ping', () => {
      log.push('throws');
      throw new Error('boom');
    });
    bus.on('ping', () => log.push('after'));

    expect(() => bus.emit('ping', { seq: 1 })).toThrow('boom');
    expect(log).toEqual(['throws']); // 'after' was skipped for this emit

    // Recovery is the subscriber ecosystem's job: remove the broken listener
    // and the bus keeps working for everyone else.
    unsubscribeThrower();
    bus.emit('ping', { seq: 2 });
    expect(log).toEqual(['throws', 'after']);
  });
});
