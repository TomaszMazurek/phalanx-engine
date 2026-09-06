import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Engine } from './Engine';
import type { System } from './System';

/**
 * Engine ↔ GameLoop wiring. The Engine owns systems + lifecycle and wires
 * them into the GameLoop's two phases; the loop owns timing. Node has no
 * deterministic requestAnimationFrame / performance.now, so these tests use
 * the same manual RAF driver as GameLoop.test.ts: a virtual clock the test
 * steps by hand, where `frame(dtMs)` fires the loop's pending callback with
 * `now + dtMs`, exactly like the browser firing one vsync. The loop's
 * self-re-registration keeps at most one callback queued, so `pendingCount`
 * doubles as a "loop is scheduled" probe and `cancelledIds` records every
 * cancelAnimationFrame the code under test issued.
 */
class ManualRaf {
  nowMs = 0;
  readonly cancelledIds: number[] = [];
  private nextId = 1;
  private readonly queue = new Map<number, FrameRequestCallback>();

  install(): void {
    vi.stubGlobal('performance', { now: (): number => this.nowMs });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = this.nextId++;
      this.queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      this.cancelledIds.push(id);
      this.queue.delete(id);
    });
  }

  /** Advance the clock by dtMs and fire the pending frame callback. */
  frame(dtMs: number): void {
    const entry = [...this.queue.entries()].pop();
    if (!entry) {
      throw new Error('ManualRaf.frame(): no pending RAF callback');
    }
    this.queue.delete(entry[0]);
    this.nowMs += dtMs;
    entry[1](this.nowMs);
  }

  get pendingCount(): number {
    return this.queue.size;
  }
}

/**
 * Recording fake system: one `name.event` log line per lifecycle/fan-out
 * event (ordering evidence), plus the (dt, alpha) pairs update() received.
 */
function makeRecordingSystem(
  name: string,
  log: string[],
  initGate?: Promise<void>,
): System & { updates: Array<[number, number]> } {
  const updates: Array<[number, number]> = [];
  return {
    name,
    updates,
    init: () => {
      log.push(`${name}.init`);
      return initGate;
    },
    start: () => {
      log.push(`${name}.start`);
    },
    fixedUpdate: () => {
      log.push(`${name}.fixedUpdate`);
    },
    update: (dt, alpha) => {
      log.push(`${name}.update`);
      updates.push([dt, alpha]);
    },
    stop: () => {
      log.push(`${name}.stop`);
    },
    dispose: () => {
      log.push(`${name}.dispose`);
    },
  };
}

describe('Engine', () => {
  let raf: ManualRaf;

  beforeEach(() => {
    raf = new ManualRaf();
    raf.install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registration order drives start, fixedUpdate (per step) and update(dt, alpha)', () => {
    const log: string[] = [];
    const a = makeRecordingSystem('a', log);
    const b = makeRecordingSystem('b', log);
    const engine = new Engine().addSystem(a, b);

    engine.start();
    // 50 ms = 0.05 s = 3 × FIXED_DT (see GameLoop.test.ts) → 3 steps + 1 frame.
    raf.frame(50);

    expect(log).toEqual([
      'a.start', 'b.start', // system.start before the loop spins up
      'a.fixedUpdate', 'b.fixedUpdate',
      'a.fixedUpdate', 'b.fixedUpdate',
      'a.fixedUpdate', 'b.fixedUpdate',
      'a.update', 'b.update',
    ]);
    // Both phases fan out in registration order, with the loop's values:
    expect(a.updates).toEqual([[0.05, a.updates[0]![1]]]);
    expect(b.updates).toEqual(a.updates); // same (dt, alpha) to every system
    expect(a.updates[0]![1]).toBeCloseTo(0, 10); // 50 ms leaves no leftover → alpha ~0
  });

  it('addSystem() after start() throws', () => {
    const engine = new Engine();
    engine.start();
    expect(engine.isRunning).toBe(true);
    expect(() => engine.addSystem({ name: 'late' })).toThrowError(
      'Engine.addSystem() called while engine is running',
    );
    engine.stop();
  });

  it('stop() is idempotent, cancels the RAF and stops systems in order', () => {
    const log: string[] = [];
    const engine = new Engine().addSystem(makeRecordingSystem('a', log), makeRecordingSystem('b', log));

    engine.start();
    raf.frame(50); // 3 fixed steps land before the stop
    engine.stop();
    expect(log.slice(-2)).toEqual(['a.stop', 'b.stop']); // stopped in registration order

    engine.stop(); // second call is a no-op for the loop — not an error
    expect(engine.isRunning).toBe(false);
    expect(raf.cancelledIds).toHaveLength(1); // exactly one cancelAnimationFrame
    expect(raf.pendingCount).toBe(0); // nothing left to fire
    expect(log.filter((entry) => entry === 'a.fixedUpdate')).toHaveLength(3); // no frames after stop

    // Restart registers a fresh frame callback; stopping cancels that one too.
    engine.start();
    expect(raf.pendingCount).toBe(1);
    engine.stop();
    expect(raf.cancelledIds).toHaveLength(2);
  });

  it('dispose() stops the loop, disposes systems in order and clears the registry', () => {
    const log: string[] = [];
    const engine = new Engine().addSystem(makeRecordingSystem('a', log), makeRecordingSystem('b', log));

    engine.start();
    engine.dispose();

    expect(engine.isRunning).toBe(false);
    expect(raf.cancelledIds).toHaveLength(1); // the running loop was stopped
    expect(log).toEqual([
      'a.start', 'b.start',
      'a.stop', 'b.stop', // stop() inside dispose(), registration order
      'a.dispose', 'b.dispose',
    ]);

    // Registry cleared: a subsequent start has no systems — the loop itself
    // runs (nothing harmful happens), but no system lifecycle re-fires.
    engine.start();
    raf.frame(50);
    engine.stop();
    expect(log.filter((entry) => entry.endsWith('.start'))).toHaveLength(2);
    expect(log.filter((entry) => entry.endsWith('.dispose'))).toHaveLength(2);
  });

  it('double stop() notifies each system exactly once (guarded like GameLoop.stop)', () => {
    const log: string[] = [];
    const engine = new Engine().addSystem(makeRecordingSystem('a', log), makeRecordingSystem('b', log));

    engine.start();
    engine.stop();
    engine.stop();
    engine.stop();

    expect(log.filter((entry) => entry === 'a.stop')).toHaveLength(1);
    expect(log.filter((entry) => entry === 'b.stop')).toHaveLength(1);
  });

  it('stop() before any start() is a no-op; stop-after-dispose is harmless', () => {
    const log: string[] = [];
    const engine = new Engine().addSystem(makeRecordingSystem('a', log));

    engine.stop(); // never started → systems must not see a stop
    expect(log).toEqual([]);

    engine.start();
    engine.dispose();
    engine.stop(); // after dispose → no second notification, no error

    expect(log.filter((entry) => entry === 'a.stop')).toHaveLength(1);
    expect(log.filter((entry) => entry === 'a.dispose')).toHaveLength(1);
    expect(engine.isRunning).toBe(false);
  });

  it('init() awaits each system init before calling the next', async () => {
    const log: string[] = [];
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    const engine = new Engine().addSystem(
      makeRecordingSystem('a', log, gateA), // async init (asset loading shape)
      makeRecordingSystem('b', log),
    );

    const initializing = engine.init();
    expect(log).toEqual(['a.init']); // b must NOT start while a is pending
    releaseA();
    await initializing;
    expect(log).toEqual(['a.init', 'b.init']);
  });
});
