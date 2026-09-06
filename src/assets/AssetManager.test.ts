import { describe, expect, it, vi } from 'vitest';
import { AssetManager } from './AssetManager';
import type { AssetFactory } from './AssetManager';

/**
 * Async control: factories return promises the test resolves/rejects by hand,
 * so in-flight dedup, retry and preload aggregation are observed at exact
 * points instead of racing real timers.
 */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A factory that reports `ratio` immediately, then stays pending on `gate`. */
function gatedFactory<T>(
  gate: { promise: Promise<T> },
  ratio?: number,
): AssetFactory<T> {
  return (_uri: string, onProgress: (r: number) => void) => {
    if (ratio !== undefined) {
      onProgress(ratio);
    }
    return gate.promise;
  };
}

/**
 * Drain enough microtask turns for the load() bookkeeping chain
 * (`factory promise → catch → then(markComplete) → report`) to run.
 */
async function flushMicrotasks(turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await Promise.resolve();
  }
}

describe('AssetManager', () => {
  it('dedupes concurrent loads of the same URI: one factory call, one promise', async () => {
    const manager = new AssetManager();
    const gate = deferred<string>();
    const factory = vi.fn(gatedFactory(gate, 0.5));

    const first = manager.load('a.glb', factory);
    const second = manager.load('a.glb', factory);

    expect(second).toBe(first); // same Promise identity, not a wrapper
    expect(factory).toHaveBeenCalledTimes(1);

    gate.resolve('asset-a');
    await expect(first).resolves.toBe('asset-a');
    await expect(second).resolves.toBe('asset-a');
    expect(manager.uris()).toEqual(['a.glb']); // resolved entries stay cached
    expect(manager.size).toBe(1);
  });

  it('drops the cache entry on failure: retry re-invokes the factory', async () => {
    const manager = new AssetManager();
    const failing = deferred<string>();
    const succeeding = deferred<string>();
    let call = 0;
    const factory = vi.fn(
      (_uri: string, _onProgress: (r: number) => void) =>
        call === 0 ? failing.promise : succeeding.promise,
    );

    const first = manager.load('a.glb', factory);
    const secondView = first.then(
      () => 'unexpected-success',
      (error: unknown) => `caught:${(error as Error).message}`,
    );
    failing.reject(new Error('network-down'));
    await expect(first).rejects.toThrow('network-down');
    await expect(secondView).resolves.toBe('caught:network-down');
    expect(manager.size).toBe(0); // failed entry did not poison the cache

    call = 1;
    const retry = manager.load('a.glb', factory);
    expect(factory).toHaveBeenCalledTimes(2); // fresh load, not the old promise
    succeeding.resolve('asset-a-2');
    await expect(retry).resolves.toBe('asset-a-2');
    expect(manager.uris()).toEqual(['a.glb']);
  });

  it('aggregates preload progress: equal weight, monotonic, reaches 1', async () => {
    const manager = new AssetManager();
    const gateA = deferred<string>();
    const gateB = deferred<string>();
    const factoryA = vi.fn(gatedFactory(gateA, 0.5));
    const factoryB = vi.fn(gatedFactory(gateB));

    const ratios: number[] = [];
    const loading = manager.preload(
      [
        { uri: 'a.glb', factory: factoryA },
        { uri: 'b.glb', factory: factoryB },
      ],
      (ratio) => ratios.push(ratio),
    );

    // factoryA fired 0.5 synchronously during preload setup: 0.5 / 2 entries.
    expect(ratios).toEqual([0.25]);

    gateA.resolve('asset-a');
    await flushMicrotasks(); // let the completion chain run
    expect(ratios.at(-1)).toBe(0.5); // one of two entries complete

    gateB.resolve('asset-b');
    await expect(loading).resolves.toEqual(['asset-a', 'asset-b']);
    expect(ratios.at(-1)).toBe(1);

    // Monotonic and clamped across the whole report stream.
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThanOrEqual(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]!);
    }
  });

  it('a cached entry completes a preload instantly: factory not re-invoked', async () => {
    const manager = new AssetManager();
    const warmup = deferred<string>();
    const warmFactory = vi.fn(gatedFactory(warmup));
    const warmed = manager.load('a.glb', warmFactory);
    warmup.resolve('asset-a');
    await warmed;

    const never = vi.fn(() => Promise.reject(new Error('must-not-run')));
    const ratios: number[] = [];
    const values = await manager.preload(
      [{ uri: 'a.glb', factory: never }],
      (ratio) => ratios.push(ratio),
    );

    expect(never).not.toHaveBeenCalled(); // served from cache
    expect(values).toEqual(['asset-a']);
    expect(ratios.at(-1)).toBe(1);
  });

  it('partial preload failure rejects fast; surviving loads stay cached', async () => {
    const manager = new AssetManager();
    const gateA = deferred<string>();
    const gateBad = deferred<string>();
    const factoryA = gatedFactory(gateA);
    const factoryBad = gatedFactory(gateBad);

    const failing = manager.preload(
      [
        { uri: 'a.glb', factory: factoryA },
        { uri: 'bad.glb', factory: factoryBad },
      ],
      () => {},
    );

    gateBad.reject(new Error('corrupt-gltf'));
    await expect(failing).rejects.toThrow('corrupt-gltf');

    // The survivor was NOT cancelled: it keeps loading and lands in the cache.
    gateA.resolve('asset-a');
    await gateA.promise;
    expect(manager.uris()).toEqual(['a.glb']);
    expect(manager.size).toBe(1);
  });

  it('preload over an IN-FLIGHT entry rides the shared promise: no instant ratio 1', async () => {
    const manager = new AssetManager();
    const gateA = deferred<string>();
    const factoryA = vi.fn(gatedFactory(gateA, 0.5));
    const inFlight = manager.load('a.glb', factoryA);

    const gateB = deferred<string>();
    const factoryB = vi.fn(gatedFactory(gateB));
    const ratios: number[] = [];
    const loading = manager.preload([{ uri: 'a.glb', factory: factoryB }], (ratio) =>
      ratios.push(ratio),
    );

    // In-flight ≠ resolved: the entry must NOT be marked complete up front
    // (that would overstate progress), and the factory must not be re-invoked
    // — preload wraps the SAME in-flight promise.
    expect(factoryB).not.toHaveBeenCalled();
    expect(ratios).not.toContain(1);

    gateA.resolve('asset-a');
    await expect(loading).resolves.toEqual(['asset-a']);
    await expect(inFlight).resolves.toBe('asset-a');
    expect(ratios.at(-1)).toBe(1); // complete exactly when the load resolves
  });

  it('no progress callback escapes after a preload REJECTS', async () => {
    const manager = new AssetManager();
    const gateOk = deferred<string>();
    const gateBad = deferred<string>();
    const factoryOk = gatedFactory(gateOk);
    const factoryBad = gatedFactory(gateBad);

    const ratios: number[] = [];
    const loading = manager.preload(
      [
        { uri: 'ok.glb', factory: factoryOk },
        { uri: 'bad.glb', factory: factoryBad },
      ],
      (ratio) => ratios.push(ratio),
    );

    gateBad.reject(new Error('corrupt-gltf'));
    await expect(loading).rejects.toThrow('corrupt-gltf');
    const reportsAtRejection = ratios.length;

    // The survivor keeps loading, but the (rejected) preload must stay silent.
    gateOk.resolve('asset-ok');
    await flushMicrotasks();
    expect(ratios.length).toBe(reportsAtRejection);
  });

  it('release() during an in-flight load: awaiters still resolve, entry uncached', async () => {
    const manager = new AssetManager();
    const gate = deferred<string>();
    const factory = vi.fn(gatedFactory(gate));

    const inFlight = manager.load('x.glb', factory);
    manager.release('x.glb');
    expect(manager.size).toBe(0);

    gate.resolve('late-value');
    await expect(inFlight).resolves.toBe('late-value'); // not orphaned
    expect(manager.size).toBe(0); // but not cached either

    // A subsequent load starts fresh — the released promise is not reused.
    const gateNext = deferred<string>();
    const factoryNext = vi.fn(gatedFactory(gateNext));
    const freshLoad = manager.load('x.glb', factoryNext);
    expect(freshLoad).not.toBe(inFlight);
    gateNext.resolve('fresh-value');
    await expect(freshLoad).resolves.toBe('fresh-value');
    expect(manager.uris()).toEqual(['x.glb']);
  });

  it('release() during an in-flight load: a late resolve does NOT mark the URI resolved', async () => {
    const manager = new AssetManager();
    const gate = deferred<string>();
    manager.load('x.glb', gatedFactory(gate));
    manager.release('x.glb');

    gate.resolve('late-value');
    await flushMicrotasks();
    expect(manager.size).toBe(0); // released: nothing cached

    // Probe the resolved set through preload: a stale entry (resolved-set
    // resurrection after release) would report the URI instantly complete
    // (ratio 1 before the new factory settles).
    const gate2 = deferred<string>();
    const factory2 = vi.fn(gatedFactory(gate2));
    const ratios: number[] = [];
    const loading = manager.preload([{ uri: 'x.glb', factory: factory2 }], (ratio) =>
      ratios.push(ratio),
    );
    expect(factory2).toHaveBeenCalledTimes(1); // fresh load started (not cached)
    expect(ratios).not.toContain(1); // and NOT instantly complete
    gate2.resolve('v2');
    await expect(loading).resolves.toEqual(['v2']);
  });

  it("release() + retry: a stale REJECT must not clobber the NEW load's cache entry", async () => {
    const manager = new AssetManager();
    const old = deferred<string>();
    const fresh = deferred<string>();
    let call = 0;
    const factory = vi.fn(
      (_uri: string, _onProgress: (r: number) => void) =>
        call++ === 0 ? old.promise : fresh.promise,
    );

    const first = manager.load('x.glb', factory);
    manager.release('x.glb');
    const second = manager.load('x.glb', factory); // fresh entry for the same URI
    expect(second).not.toBe(first);

    old.reject(new Error('stale-failure'));
    await expect(first).rejects.toThrow('stale-failure');
    expect(manager.uris()).toEqual(['x.glb']); // the fresh entry survived the stale catch

    fresh.resolve('fresh-value');
    await expect(second).resolves.toBe('fresh-value');
    expect(manager.uris()).toEqual(['x.glb']);

    // The resolved fresh entry is cached: a third load gets the same promise.
    const factory3 = vi.fn(() => Promise.reject(new Error('must-not-run')));
    expect(manager.load('x.glb', factory3)).toBe(second);
    expect(factory3).not.toHaveBeenCalled();
  });
});
