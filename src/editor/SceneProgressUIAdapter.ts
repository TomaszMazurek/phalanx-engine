import type { SceneProgressUI } from '../scenes/SceneManager';
import type { LoadingOverlay } from './LoadingOverlay';

/**
 * SceneProgressUIAdapter — bridges SceneManager's DOM-free `SceneProgressUI`
 * contract to the app's `LoadingOverlay` element. Exists so the scene layer
 * never touches the DOM directly (Wave D, docs/phase-2-core.md task 6).
 * Structural: the overlay already exposes the exact three methods.
 */
export class SceneProgressUIAdapter implements SceneProgressUI {
  private readonly overlay: LoadingOverlay;

  constructor(overlay: LoadingOverlay) {
    this.overlay = overlay;
  }

  show(): void {
    this.overlay.show();
  }

  setProgress(ratio: number): void {
    this.overlay.setProgress(ratio);
  }

  hide(): void {
    this.overlay.hide();
  }
}
