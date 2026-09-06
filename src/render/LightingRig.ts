import * as THREE from 'three';

/**
 * LightingRig — scene lights + visible bulb meshes (task 6).
 *
 * Port of `legacy/scripts/Light.js` concept: ambient + hemisphere +
 * directional + two point lights, each point/dir light with a small
 * semi-transparent bulb mesh so light positions are visible.
 */
export class LightingRig {
  private readonly scene: THREE.Scene;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly directional: THREE.DirectionalLight;
  private readonly points: THREE.PointLight[] = [];
  private readonly pointBulbMaterials: THREE.MeshBasicMaterial[] = [];
  private directionalBulbMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.ambient = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(this.ambient);

    this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x080820, 0.5);
    scene.add(this.hemisphere);

    this.directional = new THREE.DirectionalLight(0xffffff, 0.7);
    this.directional.position.set(1500, 2500, 1500);
    scene.add(this.directional);
    this.directionalBulbMaterial = this.attachBulb(this.directional, 50);

    this.createPointLight(new THREE.Vector3(500, 500, 500));
    this.createPointLight(new THREE.Vector3(-500, 500, -500));
  }

  private createPointLight(position: THREE.Vector3): void {
    const light = new THREE.PointLight(0xffffff, 0.0, 0, 1.5);
    light.position.copy(position);
    this.points.push(light);
    this.scene.add(light);
    this.pointBulbMaterials.push(this.attachBulb(light, 12));
    this.setPointIntensity(0);
  }

  private attachBulb(light: THREE.Light, size: number): THREE.MeshBasicMaterial {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(size), material);
    bulb.position.copy(light.position);
    light.add(bulb);
    return material;
  }

  /** Point light group intensity (0 disables all point lights and dims bulbs). */
  setPointIntensity(value: number): void {
    const on = value > 0.2;
    const intensity = on ? value : 0;
    for (const light of this.points) {
      light.intensity = intensity;
    }
    for (const material of this.pointBulbMaterials) {
      material.opacity = on ? 0.8 : 0.15;
    }
  }

  setDirectionalIntensity(value: number): void {
    const on = value > 0.2;
    this.directional.intensity = on ? value : 0;
    if (this.directionalBulbMaterial) {
      this.directionalBulbMaterial.opacity = on ? 0.8 : 0.15;
    }
  }

  // --- additive preset hooks (src/render/LightingPresets.ts) ----------------
  //
  // Plain intensity/color setters used by applyLightingPreset(); they do NOT
  // gate on the 0.2 bulb threshold — validation and defaults live in the data
  // layer (src/assets/LightPresets.ts). Group point control stays in
  // setPointIntensity above; per-index control is below.

  /** Ambient light intensity (additive; e.g. lighting presets). */
  setAmbientIntensity(value: number): void {
    this.ambient.intensity = value;
  }

  /** Ambient light color as a 0xRRGGBB integer (additive; e.g. lighting presets). */
  setAmbientColor(color: number): void {
    this.ambient.color.setHex(color);
  }

  /** Hemisphere light intensity (additive; e.g. lighting presets). */
  setHemisphereIntensity(value: number): void {
    this.hemisphere.intensity = value;
  }

  /** Hemisphere sky and ground colors as 0xRRGGBB integers (additive; presets). */
  setHemisphereColors(skyColor: number, groundColor: number): void {
    this.hemisphere.color.setHex(skyColor);
    this.hemisphere.groundColor.setHex(groundColor);
  }

  /** Directional light color as a 0xRRGGBB integer (additive; lighting presets). */
  setDirectionalColor(color: number): void {
    this.directional.color.setHex(color);
  }

  /** Number of fixed point lights in the rig (drives per-index point control). */
  get pointLightCount(): number {
    return this.points.length;
  }

  /**
   * Per-light point intensity (additive to the {@link setPointIntensity}
   * group setter). Mirrors the group semantics: values <= 0.2 count as OFF
   * and dim that light's bulb; otherwise the bulb brightens.
   */
  setPointLightIntensity(index: number, value: number): void {
    const light = this.points[index];
    const material = this.pointBulbMaterials[index];
    if (!light || !material) {
      return;
    }
    const on = value > 0.2;
    light.intensity = on ? value : 0;
    material.opacity = on ? 0.8 : 0.15;
  }

  /** Per-light point color as a 0xRRGGBB integer (additive; lighting presets). */
  setPointLightColor(index: number, color: number): void {
    const light = this.points[index];
    if (!light) {
      return;
    }
    light.color.setHex(color);
  }
}
