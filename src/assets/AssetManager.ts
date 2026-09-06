/**
 * AssetManager — generic, renderer-agnostic asset cache (Phase 2, task 5).
 *
 * Pure TypeScript on purpose: it stores promises keyed by URI and knows
 * nothing about three.js. Format-specific loaders (glTF, textures, ...) are
 * passed in as factories and live in the `render/` layer (`GLTFAdapter`).
 * Adding a format = adding an adapter, not touching this file.
 *
 * Cache policy (docs/phase-2-core.md, trap #5):
 * - NO automatic eviction, NO LRU, NO size caps — by design. Returning to a
 *   scene must hit the cache, not the network; a scene that released its
 *   assets on dispose would re-download them on every visit. The trade-off
 *   is explicit: un-released assets stay in memory until `release(uri)` /
 *   `disposeAll()` is called, or the page unloads.
 * - Disposing the *underlying GPU resources* (e.g. `Texture.dispose()`) is
 *   the caller's job — this class owns the cache slots, not the lifetimes.
 *
 * Usage:
 * ```ts
 * const assets = new AssetManager();
 * const gltf = await assets.load('models/demo-cube.gltf', loadGLTF);
 * await assets.preload(
 *   [{ uri: 'models/demo-cube.gltf', factory: loadGLTF }],
 *   (ratio) => overlay.setProgress(ratio),
 * );
 * assets.release('models/demo-cube.gltf');
 * ```
 */

/** Creates the asset for a URI; reports per-asset progress as [0..1]. */
export type AssetFactory<T> = (
  uri: string,
  onProgress: (ratio: number) => void,
) => Promise<T>;

/** One entry for {@link AssetManager.preload}. */
export interface PreloadEntry<T> {
  uri: string;
  factory: AssetFactory<T>;
}

export class AssetManager {
  /**
   * URI → in-flight or resolved promise. Heterogeneous by nature: the value
   * type is decided by the factory, not the URI. The single `as Promise<T>`
   * narrowing in `load()` is the sanctioned boundary cast for this cache —
   * callers must use one consistent factory per URI.
   */
  private readonly entries = new Map<string, Promise<unknown>>();

  /**
   * Load an asset, deduplicating concurrent requests for the same URI
   * (the second caller while loading receives the SAME promise). On failure
   * the cache entry is dropped, so a retry re-invokes the factory.
   *
   * Note: `load` itself takes no progress callback — per-asset progress
   * belongs to the adapter call (e.g. `loadGLTF(uri, onProgress)`);
   * aggregated progress is {@link preload}'s job.
   */
  load<T>(uri: string, factory: AssetFactory<T>): Promise<T> {
    const existing = this.entries.get(uri);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = factory(uri, () => {
      /* progress forwarded by adapters/preload, not by bare load */
    }).catch((error: unknown) => {
      // Failed entries must not poison the cache — retry gets a fresh load.
      this.entries.delete(uri);
      throw error;
    });
    this.entries.set(uri, promise);
    return promise;
  }

  /**
   * Load many assets with one aggregated [0..1] progress report
   * (equal weight per entry — simple, deterministic, good enough for a
   * loading bar). Resolved/cached entries count as complete immediately.
   *
   * Fail-fast semantics (Promise.all): on the first rejection the returned
   * promise rejects, but the other loads keep running and their results
   * stay cached; a failed URI is dropped from the cache and can be retried.
   */
  async preload<T>(
    entries: PreloadEntry<T>[],
    onOverallProgress: (ratio: number) => void,
  ): Promise<T[]> {
    if (entries.length === 0) {
      onOverallProgress(1);
      return [];
    }
    const ratios = entries.map(() => 0);
    const report = (): void => {
      const sum = ratios.reduce((acc, value) => acc + value, 0);
      onOverallProgress(sum / entries.length);
    };
    const loads = entries.map((entry, index) => {
      const markComplete = (): void => {
        // Load may succeed without a final progress event (e.g. from cache
        // or a fast local server) — resolution itself marks the entry done.
        ratios[index] = 1;
        report();
      };
      if (this.entries.has(entry.uri)) {
        markComplete();
      }
      const wrappedFactory: AssetFactory<T> = (_uri, _onProgress) =>
        entry.factory(entry.uri, (ratio) => {
          // Keep per-entry progress monotonic and clamped.
          ratios[index] = Math.max(ratios[index], Math.min(Math.max(ratio, 0), 1));
          report();
        });
      return this.load(entry.uri, wrappedFactory).then((value) => {
        markComplete();
        return value;
      });
    });
    return Promise.all(loads);
  }

  /** Drop a single cache slot. In-flight loads complete but are uncached. */
  release(uri: string): void {
    this.entries.delete(uri);
  }

  /**
   * Drop all cache slots (e.g. on app teardown). Does not abort in-flight
   * loads and does not dispose underlying resources (caller's job).
   */
  disposeAll(): void {
    this.entries.clear();
  }

  /** Number of cached (in-flight or resolved) assets. */
  get size(): number {
    return this.entries.size;
  }

  /** Snapshot of cached URIs. */
  uris(): string[] {
    return [...this.entries.keys()];
  }
}