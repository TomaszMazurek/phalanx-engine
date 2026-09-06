import * as THREE from 'three';
import type { AssetManager } from '../assets/AssetManager';
import type { System } from '../core/System';
import { Interpolated } from '../core/Interpolated';
import type { LoadedAssets, TextureSet } from '../render/TextureLibrary';
import { isModelId, loadModelShape, MeshFactory } from '../render/MeshFactory';
import { createPhongMaterial, createStandardMaterial } from '../render/MaterialPresets';
import { LightingRig } from '../render/LightingRig';

/** Which of the two side-by-side slots; picks the preset material family. */
type SlotKind = 'phong' | 'standard';

/** Texture slots setRepeat tiles — per shading family (standard keeps the
 * extra roughnessMap slot; neither list includes displacementMap, whose
 * repeat the presets never tile). */
const STANDARD_REPEAT_SLOTS = ['map', 'bumpMap', 'normalMap', 'aoMap', 'roughnessMap'] as const;
const PHONG_REPEAT_SLOTS = ['map', 'bumpMap', 'normalMap', 'aoMap'] as const;

/**
 * Slot target radius: primitives are built at Sphere scale (radius 120),
 * and the camera frames that — models are normalized to fit the same slot.
 */
const PRIMITIVE_SLOT_RADIUS = 120;

/**
 * MaterialViewer — the Phase 1 example scene (task 8).
 *
 * Reborn `materialeditor_js` app: two meshes (Phong + PBR) side by side on the
 * selected texture set, skybox background, configurable lighting. The old
 * `app.*` globals are gone; state lives in `params` and the DevPanel mutates
 * it through the public setters.
 *
 * Phase 2 demo of the fixed-timestep pipeline (docs/phase-2-core.md, task 1):
 * rotation advances in `fixedUpdate` at a constant 60 Hz, and `update` renders
 * the interpolated in-between state — the pattern wave D scenes build on.
 *
 * Wave C3 (docs/phase-3-materials.md): `shape` also accepts `model:<name>`
 * ids (MeshFactory namespace — appears in the DevPanel dropdown via
 * `MeshFactory.list()`). A model id swaps the two primitive meshes for two
 * clones of the loaded glTF scene (one Phong, one Standard) carrying the
 * SAME preset materials as primitives — the MaterialCompiler rewiring is
 * wave E. setShape stays synchronous for primitives; model ids resolve
 * asynchronously behind the same sync API with last-write-wins semantics
 * (see setShape). Visual acceptance of the model path is wave E (manual).
 */
export interface ViewerParams {
  speed: number;
  shape: string;
  texture: string;
  skybox: string;
  normalMap: boolean;
  shininess: number;
  roughness: number;
  metalness: number;
  repeatU: number;
  repeatV: number;
  pointLightPower: number;
  directionalLightPower: number;
}

export class MaterialViewer implements System {
  readonly name = 'viewer';
  readonly scene = new THREE.Scene();
  readonly params: ViewerParams = {
    speed: 0.001,
    shape: 'Sphere',
    texture: 'metal3',
    skybox: 'bethnal',
    normalMap: true,
    shininess: 128,
    roughness: 0.8,
    metalness: 0,
    repeatU: 1,
    repeatV: 1,
    pointLightPower: 0,
    directionalLightPower: 0.7,
  };

  private readonly assets: LoadedAssets;
  /**
   * Cache for `model:<name>` shapes. Optional: without it the viewer serves
   * primitives only and setShape rejects model ids explicitly. The loaded
   * glTF (and its geometries/materials) is cache-owned — never disposed here.
   */
  private readonly models: AssetManager | null;
  private readonly lighting: LightingRig;
  /** Current display roots — primitive THREE.Mesh or a loaded model clone. */
  private meshPhong: THREE.Object3D | null = null;
  private meshStandard: THREE.Object3D | null = null;

  /** Bumped by every setShape; an in-flight model load applies only while
   * its epoch is still current (last-write-wins — see setShape). */
  private shapeEpoch = 0;

