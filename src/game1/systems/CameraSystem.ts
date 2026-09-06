import * as THREE from 'three';
import { TraumaShake, applyToCamera } from '../../render/CameraShake';
import type { System } from '../../core/System';
import type { PlayerSystem } from './PlayerSystem';

/**
 * CameraSystem (Game 1, Sprint 0) — fixed-angle follow camera for the
 * twin-stick layout (decision D5): player + (0, 16, 12), smoothed with an
 * exponential lerp (frame-rate independent), looking at the player.
 *
 * TraumaShake (engine juice util) rides ON TOP: the base transform is
 * re-applied every frame before the additive shake offset, per the
 * applyToCamera contract. offsetAt runs on this system's own elapsed
 * clock; matrixWorld is refreshed here so the AimSystem raycast (running
 * later in the same frame) unprojects through this frame's camera.
 */

const CAMERA_OFFSET = new THREE.Vector3(0, 16, 12);
const SMOOTHING = 8; // higher = stiffer follow
const LOOK_AT_Y = 0.6;

export class CameraSystem implements System {
  readonly name = 'camera';

  private readonly camera: THREE.PerspectiveCamera;
  private readonly shake: TraumaShake;
  private readonly player: PlayerSystem;
  private readonly desired = new THREE.Vector3();
  private elapsed = 0;

  constructor(camera: THREE.PerspectiveCamera, shake: TraumaShake, player: PlayerSystem) {
    this.camera = camera;
    this.shake = shake;
    this.player = player;
  }

  update(dt: number): void {
    this.elapsed += dt;
    const p = this.player.renderedPosition;

    // Base transform first (shake is additive on top of it, every frame).
    this.desired.set(p.x, CAMERA_OFFSET.y, p.z + CAMERA_OFFSET.z);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-SMOOTHING * dt));
    this.camera.lookAt(p.x, LOOK_AT_Y, p.z);

    this.shake.update(dt);
    applyToCamera(this.camera, this.shake.offsetAt(this.elapsed));
    this.camera.updateMatrixWorld();
  }

  /** Teleport onto the player (round restart — no fly-back across the arena). */
  snap(): void {
    const p = this.player.renderedPosition;
    this.camera.position.set(p.x, CAMERA_OFFSET.y, p.z + CAMERA_OFFSET.z);
    this.camera.lookAt(p.x, LOOK_AT_Y, p.z);
  }
}
