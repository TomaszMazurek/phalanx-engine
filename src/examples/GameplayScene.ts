import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import type { EventBus } from '../core/EventBus';
import type { InputSystem } from '../core/InputSystem';
import type { System } from '../core/System';
import { DebugHUD } from '../editor/DebugHUD';
import { PlayerController } from '../scenes/PlayerController';
import { Scene } from '../scenes/Scene';
import type { GameEvents } from './GameEvents';

/**
 * GameplayScene — the Phase 2 fixed-timestep showcase (docs/phase-2-core.md,
 * tasks 6–7). A glTF model moved by abstract input actions on the fixed
 * timestep, rendered through interpolation — with a live toggle that makes
 * the difference visible.
 *
 * === Structural dependency types (headless testability) ===
 * `loadGLTF` returns three's `GLTF`; the scene only consumes
 * `result.scene.position.set(...)`. Declaring that minimal shape here keeps
 * src/examples/GameplayScene.test.ts three-free: the real `loadGLTF`
 * satisfies `ModelLoader` structurally (GLTF.scene is an Object3D, whose
 * `position.set(x, y, z)` matches exactly), and tests inject deferred fakes
 * — zero casts on both sides.
 */

/** The minimal model node this scene touches (structural slice of Object3D). */
export interface ModelNode {
  position: { set(x: number, y: number, z: number): unknown };
}

/** Structural slice of a loader result (GLTF satisfies this). */
export interface LoadedModel {
  readonly scene: ModelNode;
}

/** Asset factory for the demo model; `loadGLTF` (render/GLTFAdapter) fits. */
export type ModelLoader = (
  uri: string,
  onProgress?: (ratio: number) => void,
) => Promise<LoadedModel>;

/** Structural slice of RenderSystem — only setRenderOutput is used. */
export interface RenderOutputTarget {
  setRenderOutput(scene: THREE.Scene, camera: THREE.Camera): void;
}

export interface GameplayDeps {
  readonly render: RenderOutputTarget;
  readonly assets: AssetManager;
  readonly input: InputSystem;
  readonly events: EventBus<GameEvents>;
  readonly loadModel: ModelLoader;
}

export const MODEL_URI = 'models/demo-cube.gltf';

export class GameplayScene extends Scene {
  readonly id = 'gameplay';

  private readonly deps: GameplayDeps;
  private model: LoadedModel | null = null;

  /** three content — built in enter(), never before (preload stays headless). */
  private camera: THREE.PerspectiveCamera | null = null;
  private grid: THREE.GridHelper | null = null;

  constructor(deps: GameplayDeps) {
    super();
    this.deps = deps;
  }

  /**
   * Route the model through the shared AssetManager (cache + in-flight dedup
   * + aggregated progress). Scene instances are single-use (SceneManager
   * contract); the ASSET is not — revisiting this scene must hit the cache.
   */
  override async preload(onProgress: (ratio: number) => void): Promise<void> {
    const [model] = await this.deps.assets.preload(
      [{ uri: MODEL_URI, factory: this.deps.loadModel }],
      onProgress,
    );
    this.model = model;
  }

  /**
   * Execution order is a contract, not a preference:
   * player (edge-buffering update, see PlayerController) → mesh-sync (copies
   * player.lastRenderedPosition, already refreshed for this frame) → hud
   * (reads mesh-sync's interpolation flag). InputSystem itself is an
   * app-level system registered LAST — its update() clears the edges AFTER
   * these systems have consumed them.
   */
  override createSystems(): System[] {
    if (!this.model) {
      throw new Error('GameplayScene: createSystems before preload resolved (SceneManager misuse)');
    }
    const player = new PlayerController(this.deps.input);
    const meshSync = new MeshSyncSystem(player, this.model.scene, this.deps.input, this.deps.events);
    const hud = new HudSystem(meshSync);
    return [player, meshSync, hud];
  }