  /**
   * Late-wired hook, fired AFTER every operation that rebuilds slot
   * materials ({@link MaterialViewer.setTexture} / normal-map toggle via
   * rebuildMaterials, a model swap, the model→primitive rebuild) — fresh
   * preset materials replaced whatever was applied, so the listener
   * (viewer.ts wires the MaterialEditor's reapply) restores the edit.
   * Optional PUBLIC FIELD rather than a constructor dep because boot order
   * is fixed the other way: the viewer exists before the editor that
   * depends on its meshes, so the wire happens after both are built.
   * Async (model swap): fires once, after both clones are in place.
   */
  onSlotsRebuilt?: () => void;

  /** Simulation rotation, advanced in fixedUpdate; both meshes share it. */
  private readonly spinX = new Interpolated();
  private readonly spinY = new Interpolated();

  constructor(assets: LoadedAssets, models?: AssetManager | null) {
    this.assets = assets;
    this.models = models ?? null;
    this.scene.background = assets.skyboxes.get(this.params.skybox) ?? null;
    this.lighting = new LightingRig(this.scene);
  }

  get textureIds(): string[] {
    return [...this.assets.sets.keys()];
  }

  get skyboxIds(): string[] {
    return [...this.assets.skyboxes.keys()];
  }

  /** The viewer's lighting rig (wave E1b): read-only access for preset
   * appliers (applyLightingPreset) driving the same lights the DevPanel
   * sliders do — the rig itself stays viewer-owned. */
  get lightingRig(): LightingRig {
    return this.lighting;
  }

