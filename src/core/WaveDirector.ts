/**
 * WaveDirector — pure, deterministic wave scheduling (Game 1, Sprint 0:
 * docs/games/GAME-1-plan.md, "wave spawner v0").
 *
 * Design decisions (v1, documented per plan):
 *  - EXPLICIT WAVE ARRAY, not a growth function: data-driven and
 *    debuggable — a designer can read/edit the whole schedule as plain
 *    data, and the game layer can generate the array procedurally if it
 *    ever wants growth curves.
 *  - RETURN-COMMAND PATTERN: `tick(fixedDt)` returns the spawns for that
 *    step instead of taking a callback or touching the EventBus. The
 *    director stays a pure state machine (trivially testable, replayable);
 *    the GAME maps returned commands and the `waveJustStarted/waveJustEnded`
 *    flags onto spawning, audio and HUD in its own fixedUpdate.
 *  - Spawn points are round-robin over a single cursor that persists
 *    across waves and rewinds on `start()` — with spawnPointCount > 1 the
 *    wave's spawns spread evenly over the points, first spawn at index 0.
 *
 * Timing contract: `fixedDt` is seconds (the engine's FIXED_DT); config
 * intervals are milliseconds. Internally the countdown runs in ms and each
 * tick subtracts `fixedDt * 1000`. One transition (wave start OR one spawn)
 * maximum happens per tick — intervals shorter than one fixed step simply
 * pace at one spawn per tick.
 *
 * Phase machine:
 *  - 'intermission' — counting down interWaveMs to the next wave start.
 *    `start()` opens with a full intermission before wave 0 (a "get ready"
 *    beat); an empty wave list therefore finishes after that opening gap.
 *  - 'spawning' — the first spawn of a wave fires on the tick the wave
 *    starts; intervalMs is the gap BETWEEN spawns within the wave.
 *  - 'done' — last wave fully spawned (no trailing intermission); tick
 *    returns [] forever after.
 */
export interface WaveDefinition {
  /** Enemies in this wave, integer ≥ 1. */
  readonly count: number;
  /** Gap between spawns within the wave, ms, ≥ 0. */
  readonly intervalMs: number;
}

export interface WaveDirectorConfig {
  /** Explicit wave schedule, index = waveIndex in the returned commands. */
  readonly waves: readonly WaveDefinition[];
  /** Gap between end of wave N and start of wave N+1, ms, ≥ 0. */
  readonly interWaveMs: number;
  /** Number of spawn points for round-robin, integer ≥ 1. Default 1. */
  readonly spawnPointCount?: number;
}

/** One spawn request: which wave it belongs to and which point to use. */
export interface SpawnCommand {
  readonly waveIndex: number;
  readonly spawnPointIndex: number;
}

export type WavePhase = 'intermission' | 'spawning' | 'done';

/**
 * Countdown expiry epsilon, ms. Fixed-step subtraction (300 − 18 × 16.6̄)
 * can leave a rounding residue of ~1e-13 above zero on the exact expiry
 * tick; anything ≤ this epsilon counts as expired so tick arithmetic stays
 * exact. One tick is ~16.7 ms — the epsilon is nine orders below it.
 */
const EXPIRY_EPSILON_MS = 1e-6;

export class WaveDirector {
  private phaseState: WavePhase = 'intermission';
  private currentWaveIndex = -1;
  private remaining = 0;
  /** Infinity until start(): a fresh director is inert — no wave can leak
   * before the game (re)sets the schedule. */
  private countdownMs: number = Number.POSITIVE_INFINITY;
  private cursor = 0;
  private waveStartedThisTick = false;
  private waveEndedThisTick = false;

  private readonly waves: readonly WaveDefinition[];
  private readonly interWaveMs: number;
  private readonly spawnPointCount: number;