  override enter(): void {
    if (!this.model) {
      throw new Error('GameplayScene: enter before preload resolved (SceneManager misuse)');
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    // On +Z looking at the origin: screen-forward (W, moveY +1) = world −Z — PlayerController's axis convention.
    this.camera.position.set(0, 6, 10);
    this.camera.lookAt(0, 0.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directional = new THREE.DirectionalLight(0xffffff, 2.2);
    directional.position.set(4, 8, 6);
    scene.add(directional);

    this.grid = new THREE.GridHelper(24, 24, 0x37474f, 0x21262d);
    scene.add(this.grid);

    scene.add(this.model.scene as THREE.Object3D);

    this.deps.render.setRenderOutput(scene, this.camera);
  }

  override exit(): void {
    // DECISION (documented, Wave F nit): RenderSystem has no clear/clearOutput
    // API — the last set output keeps rendering (frozen) behind the next
    // scene's DOM. The next scene with 3D content re-points the output in its
    // enter(). Adding RenderOutputTarget.clear() is the clean fix; deferred
    // to avoid widening RenderSystem in this slice.
  }

  override dispose(): void {
    // Scene-local GPU resources only. The MODEL is owned by the AssetManager
    // cache (plan trap #5) — disposing it here would break a cache-hit revisit.
    this.grid?.dispose();
    this.grid = null;
    this.camera = null;
    this.model = null;
  }
}

/**
 * MeshSyncSystem — copies the player's render position onto the model each
 * frame and owns the interpolation toggle + 'back' navigation edge.
 *
 * Both edge reads happen in update() (frame phase): edges are still live
 * because InputSystem.update() — which clears them — runs AFTER this system
 * (registered last, see InputSystem class doc).
 */
class MeshSyncSystem implements System {
  readonly name = 'mesh-sync';

  private interpolationOn = true;

  private readonly player: PlayerController;
  private readonly model: ModelNode;
  private readonly input: InputSystem;
  private readonly events: EventBus<GameEvents>;

  constructor(
    player: PlayerController,
    model: ModelNode,
    input: InputSystem,
    events: EventBus<GameEvents>,
  ) {
    this.player = player;
    this.model = model;
    this.input = input;
    this.events = events;
  }

  get interpolationEnabled(): boolean {
    return this.interpolationOn;
  }

  update(_dt: number, _alpha: number): void {
    if (this.input.wasPressedThisFrame('toggleInterpolation')) {
      this.interpolationOn = !this.interpolationOn;
    }
    if (this.input.wasPressedThisFrame('back')) {
      this.events.emit('game/back', { via: 'input' });
    }

    // Interpolated: the player's own cached read (same alpha, same frame).
    // Raw: read(1) = the current fixed-step state — no smoothing, on purpose.
    const p = this.interpolationOn
      ? this.player.lastRenderedPosition
      : this.player.interpolatedPosition(1);
    this.model.position.set(p.x, p.y, p.z);
  }
}

/**
 * HudSystem — feeds the DebugHUD once per frame and counts fixed steps.
 * The DOM root is created in init() (mount phase), NOT in the constructor —
 * createSystems() runs headless in tests where `document` is undefined.
 */
class HudSystem implements System {
  readonly name = 'hud';

  private hud: DebugHUD | null = null;
  private root: HTMLDivElement | null = null;
  private stepsThisFrame = 0;
  private readonly meshSync: MeshSyncSystem;

  constructor(meshSync: MeshSyncSystem) {
    this.meshSync = meshSync;
  }

  init(): void {
    const root = document.createElement('div');
    document.body.appendChild(root);
    this.root = root;
    this.hud = new DebugHUD(root);
  }

  fixedUpdate(_fixedDt: number): void {
    this.stepsThisFrame += 1;
  }

  update(dt: number, alpha: number): void {
    this.hud?.update(dt, alpha, this.stepsThisFrame, this.meshSync.interpolationEnabled);
    this.stepsThisFrame = 0;
  }

  dispose(): void {
    this.root?.remove();
    this.root = null;
    this.hud = null;
  }
}