  /**
   * The meshes the material editor drives (wave E1b), looked up FRESH on
   * every call — shape/model swaps replace the slot roots behind any
   * cached reference, so callers (MaterialTarget) must never hold the
   * result across applies. Primitives return their two root meshes
   * (traverse visits the root itself); a model clone returns every mesh
   * under it, all carrying the slot's single preset material.
   */
  getEditorMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const root of [this.meshPhong, this.meshStandard]) {
      root?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
        }
      });
    }
    return meshes;
  }

  init(): void {
    this.meshPhong = this.createMesh(200);
    this.meshStandard = this.createMesh(-200);
  }

  /** Deterministic rotation advance — one fixed step (1/60 s) at a time. */
  fixedUpdate(fixedDt: number): void {
    // `speed` is tuned as a per-60Hz-step increment (Phase 1 was per-frame);
    // the fixedDt× 60 factor keeps the visible rate identical on any FIXED_DT.
    const advance = this.params.speed * fixedDt * 60;
    this.spinX.push(this.spinX.value + advance);
    this.spinY.push(this.spinY.value + advance);
  }

  /** Render phase: apply the interpolated rotation to both meshes. */
  update(_dt: number, alpha: number): void {
    const rotationX = this.spinX.read(alpha);
    const rotationY = this.spinY.read(alpha);
    for (const mesh of [this.meshPhong, this.meshStandard]) {
      if (mesh) {
        mesh.rotation.x = rotationX;
        mesh.rotation.y = rotationY;
      }
    }
  }

  /**
   * Switch the displayed shape. Synchronous for primitives (the Phase 1
   * fire-and-forget API is preserved). For `model:<name>` ids the geometry
   * needs a fetch, so the swap completes ASYNC — DevPanel's onChange can
   * stay fire-and-forget.
   *
   * Concurrency — last-write-wins: every call bumps `shapeEpoch`. When a
   * model load settles it applies ONLY if no newer setShape happened; a
   * primitive picked while a model loads therefore wins, and two rapid
   * model picks load both but apply only the last.
   */
  setShape(shape: string): void {
    const models = this.models;
    if (isModelId(shape)) {
      if (!models) {
        throw new Error(
          'MaterialViewer: model shapes need an AssetManager — pass one to the constructor',
        );
      }
      this.params.shape = shape;
      this.shapeEpoch += 1;
      void this.swapInModel(shape, models, this.shapeEpoch).catch(
        (error: unknown) => console.error('[viewer] model load failed:', error),
      );
      return;
    }
    this.params.shape = shape;
    this.shapeEpoch += 1;
    this.applyPrimitiveShape(shape);
  }

  setTexture(textureId: string): void {
    this.params.texture = textureId;
    this.rebuildMaterials();
  }

  setSkybox(skyboxId: string): void {
    const skybox = this.assets.skyboxes.get(skyboxId);
    if (skybox) {
      this.params.skybox = skyboxId;
      this.scene.background = skybox;
    }
  }

  setNormalMap(enabled: boolean): void {
    this.params.normalMap = enabled;
    this.rebuildMaterials();
  }

  setShininess(value: number): void {
    this.params.shininess = value;
    for (const material of this.materialsOf(this.meshPhong)) {
      if (material instanceof THREE.MeshPhongMaterial) {
        material.shininess = value;
      }
    }
  }

  setRoughness(value: number): void {
    this.params.roughness = value;
    for (const material of this.materialsOf(this.meshStandard)) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.roughness = value;
      }
    }
  }

  setMetalness(value: number): void {
    this.params.metalness = value;
    for (const material of this.materialsOf(this.meshStandard)) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.metalness = value;
      }
    }
  }

  setRepeat(u: number, v: number): void {
    this.params.repeatU = u;
    this.params.repeatV = v;
    for (const [root] of this.slots()) {
      for (const material of this.materialsOf(root)) {
        if (material instanceof THREE.MeshStandardMaterial) {
          for (const slot of STANDARD_REPEAT_SLOTS) {
            material[slot]?.repeat.set(u, v);
          }
        } else if (material instanceof THREE.MeshPhongMaterial) {
          for (const slot of PHONG_REPEAT_SLOTS) {
            material[slot]?.repeat.set(u, v);
          }
        }
      }
    }
  }

  setPointLight(value: number): void {
    this.params.pointLightPower = value;
    this.lighting.setPointIntensity(value);
  }

  setDirectionalLight(value: number): void {
    this.params.directionalLightPower = value;
    this.lighting.setDirectionalIntensity(value);
  }

  private createMesh(x: number): THREE.Mesh {
    const set = this.currentSet();
    const phongMaterial = createPhongMaterial(set, this.params.normalMap, this.params.shininess);
    const mesh = new THREE.Mesh(MeshFactory.create(this.params.shape), phongMaterial);
    mesh.name = `phong_${this.params.texture}`;
    mesh.position.set(x, 50, 0);
    this.scene.add(mesh);
    return mesh;
  }

  /** The two display roots with the preset family each one carries. */
  private slots(): Array<[THREE.Object3D | null, SlotKind]> {
    return [
      [this.meshPhong, 'phong'],
      [this.meshStandard, 'standard'],
    ];
  }

  /** Sync primitive swap — the original setShape body. Primitive→primitive
   * keeps its in-place geometry swap (materials persist across shapes); if
   * a model clone currently occupies the slots, the primitive pair is
   * rebuilt fresh instead (their materials don't survive detachSlots). */
  private applyPrimitiveShape(shape: string): void {
    if (this.meshPhong !== null && !(this.meshPhong instanceof THREE.Mesh)) {
      this.detachSlots();
      this.meshPhong = this.createMesh(200);
      this.meshStandard = this.createMesh(-200);
      // Fresh materials don't carry the configured tiling — restore it.
      this.setRepeat(this.params.repeatU, this.params.repeatV);
      this.onSlotsRebuilt?.(); // fresh preset materials wiped any editor apply
      return;
    }
    const side = MeshFactory.sideOf(shape);
    for (const mesh of [this.meshPhong, this.meshStandard]) {
      if (!(mesh instanceof THREE.Mesh)) continue;
      mesh.geometry.dispose();
      mesh.geometry = MeshFactory.create(shape);
      const material = this.materialOf(mesh);
      material.side = side;
      material.needsUpdate = true;
    }
  }

  /** Async half of setShape for model ids. Two independent clones come from
   * ONE cached load: the AssetManager dedups the concurrent loadModelShape
   * calls and each call clones — the two slots must not share a transform
   * (each side spins independently). */
  private async swapInModel(id: string, models: AssetManager, epoch: number): Promise<void> {
    const [phong, standard] = await Promise.all([
      loadModelShape(id, models),
      loadModelShape(id, models),
    ]);
    // Last-write-wins guard: any setShape since we started (primitive OR
    // model) bumped the epoch — this load is stale and never reaches the
    // scene. The clones are garbage-collected; nothing cache-owned leaks.
    if (epoch !== this.shapeEpoch) {
      return;
    }
    this.detachSlots();
    this.meshPhong = this.placeModel(phong, 200, 'phong');
    this.meshStandard = this.placeModel(standard, -200, 'standard');
    this.setRepeat(this.params.repeatU, this.params.repeatV);
    this.onSlotsRebuilt?.(); // fresh preset materials wiped any editor apply
  }

  /** Put one model clone into a viewer slot: scaled to primitive slot size,
   * every glTF material REPLACED by the current preset — by reference, NOT
   * disposed: the originals are shared with the AssetManager cache.
   * Runs before the clone enters the slot, so the slot invariant below
   * (every attached material is viewer-created) holds from the first frame. */
  private placeModel(root: THREE.Object3D, x: number, kind: SlotKind): THREE.Object3D {
    const set = this.currentSet();
    // Viewer slots are tuned for ~200-unit primitives while glTF authors in
    // meters — normalize the bounding sphere so any .glb presents like a
    // primitive (C3 target: "kostka demo + dowolny .glb").
    const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
    root.scale.setScalar(sphere.radius > 0 ? PRIMITIVE_SLOT_RADIUS / sphere.radius : 1);
    const material = this.presetMaterialFor(kind, set);
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
    root.name = `${kind}_${set.id}`;
    root.position.set(x, 50, 0);
    this.scene.add(root);
    return root;
  }

  /** Remove both slot roots, disposing ONLY viewer-created resources: preset
   * materials always, primitive geometries too. Model geometries and the
   * glTF's original materials are shared with the AssetManager cache —
   * cache policy is no-eviction, so consumers never dispose them. */
  private detachSlots(): void {
    for (const [root] of this.slots()) {
      if (!root) continue;
      this.scene.remove(root);
      if (root instanceof THREE.Mesh) {
        root.geometry.dispose();
      }
      for (const material of this.materialsOf(root)) {
        material.dispose();
      }
    }
    this.meshPhong = null;
    this.meshStandard = null;
  }

  /**
   * Every material on the meshes under `root` (null → []). Slot invariant:
   * placeModel replaces all glTF materials BEFORE a clone becomes a slot
   * root, so everything found here is viewer-created and safe to dispose.
   */
  private materialsOf(root: THREE.Object3D | null): THREE.Material[] {
    const found: THREE.Material[] = [];
    root?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material;
        if (Array.isArray(material)) {
          found.push(...material);
        } else {
          found.push(material);
        }
      }
    });
    return found;
  }

  private presetMaterialFor(kind: SlotKind, set: TextureSet): THREE.Material {
    return kind === 'phong'
      ? createPhongMaterial(set, this.params.normalMap, this.params.shininess)
      : createStandardMaterial(
          set,
          this.params.normalMap,
          this.params.roughness,
          this.params.metalness,
        );
  }

  private rebuildMaterials(): void {
    const set = this.currentSet();
    for (const [root, kind] of this.slots()) {
      if (!root) continue;
      for (const old of this.materialsOf(root)) {
        old.dispose();
      }
      const material = this.presetMaterialFor(kind, set);
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
        }
      });
      root.name = `${kind}_${set.id}`;
    }
    this.setRepeat(this.params.repeatU, this.params.repeatV);
    this.onSlotsRebuilt?.(); // fresh preset materials wiped any editor apply
  }

  private currentSet(): TextureSet {
    const set = this.assets.sets.get(this.params.texture);
    if (!set) {
      throw new Error(`MaterialViewer: unknown texture set "${this.params.texture}"`);
    }
    return set;
  }

  private materialOf(mesh: THREE.Mesh): THREE.Material {
    const material = mesh.material;
    if (Array.isArray(material)) {
      throw new Error(`MaterialViewer: expected single material on "${mesh.name}"`);
    }
    return material;
  }
}
