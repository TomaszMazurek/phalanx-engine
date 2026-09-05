import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { System } from '../core/System';
import type { RenderSystem } from './RenderSystem';

/**
 * CameraRig — perspective camera + orbit controls (task 3).
 *
 * Registers with RenderSystem's resize listener to keep the aspect ratio in sync.
 */
export class CameraRig implements System {
  readonly name = 'camera';

  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;

  constructor(render: RenderSystem) {
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.position.set(0, 260, 1300);
    this.camera.lookAt(0, 50, 0);

    this.controls = new OrbitControls(this.camera, render.domElement);
    this.controls.target.set(0, 50, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    render.onResize(() => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  update(): void {
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
