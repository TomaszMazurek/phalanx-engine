import { AssetManager } from './assets/AssetManager';
import { DEFAULT_BINDINGS } from './core/Bindings';
import { Engine } from './core/Engine';
import { EventBus } from './core/EventBus';
import { InputSystem } from './core/InputSystem';
import { LoadingOverlay } from './editor/LoadingOverlay';
import { SceneProgressUIAdapter } from './editor/SceneProgressUIAdapter';
import { GameplayScene, type ModelLoader } from './examples/GameplayScene';
import { MenuScene } from './examples/MenuScene';
import type { GameEvents } from './examples/GameEvents';
import { loadGLTF } from './render/GLTFAdapter';
import { RenderSystem } from './render/RenderSystem';
import { SceneManager } from './scenes/SceneManager';

/**
 * Phase 2 bootstrap (menu → gameplay, async scene switching):
 *   1. renderer + bus + input + asset cache (all app-singletons, injected),
 *   2. SceneManager with the menu as the initial scene (mounted during
 *      engine.init(), so the first rendered frame is a fully entered scene),
 *   3. app-level navigation: scenes emit 'menu/play' / 'game/back', THIS
 *      module decides what a switch means — scenes never see SceneManager,
 *   4. engine systems: sceneManager → render → input (order = contract,
 *      comment at addSystem below).
 *
 * The Phase 1 material viewer lives on as a second entry: viewer.html →
 * src/examples/viewer.ts (same boot as before, untouched).
 */

async function boot(): Promise<void> {
  const overlayRoot = document.getElementById('loading');
  const container = document.getElementById('app');
  if (!overlayRoot || !container) {
    throw new Error('index.html is missing #app or #loading');
  }
  const overlay = new LoadingOverlay(overlayRoot);
  const progressUI = new SceneProgressUIAdapter(overlay);

  const render = new RenderSystem(container);
  const events = new EventBus<GameEvents>();
  const input = new InputSystem(DEFAULT_BINDINGS, window);
  const assets = new AssetManager();
  const loadModel: ModelLoader = loadGLTF;

  const scenes = new SceneManager({ events, input }, progressUI);
  scenes.setInitialScene(new MenuScene(events));

  /** A failed switch keeps the current scene; make it visible, not silent. */
  const reportSwitchFailure = (error: unknown): void => {
    console.error('[scenes] switch failed:', error);
    overlay.fail(error instanceof Error ? error.message : String(error));
  };

  // App-lifetime subscriptions (unsubscribed never — the bus outlives nothing).
  // Scene instances are single-use (SceneManager contract): a fresh instance
  // per switch; shared ASSETS stay cached in the AssetManager (trap #5).
  events.on('menu/play', () => {
    void scenes
      .switchTo(new GameplayScene({ render, assets, input, events, loadModel }))
      .catch(reportSwitchFailure);
  });
  events.on('game/back', () => {
    void scenes.switchTo(new MenuScene(events)).catch(reportSwitchFailure);
  });

  const engine = new Engine();
  // Registration order = per-frame contract:
  // - sceneManager FIRST: its fixedUpdate/update delegate to the active
  //   scene's systems (player edge-buffering → mesh-sync → hud), so they run
  //   before anything that observes their output;
  // - render SECOND: draws exactly the state this frame's scene updates
  //   produced;
  // - input LAST: its update() clears the frame's input edges — every
  //   input consumer above must have run first (InputSystem class doc).
  engine.addSystem(scenes, render, input);
  await engine.init(); // SceneManager.init mounts the menu (overlay hides itself)
  engine.start();

  overlay.hide();
}

boot().catch((error: unknown) => {
  console.error('[boot] failed:', error);
  const overlayRoot = document.getElementById('loading');
  if (overlayRoot) {
    const overlay = new LoadingOverlay(overlayRoot);
    overlay.fail(error instanceof Error ? error.message : String(error));
  }
});
