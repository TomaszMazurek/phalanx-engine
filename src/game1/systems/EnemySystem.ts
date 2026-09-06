import * as THREE from 'three';
import type { AudioSystem } from '../../core/AudioSystem';
import { Health } from '../../core/Health';
import { Interpolated } from '../../core/Interpolated';
import type { System } from '../../core/System';
import type { TraumaShake } from '../../render/CameraShake';
import { SPAWN_PADS } from '../arenaMath';
import { stepToward } from '../combatMath';
import type { SphereLike } from '../combatMath';
import type { RoundState } from '../RoundState';
import type { EnemyMesh } from '../ArenaVisuals';
import { RUNNER_CENTER_Y } from '../ArenaVisuals';
import type { PlayerSystem } from './PlayerSystem';

/**
 * EnemySystem (Game 1, Sprint 0) — runners: magenta capsules that spawn on
 * the pads (WaveDirector commands), seek the player in a straight line
 * (no avoidance in S0) and deal contact damage.
 *
 * All positions live in simulation space (Interpolated, like the engine's
 * PlayerController) and are copied onto meshes in update() at the frame's
 * alpha. Death swaps the runner into a short kill flash (scale up + fade,
 * DEATH_FLASH seconds) before the mesh leaves the scene.
 *
 * Documented deviation from the task sketch: player "knockback" applies to
 * the RUNNER, not the player — PlayerController (engine, unmodified) has
 * no impulse API, so the impact reads through the runner being shoved
 * back plus camera trauma on the player hit.
 */

const RUNNER_HEALTH = 30;
const RUNNER_SPEED = 3.4;
const RUNNER_TOUCH_RADIUS = 0.95; // player 0.5 + runner body 0.45
const RUNNER_HIT_RADIUS = 0.55; // generous hitscan sphere (chest height)
const TOUCH_DAMAGE = 10;
const TOUCH_COOLDOWN = 0.5; // per runner, seconds
const TOUCH_KNOCKBACK = 1.5;
const PLAYER_HIT_TRAUMA = 0.35;
const DEATH_FLASH = 0.25;
const SPAWN_JITTER = 0.8;

/** One runner's live state. Exported so the weapon can hand hits back. */
export interface Runner {
  readonly mesh: EnemyMesh;
  readonly health: Health;
  readonly x: Interpolated;
  readonly z: Interpolated;
  /** Contact-damage cooldown, seconds; counts down in fixedUpdate. */
  hitCooldown: number;
  /** > 0 → dying: kill flash counts down in update(), body does not seek. */
  dying: number;
}

/** Hitscan spheres carry their runner back to the damage call site. */
export type RunnerSphere = SphereLike & { readonly runner: Runner };

export interface EnemyDeps {
  readonly player: PlayerSystem;
  readonly audio: AudioSystem;
  readonly shake: TraumaShake;
  readonly round: RoundState;
  readonly scene: THREE.Scene;
  readonly createEnemyMesh: () => EnemyMesh;
}

export class EnemySystem implements System {
  readonly name = 'enemies';

  private readonly runners: Runner[] = [];
  private readonly deps: EnemyDeps;

  constructor(deps: EnemyDeps) {
    this.deps = deps;
  }

  /** Spawn a runner on pad `spawnPointIndex` (WaveDirector round-robin). */
  spawnAt(spawnPointIndex: number): void {
    const pad = SPAWN_PADS[spawnPointIndex % SPAWN_PADS.length];
    const jitter = () => (Math.random() * 2 - 1) * SPAWN_JITTER;
    const x = pad.x + jitter();
    const z = pad.z + jitter();

    const mesh = this.deps.createEnemyMesh();
    mesh.position.set(x, RUNNER_CENTER_Y, z);
    this.deps.scene.add(mesh);

    this.runners.push({
      mesh,
      health: new Health(RUNNER_HEALTH),
      x: new Interpolated(x),
      z: new Interpolated(z),
      hitCooldown: 0,
      dying: 0,
    });
  }

  /**
   * Hitscan spheres of all LIVING runners, in list order (weapon indexes
   * back into this array to apply damage).
   */
  hitSpheres(): RunnerSphere[] {
    const spheres: RunnerSphere[] = [];
    for (const runner of this.runners) {
      if (runner.dying > 0) continue;
      spheres.push({
        x: runner.x.value,
        y: RUNNER_CENTER_Y,
        z: runner.z.value,
        radius: RUNNER_HIT_RADIUS,
        runner,
      });
    }
    return spheres;
  }

  /** Apply damage to a specific runner; true when THIS call killed it. */
  damage(runner: Runner, amount: number): boolean {
    if (runner.dying > 0) return false; // corpses take no hits
    const died = runner.health.damage(amount);
    if (died) {
      runner.dying = DEATH_FLASH;
      this.deps.audio.trigger('kill');
    }
    return died;
  }

  /** Runners still on the field (kill flashes excluded). */
  get livingCount(): number {
    let count = 0;
    for (const runner of this.runners) {
      if (runner.dying === 0) count += 1;
    }
    return count;
  }

  /** Remove every runner (round restart). */
  clear(): void {
    for (const runner of this.runners) {
      this.deps.scene.remove(runner.mesh);
      runner.mesh.material.dispose();
    }
    this.runners.length = 0;
  }

  fixedUpdate(fixedDt: number): void {
    if (this.deps.round.status !== 'playing') return; // round over: freeze
    const target = this.deps.player.simPosition;

    for (const runner of this.runners) {
      if (runner.dying > 0) continue;
      runner.hitCooldown = Math.max(0, runner.hitCooldown - fixedDt);

      const from = { x: runner.x.value, z: runner.z.value };
      const next = stepToward(from, target, RUNNER_SPEED, fixedDt);
      let nx = next.x;
      let nz = next.z;

      // Contact: touch → player damage + runner knockback + cooldown.
      const dx = next.x - target.x;
      const dz = next.z - target.z;
      if (Math.hypot(dx, dz) < RUNNER_TOUCH_RADIUS && runner.hitCooldown === 0) {
        runner.hitCooldown = TOUCH_COOLDOWN;
        this.deps.player.takeDamage(TOUCH_DAMAGE);
        this.deps.shake.addTrauma(PLAYER_HIT_TRAUMA);
        this.deps.audio.trigger('hit');
        const length = Math.max(Math.hypot(dx, dz), 1e-6);
        nx += (dx / length) * TOUCH_KNOCKBACK;
        nz += (dz / length) * TOUCH_KNOCKBACK;
      }

      runner.x.push(nx);
      runner.z.push(nz);
    }
  }

  update(dt: number, alpha: number): void {
    for (let index = this.runners.length - 1; index >= 0; index -= 1) {
      const runner = this.runners[index];

      if (runner.dying > 0) {
        // Kill flash: scale up + fade, then leave the scene.
        runner.dying -= dt;
        const k = Math.max(0, runner.dying / DEATH_FLASH);
        runner.mesh.scale.setScalar(1 + (1 - k) * 0.7);
        runner.mesh.material.opacity = k;
        if (runner.dying <= 0) {
          this.deps.scene.remove(runner.mesh);
          runner.mesh.material.dispose();
          this.runners.splice(index, 1);
        }
        continue;
      }

      runner.mesh.position.set(runner.x.read(alpha), RUNNER_CENTER_Y, runner.z.read(alpha));
    }
  }
}
