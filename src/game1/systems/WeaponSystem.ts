import * as THREE from 'three';
import type { AudioSystem } from '../../core/AudioSystem';
import type { InputSystem } from '../../core/InputSystem';
import type { System } from '../../core/System';
import type { TraumaShake } from '../../render/CameraShake';
import { AIM_PLANE_Y, type Vec3 } from '../aimMath';
import { nearestSphereHit } from '../combatMath';
import { FireTimer } from '../FireTimer';
import type { RoundState } from '../RoundState';
import type { PlayerSystem } from './PlayerSystem';
import type { AimSystem } from './AimSystem';
import type { EnemySystem } from './EnemySystem';
import type { HudSystem } from './HudSystem';

/**
 * WeaponSystem (Game 1, Sprint 0) — hold-fire hitscan with feel layered on:
 * tracer + muzzle flash + recoil trauma + procedural shot/hit audio.
 *
 * Firing is a FIXED-step decision (deterministic, FireTimer over its own
 * sim clock); the ray runs through nearestSphereHit (pure) against enemy
 * SIM positions — no mesh coupling. Visual decay (tracer fade, muzzle
 * pop) happens in update() on frame time.
 *
 * Input: the 'fire' action (mouse primary + gamepad RT, see bindings.ts).
 */

const FIRE_COOLDOWN_MS = 140;
const SHOT_DAMAGE = 10;
const SHOT_RANGE = 30;
const TRACER_LIFETIME = 0.08;
const MUZZLE_LIFETIME = 0.06;
const RECOIL_TRAUMA = 0.15;
const TRACER_POOL = 12;
const MUZZLE_OFFSET = 0.9;

interface Tracer {
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  life: number;
}

export interface WeaponDeps {
  readonly input: InputSystem;
  readonly player: PlayerSystem;
  readonly aim: AimSystem;
  readonly enemies: EnemySystem;
  readonly hud: HudSystem;
  readonly audio: AudioSystem;
  readonly shake: TraumaShake;
  readonly round: RoundState;
  readonly muzzle: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  readonly fxGroup: THREE.Group;
}

export class WeaponSystem implements System {
  readonly name = 'weapon';

  private readonly deps: WeaponDeps;
  private readonly timer = new FireTimer(FIRE_COOLDOWN_MS);
  private readonly tracers: Tracer[] = [];
  private readonly tracerGeometry = new THREE.BoxGeometry(0.06, 0.06, 1);
  private simMs = 0;
  private muzzleLife = 0;

  constructor(deps: WeaponDeps) {
    this.deps = deps;
  }

  fixedUpdate(fixedDt: number): void {
    if (this.deps.round.status !== 'playing') return;
    this.simMs += fixedDt * 1000;

    if (!this.deps.input.isDown('fire')) return;
    if (!this.timer.tryFire(this.simMs)) return;
    this.fire();
  }

  private fire(): void {
    const player = this.deps.player.simPosition;
    const origin: Vec3 = { x: player.x, y: AIM_PLANE_Y, z: player.z };
    const dir: Vec3 = { x: this.deps.aim.direction.x, y: 0, z: this.deps.aim.direction.z };

    const spheres = this.deps.enemies.hitSpheres();
    const hit = nearestSphereHit(origin, dir, spheres);
    const died = hit === null ? false : this.deps.enemies.damage(spheres[hit.index].runner, SHOT_DAMAGE);

    // Tracer reaches the hit point, or full range into the dark.
    const end: Vec3 =
      hit === null
        ? {
            x: origin.x + dir.x * SHOT_RANGE,
            y: AIM_PLANE_Y,
            z: origin.z + dir.z * SHOT_RANGE,
          }
        : hit.point;
    this.spawnTracer(origin, end);
    this.flashMuzzle(origin, dir);

    this.deps.shake.addTrauma(RECOIL_TRAUMA);
    this.deps.audio.trigger('shoot');
    if (hit !== null) {
      this.deps.audio.trigger('hit');
      this.deps.hud.flashHitMarker(died);
    }
  }

  private spawnTracer(from: Vec3, to: Vec3): void {
    let tracer = this.tracers.find((candidate) => candidate.life <= 0);
    if (!tracer) {
      if (this.tracers.length >= TRACER_POOL) return; // saturated: drop oldest shot's tail
      const mesh = new THREE.Mesh(
        this.tracerGeometry,
        new THREE.MeshBasicMaterial({ color: 0x9becff, transparent: true, opacity: 1 }),
      );
      mesh.visible = false;
      this.deps.fxGroup.add(mesh);
      tracer = { mesh, life: 0 };
      this.tracers.push(tracer);
    }

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.max(Math.hypot(dx, dz), 0.01);
    tracer.mesh.visible = true;
    tracer.mesh.position.set((from.x + to.x) / 2, AIM_PLANE_Y, (from.z + to.z) / 2);
    tracer.mesh.scale.set(1, 1, length); // unit-length box stretched along +Z
    tracer.mesh.rotation.y = Math.atan2(dx, dz);
    tracer.mesh.material.opacity = 1;
    tracer.life = TRACER_LIFETIME;
  }

  private flashMuzzle(origin: Vec3, dir: Vec3): void {
    const muzzle = this.deps.muzzle;
    muzzle.visible = true;
    muzzle.position.set(
      origin.x + dir.x * MUZZLE_OFFSET,
      origin.y + 0.05,
      origin.z + dir.z * MUZZLE_OFFSET,
    );
    this.muzzleLife = MUZZLE_LIFETIME;
  }

  update(dt: number): void {
    for (const tracer of this.tracers) {
      if (tracer.life <= 0) continue;
      tracer.life -= dt;
      tracer.mesh.material.opacity = Math.max(0, tracer.life / TRACER_LIFETIME);
      if (tracer.life <= 0) tracer.mesh.visible = false;
    }

    if (this.muzzleLife > 0) {
      this.muzzleLife -= dt;
      const k = Math.max(0, this.muzzleLife / MUZZLE_LIFETIME);
      this.deps.muzzle.material.opacity = k;
      this.deps.muzzle.scale.setScalar(0.6 + 0.9 * k); // pops big, shrinks away
      if (this.muzzleLife <= 0) this.deps.muzzle.visible = false;
    }
  }

  /** Round restart: kill all live effects instantly. */
  reset(): void {
    for (const tracer of this.tracers) {
      tracer.life = 0;
      tracer.mesh.visible = false;
    }
    this.muzzleLife = 0;
    this.deps.muzzle.visible = false;
  }

  dispose(): void {
    for (const tracer of this.tracers) {
      this.deps.fxGroup.remove(tracer.mesh);
      tracer.mesh.material.dispose();
    }
    this.tracers.length = 0;
    this.tracerGeometry.dispose();
  }
}
