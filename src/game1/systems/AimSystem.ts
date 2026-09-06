import * as THREE from 'three';
import type { InputSystem } from '../../core/InputSystem';
import type { System } from '../../core/System';
import { AIM_PLANE_Y, pointerToNdc, rayPlanePoint, xzDirection, type XZ } from '../aimMath';

/**
 * AimSystem (Game 1, Sprint 0) — twin-stick aim resolution, one direction
 * per frame, world-space on the ground plane.
 *
 * PRECEDENCE RULE (documented decision): the right stick wins whenever its
 * rescaled magnitude exceeds STICK_AIM_OVERRIDE (0.3) — the stick is an
 * explicit, continuous intent. Below that (centered stick, mouse-only
 * player) the mouse ray decides. Stick aim maps straight to world axes
 * (+aimX → +X, +aimY → −Z): the fixed-angle camera never rotates, so
 * world axes read constant on screen and the mapping feels 1:1.
 *
 * Mouse aim: pointer px → NDC → THREE.Raycaster through the game camera →
 * intersection with the horizontal aim plane (rayPlanePoint, pure). A ray
 * parallel to the plane or hitting it from behind keeps the last aim.
 */

/** Stick magnitude (after the engine deadzone rescale) that overrides mouse aim. */
export const STICK_AIM_OVERRIDE = 0.3;

const AIM_INDICATOR_LENGTH = 6;
const AIM_BAR_DISTANCE = 1.5;
const AIM_BAR_Y = 0.95;
const AIM_MARKER_Y = 0.03;

export class AimSystem implements System {
  readonly name = 'aim';

  /** Unit world-space aim direction (XZ). Weapons fire along this.
   *  The field is readonly (never reassigned); its components are mutated
   *  in place — zero per-frame allocation. */
  readonly direction: { x: number; z: number } = { x: 0, z: 1 };

  /** Aim point on the ground plane (mouse) or player + direction·length (stick). */
  readonly point: { x: number; z: number } = { x: 0, z: AIM_INDICATOR_LENGTH };

  private readonly input: InputSystem;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly getPlayer: () => XZ;
  private readonly bar: THREE.Mesh;
  private readonly marker: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  constructor(
    input: InputSystem,
    camera: THREE.PerspectiveCamera,
    getPlayer: () => XZ,
    bar: THREE.Mesh,
    marker: THREE.Mesh,
  ) {
    this.input = input;
    this.camera = camera;
    this.getPlayer = getPlayer;
    this.bar = bar;
    this.marker = marker;
  }

  update(): void {
    const player = this.getPlayer();

    const ax = this.input.getAxis('aimX');
    const ay = this.input.getAxis('aimY');
    const magnitude = Math.hypot(ax, ay);
    if (magnitude > STICK_AIM_OVERRIDE) {
      this.direction.x = ax / magnitude;
      this.direction.z = -ay / magnitude; // stick up = world −Z (camera on +Z)
      this.point.x = player.x + this.direction.x * AIM_INDICATOR_LENGTH;
      this.point.z = player.z + this.direction.z * AIM_INDICATOR_LENGTH;
    } else {
      const pointer = this.input.lastPointerPosition;
      const ndc = pointerToNdc(pointer.x, pointer.y, window.innerWidth, window.innerHeight);
      this.ndc.set(ndc.x, ndc.y);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hit = rayPlanePoint(
        this.raycaster.ray.origin,
        this.raycaster.ray.direction,
        AIM_PLANE_Y,
      );
      if (hit) {
        const dir = xzDirection(player, hit);
        if (dir) {
          this.direction.x = dir.x;
          this.direction.z = dir.z;
        }
        this.point.x = hit.x;
        this.point.z = hit.z;
      }
      // Parallel/behind ray (pointer at the horizon): keep the last aim.
    }

    // Indicator visuals: short bar ahead of the player + ring at the point.
    this.bar.position.set(
      player.x + this.direction.x * AIM_BAR_DISTANCE,
      AIM_BAR_Y,
      player.z + this.direction.z * AIM_BAR_DISTANCE,
    );
    this.bar.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.marker.position.set(this.point.x, AIM_MARKER_Y, this.point.z);
  }
}
