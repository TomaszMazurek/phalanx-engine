import * as THREE from 'three';

/**
 * TraumaShake — juice v0 camera shake (Game 1, Sprint 0:
 * docs/games/GAME-1-plan.md, "juice utils (screen-shake)").
 *
 * Pure math, no three.js dependency: the class only produces a 2-D offset;
 * `applyToCamera` (below) is the thin render-side bridge. Amplitude is
 * `maxShake · trauma²` — the square is the classic trick so small hits
 * wobble gently while heavy hits escalate hard. The trace itself is two
 * incommensurate sin/cos frequencies (29 Hz / 37 Hz), a cheap parametric
 * stand-in for noise that is fully deterministic given the time input:
 * same state + same time → same offset, so replay/debugging stay exact.
 *
 * Intended frame use: add trauma on events (shot fired, player hit), call
 * `update(dt)` once per frame to decay it, then sample `offsetAt(time)` with
 * the game's elapsed clock for the render pass.
 */

/** Shake frequency per axis, Hz. Coprime-ish on purpose: the offset trace
 * fills 2-D space instead of walking a single diagonal. */
const SHAKE_HZ_X = 29;
const SHAKE_HZ_Y = 37;

export interface TraumaShakeOptions {
  /** Maximum position offset (world units) at trauma 1. Default 0.5. */
  readonly maxShake?: number;
  /** Trauma units recovered per second. Default 1.5 (full calm in ~0.67 s). */
  readonly traumaDecay?: number;
}

export interface ShakeOffset {
  readonly x: number;
  readonly y: number;
}

export class TraumaShake {
  private traumaValue = 0;
  private readonly maxShake: number;
  private readonly traumaDecay: number;

  constructor(options: TraumaShakeOptions = {}) {
    this.maxShake = options.maxShake ?? 0.5;
    this.traumaDecay = options.traumaDecay ?? 1.5;
  }

  /** Current trauma, always within [0, 1]. */
  get trauma(): number {
    return this.traumaValue;
  }

  /** Peak offset length this state can produce (maxShake · trauma²). */
  get amplitude(): number {
    return this.maxShake * this.traumaValue * this.traumaValue;
  }

  /**
   * Add trauma (a hit, an explosion). Accumulates and clamps into [0, 1];
   * negative amounts are clamped away — trauma only ever comes in.
   */
  addTrauma(amount: number): void {
    this.traumaValue = Math.min(1, Math.max(0, this.traumaValue + Math.max(0, amount)));
  }

  /** Decay trauma linearly by `dt` seconds. Never goes below 0. */
  update(dt: number): void {
    this.traumaValue = Math.max(0, this.traumaValue - this.traumaDecay * dt);
  }

  /**
   * Offset for the given clock time — PURE: no state changes, identical
   * result for identical state+time. Zero while calm; bounded by
   * maxShake·trauma² at all times.
   */
  offsetAt(timeSeconds: number): ShakeOffset {
    if (this.traumaValue === 0) return { x: 0, y: 0 }; // calm: exact zeros, no sin/cos work
    const amplitude = this.amplitude;
    return {
      x: amplitude * Math.sin(2 * Math.PI * SHAKE_HZ_X * timeSeconds),
      y: amplitude * Math.cos(2 * Math.PI * SHAKE_HZ_Y * timeSeconds),
    };
  }
}

/**
 * Thin render-side bridge (untested by design, like the rest of the
 * three-touching glue): add a shake offset to a camera. The CALLER owns
 * reverting — keep the un-shaken transform and re-apply it each frame
 * before calling this (the shake is additive on top of the base position).
 */
export function applyToCamera(
  camera: THREE.Camera,
  offset: ShakeOffset,
  intensity = 1,
): void {
  camera.position.x += offset.x * intensity;
  camera.position.y += offset.y * intensity;
}
