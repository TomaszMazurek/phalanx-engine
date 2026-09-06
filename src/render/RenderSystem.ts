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

  private readonly gl: THREE.WebGLRenderer;
  private readonly resizeHandlers: Array<() => void> = [];
  private output: { scene: THREE.Scene; camera: THREE.Camera } | null = null;

  constructor(container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: true });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.gl.domElement);

    window.addEventListener('resize', () => {
      this.gl.setSize(window.innerWidth, window.innerHeight);
      for (const handler of [...this.resizeHandlers]) {
        handler();
      }
    });
  }

  /** Point the renderer at a scene/camera pair (e.g. MaterialViewer's). */
  setRenderOutput(scene: THREE.Scene, camera: THREE.Camera): void {
    this.output = { scene, camera };
  }

  /**
   * Stop rendering the current output: update() then issues NO draw call
   * until the next setRenderOutput — and nothing is cleared either, so
   * the last presented frame stays on screen until something draws again
   * (a DOM-only scene like the menu is expected to fully cover it).
   * Called when the active scene exits (phase-2 retro nit: stale frame
   * behind the menu).
   */
  clearRenderOutput(): void {
    this.output = null;
  }

  /**
   * Register a callback for window resizes (single-listener rule).
   * Returns the unsubscribe: app-lifetime subscribers (CameraRig) may drop
   * it, single-use scenes MUST call it on exit or their handler leaks in
   * this app-lifetime registry.
   */
  onResize(handler: () => void): () => void {
    this.resizeHandlers.push(handler);
    return () => {
      const index = this.resizeHandlers.indexOf(handler);
      if (index !== -1) {
        this.resizeHandlers.splice(index, 1);
      }
    };
  }

  get maxAnisotropy(): number {
    return this.gl.capabilities.getMaxAnisotropy();
  }

  get domElement(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  /** The engine's single WebGL renderer, read-only (wave E1b): render-side
   * systems that render THROUGH the context — EnvironmentSystem's
   * PMREMGenerator — need it without taking ownership of it. */
  get renderer(): THREE.WebGLRenderer {
    return this.gl;
  }

  update(): void {
    // No output → no draw call is issued (not even a clear): the previously
    // presented frame remains on screen until something draws again — see
    // clearRenderOutput(). Never a render call with nulls.
    if (this.output) {
      this.renderer.render(this.output.scene, this.output.camera);
    }
  }

  dispose(): void {
    this.output = null;
    this.gl.dispose();
    this.gl.domElement.remove();
  }
}
