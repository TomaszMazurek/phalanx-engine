import * as THREE from 'three';
import type { System } from '../core/System';
import { Interpolated } from '../core/Interpolated';
import type { LoadedAssets, TextureSet } from '../render/TextureLibrary';
import { MeshFactory } from '../render/MeshFactory';
import {
  createPhongMaterial,
  createStandardMaterial,
} from '../render/MaterialPresets';
import { LightingRig } from '../render/LightingRig';

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
  private readonly lighting: LightingRig;
  private meshPhong: THREE.Mesh | null = null;
  private meshStandard: THREE.Mesh | null = null;

  /** Simulation rotation, advanced in fixedUpdate; both meshes share it. */
  private readonly spinX = new Interpolated();
  private readonly spinY = new Interpolated();

  constructor(assets: LoadedAssets) {
    this.assets = assets;
    this.scene.background = assets.skyboxes.get(this.params.skybox) ?? null;
    this.lighting = new LightingRig(this.scene);
  }

  get textureIds(): string[] {
    return [...this.assets.sets.keys()];
  }

  get skyboxIds(): string[] {
    return [...this.assets.skyboxes.keys()];
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

  setShape(shape: string): void {
    this.params.shape = shape;
    const side = MeshFactory.sideOf(shape);
    for (const mesh of [this.meshPhong, this.meshStandard]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      mesh.geometry = MeshFactory.create(shape);
      const material = this.materialOf(mesh);
      material.side = side;
      material.needsUpdate = true;
    }
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
    if (this.meshPhong?.material instanceof THREE.MeshPhongMaterial) {
      this.meshPhong.material.shininess = value;
    }
  }

  setRoughness(value: number): void {
    this.params.roughness = value;
    if (this.meshStandard?.material instanceof THREE.MeshStandardMaterial) {
      this.meshStandard.material.roughness = value;
    }
  }

  setMetalness(value: number): void {
    this.params.metalness = value;
    if (this.meshStandard?.material instanceof THREE.MeshStandardMaterial) {
      this.meshStandard.material.metalness = value;
    }
  }

  setRepeat(u: number, v: number): void {
    this.params.repeatU = u;
    this.params.repeatV = v;
    for (const mesh of [this.meshPhong, this.meshStandard]) {
      if (!mesh?.material) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      for (const slot of ['map', 'bumpMap', 'normalMap', 'aoMap', 'roughnessMap'] as const) {
        material[slot]?.repeat.set(u, v);
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

  private rebuildMaterials(): void {
    const set = this.currentSet();
    if (this.meshPhong) {
      this.materialOf(this.meshPhong).dispose();
      this.meshPhong.material = createPhongMaterial(
        set,
        this.params.normalMap,
        this.params.shininess,
      );
      this.meshPhong.name = `phong_${set.id}`;
    }
    if (this.meshStandard) {
      this.materialOf(this.meshStandard).dispose();
      this.meshStandard.material = createStandardMaterial(
        set,
        this.params.normalMap,
        this.params.roughness,
        this.params.metalness,
      );
      this.meshStandard.name = `standard_${set.id}`;
    }
    this.setRepeat(this.params.repeatU, this.params.repeatV);
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
