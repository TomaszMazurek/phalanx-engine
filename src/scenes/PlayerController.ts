import { Interpolated } from '../core/Interpolated';
import type { InputSystem } from '../core/InputSystem';
import type { System } from '../core/System';

/**
 * PlayerController — pure movement logic for the Phase 2 gameplay demo
 * (docs/phase-2-core.md, wave D). Advances a position over a ground plane
 * (y = 0) from abstract input axes, with a fixed-step hop. No three.js
 * here: the owning scene copies `lastRenderedPosition` onto a mesh.
 *
 * === Axis convention (screen-space) ===
 * moveY is SCREEN-forward — "away from the default camera", i.e. W walks
 * the player INTO the screen. moveX stays world +X (D = right). The
 * controller assumes the owning scene's camera sits on +Z looking toward
 * the origin (see GameplayScene), so screen-forward maps to world −Z:
 * moveY +1 → z decreases. Scenes with a different camera heading will
 * need a heading-mapping option later; that is intentionally out of scope
 * here (fixed-camera demo).
 *
 * === Input-buffer pattern (docs/phase-2-core.md, trap #2) ===
 * Jump is an edge (`wasPressedThisFrame`) read in `update()` — the frame
 * phase — and only a pending flag; `fixedUpdate` consumes the flag. This
 * survives 0–2 substeps per frame without missed or doubled jumps.
 * Registration order: BEFORE InputSystem (whose update clears the edges).
 *
 * Semantics: an airborne request is CONSUMED and DROPPED — no double jump,
 * no queueing for landing.
 *
 * Diagonal input: axes are combined into a vector and normalized when its
 * length exceeds 1 (digital WASD gives (±1, ±1); analog sticks are already
 * ≤ 1 per axis, and the combined digital+stick sum is clamped per axis by
 * InputSystem.getAxis).
 */
export interface PlayerPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlayerControllerOptions {
  /** Horizontal speed, units per second. Default 4. */
  readonly speed?: number;
  /** Initial vertical velocity of a hop, units per second. Default 6. */
  readonly jumpSpeed?: number;
  /** Gravity, units per second squared. Default 18. */
  readonly gravity?: number;
}

export class PlayerController implements System {
  readonly name = 'player';

  /**
   * Double-buffered position: `push` happens every fixed step, the render
   * side reads fractionally between the last two states.
   */
  readonly position: {
    readonly x: Interpolated;
    readonly y: Interpolated;
    readonly z: Interpolated;
  } = { x: new Interpolated(), y: new Interpolated(), z: new Interpolated() };

  private readonly speed: number;
  private readonly jumpSpeed: number;
  private readonly gravity: number;

  private x = 0;
  private y = 0;
  private z = 0;
  private vy = 0;
  private jumpRequested = false;

  /** Backing store for `lastRenderedPosition`; refreshed in `update()`. */
  private readonly rendered: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  private readonly input: InputSystem;

  constructor(input: InputSystem, options: PlayerControllerOptions = {}) {
    this.input = input;
    this.speed = options.speed ?? 4;
    this.jumpSpeed = options.jumpSpeed ?? 6;
    this.gravity = options.gravity ?? 18;
  }

  /** Frame phase: buffer the jump edge, cache the interpolated position. */
  update(_dt: number, alpha: number): void {
    if (this.input.wasPressedThisFrame('jump')) {
      this.jumpRequested = true;
    }
    this.rendered.x = this.position.x.read(alpha);
    this.rendered.y = this.position.y.read(alpha);
    this.rendered.z = this.position.z.read(alpha);
  }

  /** Deterministic step: horizontal axes, buffered jump, vertical integration. */
  fixedUpdate(fixedDt: number): void {
    let ax = this.input.getAxis('moveX');
    let az = this.input.getAxis('moveY');
    const length = Math.hypot(ax, az);
    if (length > 1) {
      ax /= length;
      az /= length;
    }
    this.x += ax * this.speed * fixedDt;
    // moveY is screen-forward: with the default camera on +Z looking at the
    // origin, "away from the camera" is world −Z — hence the minus sign.
    this.z -= az * this.speed * fixedDt;

    if (this.jumpRequested) {
      this.jumpRequested = false;
      if (this.y <= 0) {
        this.vy = this.jumpSpeed;
      }
    }

    this.y += this.vy * fixedDt;
    this.vy -= this.gravity * fixedDt;
    if (this.y <= 0 && this.vy <= 0) {
      this.y = 0;
      this.vy = 0;
    }

    this.position.x.push(this.x);
    this.position.y.push(this.y);
    this.position.z.push(this.z);
  }

  /** Ad-hoc interpolated position for `alpha` in [0, 1]. */
  interpolatedPosition(alpha: number): PlayerPosition {
    return {
      x: this.position.x.read(alpha),
      y: this.position.y.read(alpha),
      z: this.position.z.read(alpha),
    };
  }

  /**
   * Interpolated position cached by the last `update()` — what a render-side
   * system should copy onto the mesh. Same object every frame (no per-frame
   * allocation); treat it as read-only.
   */
  get lastRenderedPosition(): PlayerPosition {
    return this.rendered;
  }
}
