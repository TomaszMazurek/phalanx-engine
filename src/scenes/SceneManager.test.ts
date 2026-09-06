import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BINDINGS } from '../core/Bindings';
import { EventBus } from '../core/EventBus';
import { InputSystem } from '../core/InputSystem';
import type { System } from '../core/System';
import { Scene } from './Scene';
import type { SceneContext, SceneLifecycleEvents } from './Scene';
import { SceneManager } from './SceneManager';
import type { SceneProgressUI } from './SceneManager';

/**
 * SceneManager tests drive the async state machine by hand: preloads and
 * system inits sit behind deferreds, so every mid-switch state (PENDING,
 * entering gate, failure) is observed deterministically instead of racing
 * real timers. Every fake records into ONE shared timeline, which makes
 * cross-object ordering (exit → init → enter → dispose) assertable by
 * indexOf.
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

/** A System that records its lifecycle into the shared timeline. */
class RecordingSystem implements System {
  readonly name: string;
  private readonly log: string[];
  private readonly initGate: ReturnType<typeof deferred<void>> | null;

  constructor(name: string, log: string[], initGate: ReturnType<typeof deferred<void>> | null = null) {
    this.name = name;
    this.log = log;
    this.initGate = initGate;
  }

  async init(): Promise<void> {
    this.log.push(`${this.name}:init-start`);
    await this.initGate?.promise;
    this.log.push(`${this.name}:init-end`);
  }

  start(): void {
    this.log.push(`${this.name}:start`);
  }

  fixedUpdate(fixedDt: number): void {
    this.log.push(`${this.name}:fixed(${fixedDt.toFixed(3)})`);
  }

  update(dt: number, alpha: number): void {
    this.log.push(`${this.name}:update(${dt.toFixed(3)},${alpha.toFixed(3)})`);
  }

  stop(): void {
    this.log.push(`${this.name}:stop`);
  }

  dispose(): void {
    this.log.push(`${this.name}:dispose`);
  }
}

interface RecordingSceneOptions {
  systems?: System[];
  preloadGate?: ReturnType<typeof deferred<void>>;
  preloadError?: Error;
}

/** A Scene that records its lifecycle into the shared timeline. */
class RecordingScene extends Scene {
  override readonly id: string;
  private readonly log: string[];
  private readonly systems: System[];
  private readonly preloadGate: ReturnType<typeof deferred<void>> | null;
  private readonly preloadError: Error | null;

  constructor(id: string, log: string[], options: RecordingSceneOptions = {}) {
    super();
    this.id = id;
    this.log = log;
    this.systems = options.systems ?? [];
    this.preloadGate = options.preloadGate ?? null;
    this.preloadError = options.preloadError ?? null;
  }

  override async preload(onProgress: (ratio: number) => void): Promise<void> {
    this.log.push(`${this.id}:preload`);
    onProgress(0.5);
    if (this.preloadError) {
      throw this.preloadError;
    }
    await this.preloadGate?.promise;
    onProgress(1);
  }

  override createSystems(): System[] {
    this.log.push(`${this.id}:createSystems`);
    return this.systems;
  }

  override enter(): void {
    this.log.push(`${this.id}:enter`);
  }

  override exit(): void {
    this.log.push(`${this.id}:exit`);
  }

  override dispose(): void {
    this.log.push(`${this.id}:dispose`);
  }
}

/** SceneProgressUI fake — records the visible surface of a switch. */
class RecordingProgressUI implements SceneProgressUI {
  readonly calls: string[] = [];

  show(): void {
    this.calls.push('show');
  }

  setProgress(ratio: number): void {
    this.calls.push(`progress:${ratio}`);
  }

  hide(): void {
    this.calls.push('hide');
  }
}

