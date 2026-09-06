import { DebugHUD } from '../../editor/DebugHUD';
import type { System } from '../../core/System';
import type { PlayerSystem } from './PlayerSystem';
import type { WaveSystem } from './WaveSystem';

/**
 * HudSystem (Game 1, Sprint 0) — DOM HUD: HP bar + wave label, the
 * hit-marker flash, and the engine DebugHUD (FPS) feed.
 *
 * Layout note: DebugHUD styles itself fixed at the top-left corner
 * (engine file, unmodified), so the game HUD sits directly BELOW it as
 * one top-left column: FPS line, then HP + wave.
 *
 * Damage feedback = the HP flash (simplest per the plan): the fill turns
 * red while DAMAGE_FLASH_TIME after any ratio drop. The hit-marker is a
 * rotated square outline at screen center — white for a hit, magenta for
 * a kill — driven by a JS timer, no CSS animation coupling.
 */

const DAMAGE_FLASH_TIME = 0.25;
const HIT_MARKER_TIME = 0.12;
const HP_FILL_COLOR = '#22d3ee';
const HP_FLASH_COLOR = '#ff4d6d';

export class HudSystem implements System {
  readonly name = 'hud';

  private readonly player: PlayerSystem;
  private readonly waves: WaveSystem;

  private root: HTMLDivElement | null = null;
  private hpFill: HTMLDivElement | null = null;
  private waveLabel: HTMLDivElement | null = null;
  private hitMarker: HTMLDivElement | null = null;
  private debugRoot: HTMLDivElement | null = null;
  private debugHud: DebugHUD | null = null;

  private stepsThisFrame = 0;
  private previousRatio = 1;
  private damageFlash = 0;
  private markerLife = 0;

  constructor(player: PlayerSystem, waves: WaveSystem) {
    this.player = player;
    this.waves = waves;
  }

  /** DOM built in init (mount phase), not the constructor. */
  init(): void {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'top:44px',
      'left:8px',
      'z-index:10',
      'pointer-events:none',
      'font:12px/1.4 monospace',
      'color:#cfd8dc',
    ].join(';');

    const bar = document.createElement('div');
    bar.style.cssText =
      'width:200px;height:14px;border:1px solid rgba(34,211,238,0.4);background:rgba(0,0,0,0.55)';
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:100%;background:${HP_FILL_COLOR}`;
    bar.appendChild(fill);

    const wave = document.createElement('div');
    wave.style.cssText = 'margin-top:6px;letter-spacing:0.08em';
    wave.textContent = 'GET READY';

    root.appendChild(bar);
    root.appendChild(wave);
    document.body.appendChild(root);

    const marker = document.createElement('div');
    marker.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:50%',
      'width:20px',
      'height:20px',
      'border:2px solid #ffffff',
      'transform:translate(-50%,-50%) rotate(45deg)',
      'opacity:0',
      'z-index:10',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(marker);

    // Engine FPS readout (own styling, top-left corner — see class doc).
    const debugRoot = document.createElement('div');
    document.body.appendChild(debugRoot);

    this.root = root;
    this.hpFill = fill;
    this.waveLabel = wave;
    this.hitMarker = marker;
    this.debugRoot = debugRoot;
    this.debugHud = new DebugHUD(debugRoot);
  }

  /** Weapon hook: flash the hit marker; kills tint it magenta. */
  flashHitMarker(kill: boolean): void {
    this.markerLife = HIT_MARKER_TIME;
    if (this.hitMarker) {
      this.hitMarker.style.borderColor = kill ? '#ff2fd6' : '#ffffff';
      this.hitMarker.style.opacity = '1';
    }
  }

  /** Round restart: no stale flashes from the previous round. */
  reset(): void {
    this.previousRatio = this.player.health.ratio;
    this.damageFlash = 0;
    this.markerLife = 0;
    if (this.hitMarker) this.hitMarker.style.opacity = '0';
  }

  fixedUpdate(): void {
    this.stepsThisFrame += 1;
  }

  update(dt: number, alpha: number): void {
    // HP bar + damage flash (any ratio drop counts as damage taken).
    const ratio = this.player.health.ratio;
    if (ratio < this.previousRatio - 1e-9) this.damageFlash = DAMAGE_FLASH_TIME;
    this.previousRatio = ratio;
    this.damageFlash = Math.max(0, this.damageFlash - dt);
    if (this.hpFill) {
      this.hpFill.style.width = `${Math.round(ratio * 100)}%`;
      this.hpFill.style.background = this.damageFlash > 0 ? HP_FLASH_COLOR : HP_FILL_COLOR;
    }

    // Wave label.
    const wave = this.waves.displayWave;
    if (this.waveLabel) {
      this.waveLabel.textContent =
        wave === 0 ? 'GET READY' : `WAVE ${wave}/${this.waves.totalWaves}`;
    }

    // Hit marker decay.
    if (this.markerLife > 0) {
      this.markerLife -= dt;
      if (this.hitMarker) {
        this.hitMarker.style.opacity = String(Math.max(0, this.markerLife / HIT_MARKER_TIME));
      }
    }

    this.debugHud?.update(dt, alpha, this.stepsThisFrame, true);
    this.stepsThisFrame = 0;
  }

  dispose(): void {
    this.root?.remove();
    this.hitMarker?.remove();
    this.debugRoot?.remove();
    this.root = null;
    this.hitMarker = null;
    this.debugRoot = null;
    this.debugHud = null;
  }
}
