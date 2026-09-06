import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { GameLoop } from './GameLoop';

/**
 * Manual RAF driver — GameLoop owns timing through requestAnimationFrame +
 * performance.now, neither of which behaves deterministically under Node.
 *
 * The driver replaces both with a virtual clock the test steps by hand:
 * `frame(dtMs)` dequeues the loop's pending callback and invokes it with
 * `now + dtMs`, exactly like the browser firing one vsync. The loop's
 * self-re-registration (each tick schedules the next) lands back in the same
 * queue, so at most one callback is ever pending. `peek()` exposes it so a
 * test can also simulate the browser race where stop() happens after the
 * callback was already dequeued.
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

  /** The queued callback, if any (for stale-callback simulations). */
  peek(): FrameRequestCallback | undefined {
    const entry = [...this.queue.entries()].pop();
    return entry?.[1];
  }

  get pendingCount(): number {
    return this.queue.size;
  }
}

describe('GameLoop', () => {
  let raf: ManualRaf;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    raf = new ManualRaf();
    raf.install();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Typed recording callbacks — `mock.calls` stays precisely typed. */
  function makeLoop(): {
    onFixedStep: Mock<(fixedDt: number) => void>;
    onFrame: Mock<(dt: number, alpha: number) => void>;
    loop: GameLoop;
  } {
    const onFixedStep = vi.fn((_fixedDt: number) => {});
    const onFrame = vi.fn((_dt: number, _alpha: number) => {});
    const loop = new GameLoop({ onFixedStep, onFrame });
    return { onFixedStep, onFrame, loop };
  }

  it('runs exactly N fixed steps for a frame dt of N × FIXED_DT', () => {
    const { loop, onFixedStep, onFrame } = makeLoop();
    loop.start();

    // 50 ms = 0.05 s = 3 × FIXED_DT (floating point leaves ~7e-18 behind).
    raf.frame(50);
    expect(onFixedStep).toHaveBeenCalledTimes(3);
    for (const [fixedDt] of onFixedStep.mock.calls) {
      expect(fixedDt).toBe(GameLoop.FIXED_DT);
    }
    // Leftover after 3 steps is ~0 → alpha ~0.
    expect(onFrame.mock.calls[0]![1]).toBeCloseTo(0, 10);

    raf.frame(50);
    expect(onFixedStep).toHaveBeenCalledTimes(6);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('passes alpha = leftover / FIXED_DT when a frame carries no whole step', () => {
    const { loop, onFixedStep, onFrame } = makeLoop();
    loop.start();

    // 16 ms → 0.016 s < FIXED_DT: no step, all of it is leftover.
    raf.frame(16);
    expect(onFixedStep).not.toHaveBeenCalled();
    const [dt, alpha] = onFrame.mock.calls[0]!;
    expect(dt).toBeCloseTo(0.016, 10);
    expect(alpha).toBeCloseTo(0.016 / (1 / 60), 10); // ≈ 0.96
  });

  it('clamps huge frame deltas to MAX_DELTA before accumulating', () => {
    const { loop, onFrame } = makeLoop();
    loop.start();

    raf.frame(5000); // tab-switch: 5 s
    const [dt] = onFrame.mock.calls[0]!;
    expect(dt).toBe(GameLoop.MAX_DELTA); // 0.1, not 5.0
  });

  it('caps substeps at MAX_SUBSTEPS and panics: backlog dropped, warn ONCE per run', () => {
    const { loop, onFixedStep, onFrame } = makeLoop();
    loop.start();

    // Clamped to 0.1 s = 6 steps worth of time → capped at 5 → panic.
    raf.frame(5000);
    expect(onFixedStep).toHaveBeenCalledTimes(GameLoop.MAX_SUBSTEPS);
    expect(onFrame.mock.calls[0]![1]).toBe(0); // accumulator reset by panic
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Sustained overload: two more overloaded frames — still capped, no spam.
    raf.frame(5000);
    raf.frame(5000);
    expect(onFixedStep).toHaveBeenCalledTimes(GameLoop.MAX_SUBSTEPS * 3);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Panic dropped the backlog: a normal frame afterwards starts clean
    // (no leftover steps from the overload era).
    raf.frame(16);
    expect(onFixedStep).toHaveBeenCalledTimes(GameLoop.MAX_SUBSTEPS * 3);
    expect(onFrame.mock.calls.at(-1)![1]).toBeCloseTo(0.96, 10);
  });

  it('stop() is idempotent and cancels the pending RAF', () => {
    const { loop, onFixedStep } = makeLoop();
    loop.start();
    expect(raf.pendingCount).toBe(1);

    loop.stop();
    loop.stop(); // second call is a no-op, not an error
    expect(raf.cancelledIds).toHaveLength(1);
    expect(raf.pendingCount).toBe(0);

    // Restart registers a fresh frame callback; stop cancels it again.
    loop.start();
    expect(raf.pendingCount).toBe(1);
    loop.stop();
    expect(raf.cancelledIds).toHaveLength(2);
    expect(onFixedStep).not.toHaveBeenCalled();
  });

  it('a stale RAF callback (dequeued before stop) is a no-op via the running guard', () => {
    const { loop, onFixedStep, onFrame } = makeLoop();
    loop.start();
    const stale = raf.peek();
    expect(stale).toBeTypeOf('function');

    loop.stop();
    // Browser race: the callback was already dequeued when stop() ran.
    stale!(raf.nowMs + 16);
    expect(onFixedStep).not.toHaveBeenCalled();
    expect(onFrame).not.toHaveBeenCalled();
  });

  it('start() resets the panic flag: a warn can fire again in a new run', () => {
    const { loop } = makeLoop();
    loop.start();
    raf.frame(5000); // panic + warn #1
    expect(warnSpy).toHaveBeenCalledTimes(1);

    loop.stop();
    loop.start();
    raf.frame(5000); // panic again — warn #2, flag was reset
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('start() resets the accumulator across runs', () => {
    const { loop, onFixedStep, onFrame } = makeLoop();
    loop.start();
    raf.frame(16); // leftover 0.016 in the accumulator
    loop.stop();

    loop.start(); // fresh timing state
    raf.frame(16);
    expect(onFixedStep).not.toHaveBeenCalled(); // no inherited leftover steps
    expect(onFrame.mock.calls.at(-1)![1]).toBeCloseTo(0.96, 10);
  });
});
