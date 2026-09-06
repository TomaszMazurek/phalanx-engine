import type { InputSystem } from '../../core/InputSystem';
import type { System } from '../../core/System';
import type { RoundState } from '../RoundState';
import type { EnemySystem } from './EnemySystem';
import type { PlayerSystem } from './PlayerSystem';
import type { WaveSystem } from './WaveSystem';

/**
 * RoundSystem (Game 1, Sprint 0) — outcome polling + result overlay + the
 * R-key restart edge.
 *
 * Outcomes are POLLED on the fixed step (after enemies/weapon ran that
 * tick): defeat when the player pool is dead, victory when the director
 * finished AND the field is clear. The pure transitions live in
 * RoundState (tested); this system owns the DOM and the full reset
 * callback wired by ArenaGame (respawn → clear → rewind waves → snap
 * camera → reset HUD), so restart needs no page reload.
 *
 * 'restart' is a Game 1 action (R key, bindings.ts) — deliberately NOT
 * 'confirm'/'back': an edge-read restart key must never collide with menu
 * semantics or fire on Enter/Escape.
 */

export interface RoundDeps {
  readonly player: PlayerSystem;
  readonly enemies: EnemySystem;
  readonly waves: WaveSystem;
  readonly round: RoundState;
  readonly input: InputSystem;
  /** Full round reset, wired by ArenaGame (system order is its call). */
  readonly onRestart: () => void;
}

export class RoundSystem implements System {
  readonly name = 'round';

  private readonly deps: RoundDeps;
  private overlay: HTMLDivElement | null = null;
  private title: HTMLDivElement | null = null;
  private shownStatus = 'playing';

  constructor(deps: RoundDeps) {
    this.deps = deps;
  }

  init(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:none',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:12px',
      'background:rgba(4,6,10,0.78)',
      'z-index:20',
      'pointer-events:none',
      'font-family:system-ui,sans-serif',
    ].join(';');

    const title = document.createElement('div');
    title.style.cssText =
      'font-size:64px;font-weight:300;letter-spacing:0.12em;color:#e8f6ff';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:16px;letter-spacing:0.1em;color:#9fb3c8';
    hint.textContent = 'R — restart';

    overlay.appendChild(title);
    overlay.appendChild(hint);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.title = title;
  }

  fixedUpdate(): void {
    if (this.deps.round.status !== 'playing') return;
    if (this.deps.player.health.isDead) {
      this.deps.round.markDefeat();
    } else if (this.deps.waves.allSpawned && this.deps.enemies.livingCount === 0) {
      this.deps.round.markVictory();
    }
  }

  update(): void {
    const status = this.deps.round.status;

    if (status !== this.shownStatus) {
      this.shownStatus = status;
      if (status === 'playing') {
        if (this.overlay) this.overlay.style.display = 'none';
      } else {
        if (this.title) {
          this.title.textContent = status === 'victory' ? 'VICTORY' : 'DEFEAT';
          this.title.style.color = status === 'victory' ? '#22d3ee' : '#ff2fd6';
        }
        if (this.overlay) this.overlay.style.display = 'flex';
        this.deps.player.setVisualDead(status === 'defeat');
      }
    }

    if (status !== 'playing' && this.deps.input.wasPressedThisFrame('restart')) {
      this.deps.onRestart();
    }
  }

  dispose(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.title = null;
  }
}