describe('SceneManager', () => {
  let log: string[];
  let context: SceneContext;
  let ui: RecordingProgressUI;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    log = [];
    ui = new RecordingProgressUI();
    // Node has a global EventTarget — a DOM-free stand-in for the window
    // (InputSystem's constructor default references `window`, absent in Node).
    context = {
      events: new EventBus<SceneLifecycleEvents>(),
      input: new InputSystem(DEFAULT_BINDINGS, new EventTarget()),
    };
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const markerCount = (marker: string): number =>
    log.filter((entry) => entry === marker).length;

  /** Mount `scene` through the initial-scene path and start the manager. */
  async function boot(scene: RecordingScene): Promise<SceneManager> {
    const manager = new SceneManager(context, ui);
    manager.setInitialScene(scene);
    await manager.init();
    manager.start();
    return manager;
  }

  it('setInitialScene + init(): preloads, enters, delegates ticking', async () => {
    const entered: string[] = [];
    context.events.on('scene/entered', ({ sceneId }) => entered.push(sceneId));

    const menuSys = new RecordingSystem('uiSys', log);
    const manager = new SceneManager(context, ui);
    manager.setInitialScene(new RecordingScene('menu', log, { systems: [menuSys] }));
    await manager.init();

    expect(manager.activeSceneId).toBe('menu');
    expect(log).toContain('menu:preload');
    expect(log).toContain('uiSys:init-end');
    expect(log).toContain('menu:enter');
    expect(entered).toEqual(['menu']);

    manager.start();
    expect(log).toContain('uiSys:start');

    manager.fixedUpdate(1 / 60);
    manager.update(0.016, 0.5);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(1);
    expect(markerCount('uiSys:update(0.016,0.500)')).toBe(1);

    // The overlay surface ran a full show → progress → hide cycle.
    expect(ui.calls[0]).toBe('show');
    expect(ui.calls.at(-1)).toBe('hide');
    expect(ui.calls).toContain('progress:0.5');
    expect(ui.calls).toContain('progress:1');
  });

  it('switchTo ordering: exit → new init → start → enter → old stop/dispose (after enter)', async () => {
    const uiSys = new RecordingSystem('uiSys', log);
    const manager = await boot(new RecordingScene('menu', log, { systems: [uiSys] }));
    const worldSys = new RecordingSystem('worldSys', log);
    const game = new RecordingScene('game', log, { systems: [worldSys] });

    await manager.switchTo(game);

    expect(manager.activeSceneId).toBe('game');
    const idx = (marker: string): number => {
      const position = log.indexOf(marker);
      expect(position, `marker ${marker} must be in the timeline`).toBeGreaterThanOrEqual(0);
      return position;
    };
    // createSystems runs before anything is touched, exit before new init…
    expect(idx('game:createSystems')).toBeLessThan(idx('menu:exit'));
    expect(idx('menu:exit')).toBeLessThan(idx('worldSys:init-start'));
    // …start only because the loop is running…
    expect(idx('worldSys:init-end')).toBeLessThan(idx('worldSys:start'));
    // …enter after the new systems are up…
    expect(idx('worldSys:start')).toBeLessThan(idx('game:enter'));
    // …and the old scene's teardown strictly after the successor entered.
    expect(idx('game:enter')).toBeLessThan(idx('uiSys:stop'));
    expect(idx('uiSys:stop')).toBeLessThan(idx('menu:dispose'));

    // Delegation moved: new scene ticks, old does not.
    manager.fixedUpdate(1 / 60);
    expect(markerCount('worldSys:fixed(0.017)')).toBe(1);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(0);
  });

  it('old scene keeps ticking during preload; the entering gate silences both mid-mount', async () => {
    const uiSys = new RecordingSystem('uiSys', log);
    const manager = await boot(new RecordingScene('menu', log, { systems: [uiSys] }));

    const preloadGate = deferred<void>();
    const initGate = deferred<void>();
    const worldSys = new RecordingSystem('worldSys', log, initGate);
    const game = new RecordingScene('game', log, {
      systems: [worldSys],
      preloadGate,
    });

    const switching = manager.switchTo(game);
    expect(manager.isSwitching).toBe(true);

    // PENDING phase: the old scene keeps simulating and rendering.
    manager.fixedUpdate(1 / 60);
    manager.update(0.016, 0.9);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(1);
    expect(markerCount('uiSys:update(0.016,0.900)')).toBe(1);

    preloadGate.resolve();
    // Mount reached the new system's init and parked on the gate.
    await vi.waitFor(() => {
      expect(log).toContain('worldSys:init-start');
    });

    // ENTERING phase: pointer is swapped AND the gate is up — neither the
    // old scene (already exited) nor the new one (not ready) may tick.
    manager.fixedUpdate(1 / 60);
    manager.update(0.016, 0.9);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(1); // unchanged
    expect(markerCount('uiSys:update(0.016,0.900)')).toBe(1); // unchanged
    expect(log).not.toContain('worldSys:fixed(0.017)');
    expect(log).not.toContain('worldSys:update(0.016,0.900)');

    initGate.resolve();
    await switching;
    expect(manager.isSwitching).toBe(false);

    // Gate lowered: the new scene is the one ticking now.
    manager.fixedUpdate(1 / 60);
    expect(markerCount('worldSys:fixed(0.017)')).toBe(1);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(1); // old stays silent
  });

  it('a switch during a switch is ignored (race guard, "ignore" strategy)', async () => {
    const manager = await boot(new RecordingScene('menu', log));

    const preloadGate = deferred<void>();
    const game = new RecordingScene('game', log, { preloadGate });
    const levelC = new RecordingScene('levelc', log);

    const switching = manager.switchTo(game);
    const ignored = manager.switchTo(levelC); // must be dropped, not queued

    await ignored; // resolves immediately (ignored path)
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]![0]).toContain('ignored');

    preloadGate.resolve();
    await switching;
    expect(manager.activeSceneId).toBe('game');

    // The ignored scene was never touched at all.
    expect(log.filter((entry) => entry.startsWith('levelc:'))).toEqual([]);

    // Switching to the already-active scene is also a no-op.
    await manager.switchTo(game);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy.mock.calls[1]![0]).toContain('already active');
    expect(manager.activeSceneId).toBe('game');
  });

  it('preload failure: old scene stays mounted and ticking, error rethrown with cause, UI hidden', async () => {
    const uiSys = new RecordingSystem('uiSys', log);
    const manager = await boot(new RecordingScene('menu', log, { systems: [uiSys] }));

    const originalError = new Error('404 asset missing');
    const broken = new RecordingScene('game', log, { preloadError: originalError });

    await expect(manager.switchTo(broken)).rejects.toThrow(
      'SceneManager: switch to "game" failed: 404 asset missing',
    );

    // Recovery contract: current scene untouched and still ticking.
    expect(manager.activeSceneId).toBe('menu');
    expect(manager.isSwitching).toBe(false);
    manager.fixedUpdate(1 / 60);
    expect(markerCount('uiSys:fixed(0.017)')).toBe(1);
    expect(ui.calls.at(-1)).toBe('hide');

    // The original error travels as `cause` (diagnosable rejections).
    let caught: unknown;
    try {
      await manager.switchTo(broken);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).cause).toBe(originalError);
    expect(manager.activeSceneId).toBe('menu'); // still nothing mounted
  });

  it('setInitialScene is ignored (warned) once a scene is mounted', async () => {
    const manager = await boot(new RecordingScene('menu', log));
    const late = new RecordingScene('late', log);

    manager.setInitialScene(late);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('ignored');

    await manager.init(); // nothing to mount — the late scene never runs
    expect(manager.activeSceneId).toBe('menu');
    expect(log.filter((entry) => entry.startsWith('late:'))).toEqual([]);
  });
});
