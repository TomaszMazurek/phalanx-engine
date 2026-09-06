import { AudioSystem } from '../core/AudioSystem';
import { Engine } from '../core/Engine';
import { InputSystem } from '../core/InputSystem';
import { LoadingOverlay } from '../editor/LoadingOverlay';
import { RenderSystem } from '../render/RenderSystem';
import { ArenaGame } from './ArenaGame';
import { GAME1_BINDINGS } from './bindings';

/**
 * Game 1 (Arena Defense Shooter) bootstrap — Sprint 0, slice 2:
 * renderer + input (Game 1 bindings) + procedural audio, the ArenaGame
 * system set, engine order [..gameSystems, render, input] (input LAST —
 * it clears the frame's input edges). No assets → the loading overlay
 * hides immediately after init.
 */
async function boot(): Promise<void> {
  const overlayRoot = document.getElementById('loading');
  const container = document.getElementById('app');
  if (!overlayRoot || !container) {
    throw new Error('game1.html is missing #app or #loading');
  }
  const overlay = new LoadingOverlay(overlayRoot);

  const render = new RenderSystem(container);
  const input = new InputSystem(GAME1_BINDINGS, window);
  const audio = new AudioSystem();

  // Autoplay policy: the AudioContext needs a real user gesture — one-time
  // listeners on the first pointerdown/keydown (AudioSystem.unlock doc).
  const unlock = (): void => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  const game = new ArenaGame({ render, input, audio });
  const engine = new Engine();
  // Registration order = per-frame contract: game systems → render →
  // input LAST (update() clears the edges the game systems consumed).
  engine.addSystem(...game.systems, render, input);

  await engine.init();
  engine.start();
  overlay.hide();
}

boot().catch((error: unknown) => {
  console.error('[game1 boot] failed:', error);
  const overlayRoot = document.getElementById('loading');
  if (overlayRoot) {
    const overlay = new LoadingOverlay(overlayRoot);
    overlay.fail(error instanceof Error ? error.message : String(error));
  }
});
