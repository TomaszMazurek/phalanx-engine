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
    const gate2 = deferred<string>();
    const factory2 = vi.fn(gatedFactory(gate2));
    const fresh = manager.load('x.glb', factory2);
    expect(fresh).not.toBe(inFlight);
    gate2.resolve('fresh-value');
    await expect(fresh).resolves.toBe('fresh-value');
    expect(manager.uris()).toEqual(['x.glb']);
  });
});
