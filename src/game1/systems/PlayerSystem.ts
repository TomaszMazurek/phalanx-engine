import type * as THREE from 'three';
import { Health } from '../../core/Health';
import { InputSystem } from '../../core/InputSystem';
import type { Interpolated } from '../../core/Interpolated';
import { PlayerController } from '../../scenes/PlayerController';
import type { System } from '../../core/System';
import { ARENA_BOUNDS, clampToArena, gateMoveAxis, type ArenaBounds } from '../arenaMath';
import type { XZ } from '../aimMath';

/**
 * PlayerSystem (Game 1, Sprint 0) — the player as an engine-consumer:
 * reuses PlayerController verbatim (move axes, harmless hop), owns the
 * Health pool and the cyan capsule mesh, and enforces the arena walls.
 *
 * === Wall clamp without touching the engine ===
 * PlayerController has no bounds/impulse API and is engine code (unmodified
 * here), so clamping happens at the INPUT level: ArenaClampedInput below
 * gates the move axes to 0 when the player stands at a wall. Axis gating
 * has no dead zone (retreat reads full-strength immediately), unlike a
 * cosmetic clamp that would let the simulation drift outside and "stick".
 * clampToArena then absorbs the ≤ one-step overshoot for every consumer.
 *
 * All gameplay reads simPosition/renderedPosition (clamped) — never the
 * raw controller position.
 */

const PLAYER_MAX_HEALTH = 100;
const PLAYER_SPEED = 5;
const PLAYER_MESH_HALF_HEIGHT = 0.8;

/**
 * InputSystem view with arena gating. Never started (no listeners — the
 * constructor only loads inert defaults); PlayerController reads axes and
 * the jump edge through it, everything else forwards to the real system.
 */
class ArenaClampedInput extends InputSystem {
  private source: (() => { readonly x: Interpolated; readonly z: Interpolated }) | null = null;
  private readonly real: InputSystem;
  private readonly bounds: ArenaBounds;

  constructor(real: InputSystem, bounds: ArenaBounds) {
    super(); // inert: this wrapper is never started, only read through
    this.real = real;
    this.bounds = bounds;
  }

  /** Point this wrapper at the CURRENT controller (rebound on respawn). */
  bind(source: () => { readonly x: Interpolated; readonly z: Interpolated }): void {
    this.source = source;
  }

  override getAxis(axisName: string): number {
    const value = this.real.getAxis(axisName);
    if (this.source === null || value === 0) return value;
    if (axisName !== 'moveX' && axisName !== 'moveY') return value;
    const position = this.source();
    return gateMoveAxis(
      axisName,
      value,
      { x: position.x.value, z: position.z.value },
      this.bounds,
    );
  }

  override wasPressedThisFrame(action: string): boolean {
    return this.real.wasPressedThisFrame(action);
  }
}

export class PlayerSystem implements System {
  readonly name = 'player';

  readonly health = new Health(PLAYER_MAX_HEALTH);

  private readonly clampedInput: ArenaClampedInput;
  private controller: PlayerController;
  private readonly mesh: THREE.Mesh;
  private readonly bounds: ArenaBounds;

  constructor(input: InputSystem, mesh: THREE.Mesh, bounds: ArenaBounds = ARENA_BOUNDS) {
    this.bounds = bounds;
    this.mesh = mesh;
    this.clampedInput = new ArenaClampedInput(input, bounds);
    this.controller = this.spawnController();
  }

  /**
   * Fresh controller at the arena center. Respawn swaps the instance — the
   * engine's controller has no reset API, and a new one is the honest
   * full reset (position, hop state, interpolation buffers).
   */
  private spawnController(): PlayerController {
    const controller = new PlayerController(this.clampedInput, { speed: PLAYER_SPEED });
    this.clampedInput.bind(() => controller.position);
    return controller;
  }

  /** Live simulation position, clamped to the play area. */
  get simPosition(): XZ {
    return clampToArena(
      { x: this.controller.position.x.value, z: this.controller.position.z.value },
      this.bounds,
    );
  }

  /** Interpolated render position, clamped (mesh, camera and aim read this). */
  get renderedPosition(): XZ {
    const p = this.controller.lastRenderedPosition;
    return clampToArena({ x: p.x, z: p.z }, this.bounds);
  }

  /** Interpolated vertical position (hop). */
  get renderedY(): number {
    return this.controller.lastRenderedPosition.y;
  }

  /** Apply damage to the player pool; true when THIS call killed them. */
  takeDamage(amount: number): boolean {
    return this.health.damage(amount);
  }

  /** Full reset for round restart: fresh pool, fresh controller at center. */
  respawn(): void {
    this.health.reset();
    this.controller = this.spawnController();
    this.mesh.visible = true;
  }

  /** Defeat hides the body (respawn shows it again). */
  setVisualDead(dead: boolean): void {
    this.mesh.visible = !dead;
  }

  fixedUpdate(fixedDt: number): void {
    this.controller.fixedUpdate(fixedDt);
  }

  update(dt: number, alpha: number): void {
    this.controller.update(dt, alpha);
    const p = this.renderedPosition;
    this.mesh.position.set(p.x, this.renderedY + PLAYER_MESH_HALF_HEIGHT, p.z);
  }
}
