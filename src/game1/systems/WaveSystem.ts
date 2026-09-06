import type { AudioSystem } from '../../core/AudioSystem';
import type { System } from '../../core/System';
import { WaveDirector, type WaveDefinition } from '../../core/WaveDirector';
import { SPAWN_PADS } from '../arenaMath';
import type { RoundState } from '../RoundState';
import type { EnemySystem } from './EnemySystem';

/**
 * WaveSystem (Game 1, Sprint 0) — the WaveDirector wiring: tick on the
 * fixed step, map SpawnCommands to pad spawns, sound the alarm and bump
 * the HUD wave number when a wave starts. The director itself is pure
 * engine code (fully tested there); this system owns the side effects.
 */

/** v0 schedule: four growing waves of runners, 1.2 s apart. */
export const RUNNER_WAVES: readonly WaveDefinition[] = [
  { count: 5, intervalMs: 1200 },
  { count: 8, intervalMs: 1200 },
  { count: 12, intervalMs: 1200 },
  { count: 16, intervalMs: 1200 },
];

const INTERMISSION_MS = 4000;

export interface WaveDeps {
  readonly enemies: EnemySystem;
  readonly audio: AudioSystem;
  readonly round: RoundState;
}

export class WaveSystem implements System {
  readonly name = 'waves';

  readonly totalWaves: number = RUNNER_WAVES.length;

  private readonly director = new WaveDirector({
    waves: RUNNER_WAVES,
    interWaveMs: INTERMISSION_MS,
    spawnPointCount: SPAWN_PADS.length,
  });
  private readonly deps: WaveDeps;
  private waveDisplay = 0;

  constructor(deps: WaveDeps) {
    this.deps = deps;
  }

  /** Engine start hook: arm the schedule (opens with the intermission beat). */
  start(): void {
    this.director.start();
  }

  /** Wave number for the HUD (1-based); 0 = still in the opening beat. */
  get displayWave(): number {
    return this.waveDisplay;
  }

  /** True once the LAST wave has fully spawned (victory precondition). */
  get allSpawned(): boolean {
    return this.director.phase === 'done';
  }

  /** Full reset for round restart: same schedule, cursor rewound. */
  restart(): void {
    this.director.start();
    this.waveDisplay = 0;
  }

  fixedUpdate(fixedDt: number): void {
    if (this.deps.round.status !== 'playing') return; // round over: freeze
    const commands = this.director.tick(fixedDt);

    if (this.director.waveJustStarted) {
      this.waveDisplay = this.director.currentWave + 1;
      this.deps.audio.trigger('alarm');
    }
    for (const command of commands) {
      this.deps.enemies.spawnAt(command.spawnPointIndex);
    }
  }
}