  constructor(config: WaveDirectorConfig) {
    for (const [index, wave] of config.waves.entries()) {
      if (!Number.isFinite(wave.count) || !Number.isInteger(wave.count) || wave.count < 1) {
        throw new RangeError(
          `WaveDirector: waves[${index}].count must be an integer ≥ 1, got ${wave.count}`,
        );
      }
      if (!Number.isFinite(wave.intervalMs) || wave.intervalMs < 0) {
        throw new RangeError(
          `WaveDirector: waves[${index}].intervalMs must be ≥ 0, got ${wave.intervalMs}`,
        );
      }
    }
    if (!Number.isFinite(config.interWaveMs) || config.interWaveMs < 0) {
      throw new RangeError(
        `WaveDirector: interWaveMs must be ≥ 0, got ${config.interWaveMs}`,
      );
    }
    const spawnPointCount = config.spawnPointCount ?? 1;
    if (!Number.isInteger(spawnPointCount) || spawnPointCount < 1) {
      throw new RangeError(
        `WaveDirector: spawnPointCount must be an integer ≥ 1, got ${spawnPointCount}`,
      );
    }

    this.waves = structuredClone(config.waves);
    this.interWaveMs = config.interWaveMs;
    this.spawnPointCount = spawnPointCount;
  }

  /**
   * (Re)start the schedule: opening intermission, cursor rewound, flags
   * cleared. Calling this on a finished director replays the exact same
   * sequence — determinism is the point.
   */
  start(): void {
    this.phaseState = 'intermission';
    this.currentWaveIndex = -1;
    this.remaining = 0;
    this.countdownMs = this.interWaveMs;
    this.cursor = 0;
    this.waveStartedThisTick = false;
    this.waveEndedThisTick = false;
  }

  /**
   * Advance by one fixed step and return the spawns it produced (0 or 1
   * commands — see the timing contract in the class doc). Call this from
   * the game's fixedUpdate; read the flag getters right after.
   */
  tick(fixedDt: number): readonly SpawnCommand[] {
    this.waveStartedThisTick = false;
    this.waveEndedThisTick = false;
    if (this.phaseState === 'done') return [];

    this.countdownMs -= fixedDt * 1000;
    if (this.countdownMs > EXPIRY_EPSILON_MS) return [];

    if (this.phaseState === 'intermission') {
      const nextWave = this.waves[this.currentWaveIndex + 1];
      if (!nextWave) {
        this.phaseState = 'done';
        return [];
      }
      this.currentWaveIndex += 1;
      this.phaseState = 'spawning';
      this.waveStartedThisTick = true;
      this.remaining = nextWave.count;
      this.countdownMs = nextWave.intervalMs;
      return [this.emitSpawn()];
    }

    // 'spawning': keep the residual overshoot (+=, not =) so pacing stays
    // honest across float accumulation; at most one spawn per tick.
    this.countdownMs += this.waves[this.currentWaveIndex].intervalMs;
    return [this.emitSpawn()];
  }

  get phase(): WavePhase {
    return this.phaseState;
  }

  /** Index of the started wave, or -1 before the first wave. Stays at the
   * last wave once finished. */
  get currentWave(): number {
    return this.currentWaveIndex;
  }

  /** Spawns still owed by the current wave (0 outside 'spawning'). */
  get remainingInWave(): number {
    return this.remaining;
  }

  /** Countdown to the next event (spawn or wave start), ms. */
  get timeToNextMs(): number {
    return this.countdownMs;
  }

  /** True only in the tick whose transitions STARTED a wave (first spawn). */
  get waveJustStarted(): boolean {
    return this.waveStartedThisTick;
  }

  /** True only in the tick whose spawn EXHAUSTED a wave (last spawn). A
   * count-1 wave can start and end on the same tick. */
  get waveJustEnded(): boolean {
    return this.waveEndedThisTick;
  }

  /** Total spawns handed out since start(); mod spawnPointCount = the
   * next round-robin spawn point. */
  get spawnCursor(): number {
    return this.cursor;
  }

  private emitSpawn(): SpawnCommand {
    const command: SpawnCommand = {
      waveIndex: this.currentWaveIndex,
      spawnPointIndex: this.cursor % this.spawnPointCount,
    };
    this.cursor += 1;
    this.remaining -= 1;
    if (this.remaining === 0) {
      this.waveEndedThisTick = true;
      if (this.currentWaveIndex + 1 < this.waves.length) {
        this.phaseState = 'intermission';
        this.countdownMs = this.interWaveMs;
      } else {
        this.phaseState = 'done';
      }
    }
    return command;
  }
}
