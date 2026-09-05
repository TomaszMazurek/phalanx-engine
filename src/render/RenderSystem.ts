import * as THREE from 'three';
import type { System } from '../core/System';

/**
 * RenderSystem — the only place that owns the WebGL renderer (task 3).
 *
 * Renders a fixed (scene, camera) output every frame and owns the single
 * window-resize listener of the app (the legacy app registered two).
 */
export class RenderSystem implements System {
  readonly name = 'render';

  private readonly renderer: THREE.WebGLRenderer;
  private readonly resizeHandlers: Array<() => void> = [];
  private output: { scene: THREE.Scene; camera: THREE.Camera } | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      for (const handler of [...this.resizeHandlers]) {
        handler();
      }
    });
  }

  /** Point the renderer at a scene/camera pair (e.g. MaterialViewer's). */
  setRenderOutput(scene: THREE.Scene, camera: THREE.Camera): void {
    this.output = { scene, camera };
  }

  /** Register a callback for window resizes (single-listener rule). */
  onResize(handler: () => void): void {
    this.resizeHandlers.push(handler);
  }

  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  update(): void {
    if (this.output) {
      this.renderer.render(this.output.scene, this.output.camera);
    }
  }

  dispose(): void {
    this.output = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
