import GUI from 'lil-gui';
import type { MaterialViewer } from '../examples/MaterialViewer';
import { MeshFactory } from '../render/MeshFactory';

/**
 * DevPanel — lil-gui controls, zero logic (task 7).
 *
 * Replaces the 398-line `legacy/scripts/GUI.js`. The panel only mutates
 * `viewer.params` and calls viewer methods; it never touches three.js.
 */
export class DevPanel {
  private readonly gui: GUI;
  private readonly viewer: MaterialViewer;

  constructor(viewer: MaterialViewer) {
    this.viewer = viewer;
    this.gui = new GUI({ title: 'Material Viewer' });
    this.build();
  }

  private build(): void {
    const p = this.viewer.params;
    const v = this.viewer;

    const objects = this.gui.addFolder('Objects');
    objects.add(p, 'speed', -0.05, 0.05, 0.001);
    objects.add(p, 'shape', MeshFactory.list()).onChange((value: string) => v.setShape(value));

    const lights = this.gui.addFolder('Lights');
    lights
      .add(p, 'pointLightPower', 0, 3, 0.01)
      .onChange((value: number) => v.setPointLight(value));
    lights
      .add(p, 'directionalLightPower', 0, 3, 0.01)
      .onChange((value: number) => v.setDirectionalLight(value));

    const material = this.gui.addFolder('Material');
    material.add(p, 'normalMap').onChange((value: boolean) => v.setNormalMap(value));
    material.add(p, 'shininess', 1, 500, 1).onChange((value: number) => v.setShininess(value));
    material.add(p, 'roughness', 0, 1, 0.01).onChange((value: number) => v.setRoughness(value));
    material.add(p, 'metalness', 0, 1, 0.01).onChange((value: number) => v.setMetalness(value));

    const textures = this.gui.addFolder('Textures');
    textures.add(p, 'texture', v.textureIds).onChange((value: string) => v.setTexture(value));
    textures.add(p, 'skybox', v.skyboxIds).onChange((value: string) => v.setSkybox(value));
    textures.add(p, 'repeatU', 1, 8, 1).onChange(() => v.setRepeat(p.repeatU, p.repeatV));
    textures.add(p, 'repeatV', 1, 8, 1).onChange(() => v.setRepeat(p.repeatU, p.repeatV));
  }

  dispose(): void {
    this.gui.destroy();
  }
}
