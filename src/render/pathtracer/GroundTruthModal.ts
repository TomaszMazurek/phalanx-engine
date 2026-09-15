import type * as THREE from 'three';
import { GroundTruthRenderer, type GroundTruthRenderResult } from './GroundTruthRenderer';

export class GroundTruthModal {
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private statusText: HTMLElement | null = null;
  private metricsBadge: HTMLElement | null = null;
  private renderBtn: HTMLButtonElement | null = null;
  private resolutionSelect: HTMLSelectElement | null = null;
  private samplesSelect: HTMLSelectElement | null = null;

  private readonly renderer = new GroundTruthRenderer();
  private isRendering = false;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  public open(): void {
    if (typeof document === 'undefined') return;
    if (this.overlay) return; // already open

    this.createDOM();
    this.startRender();
  }

  public close(): void {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
  }

  public async startRender(): Promise<void> {
    if (this.isRendering) return;
    this.isRendering = true;

    if (this.renderBtn) {
      this.renderBtn.disabled = true;
      this.renderBtn.textContent = '⏳ Rendering...';
    }
    if (this.statusText) {
      this.statusText.textContent = 'Preparing scene & building BVH...';
    }

    const resolution = parseInt(this.resolutionSelect?.value ?? '512', 10);
    const samples = parseInt(this.samplesSelect?.value ?? '32', 10);

    try {
      const result: GroundTruthRenderResult = await this.renderer.renderView(
        this.scene,
        this.camera,
        {
          width: resolution,
          height: resolution,
          samples,
          maxDepth: 5,
          onProgress: (msg) => {
            if (this.statusText) this.statusText.textContent = msg;
          }
        }
      );

      if (this.canvas) {
        result.drawToCanvas(this.canvas);
      }

      if (this.statusText) {
        this.statusText.textContent = `Render completed in ${result.durationMs}ms`;
      }
      if (this.metricsBadge) {
        this.metricsBadge.textContent = `⏱️ ${result.durationMs}ms | 🔺 ${result.triangleCount.toLocaleString()} tris | ✨ ${samples} spp | 📐 ${resolution}x${resolution}`;
      }
    } catch (err: unknown) {
      console.error('[GroundTruthModal] Render failed:', err);
      if (this.statusText) {
        this.statusText.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    } finally {
      this.isRendering = false;
      if (this.renderBtn) {
        this.renderBtn.disabled = false;
        this.renderBtn.textContent = '🔄 Re-render';
      }
    }
  }

  private savePNG(): void {
    if (!this.canvas) return;
    const link = document.createElement('a');
    link.download = `phalanx-ground-truth-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  private createDOM(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pt-modal-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(8, 8, 12, 0.82);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e2e8f0;
    `;

    const card = document.createElement('div');
    card.className = 'pt-modal-card';
    card.style.cssText = `
      background: #14171f;
      border: 1px solid #2d3748;
      border-radius: 12px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
      width: 580px;
      max-width: 95vw;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 14px 20px;
      background: #1a202c;
      border-bottom: 1px solid #2d3748;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;
    header.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 15px; color: #f7fafc; display: flex; align-items: center; gap: 8px;">
          <span>🔬</span>
          <span>Ground-Truth Path Tracer</span>
          <span style="font-size: 11px; background: #2b6cb0; color: #ebf8ff; padding: 2px 6px; border-radius: 4px;">WASM PBR</span>
        </div>
        <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">Monte Carlo Global Illumination • LinearBVH reference</div>
      </div>
      <button class="pt-close-btn" style="background: transparent; border: none; color: #a0aec0; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px;">✕</button>
    `;

    const closeBtn = header.querySelector<HTMLButtonElement>('.pt-close-btn')!;
    closeBtn.onclick = () => this.close();
    closeBtn.onmouseenter = () => { closeBtn.style.color = '#fff'; };
    closeBtn.onmouseleave = () => { closeBtn.style.color = '#a0aec0'; };

    // Canvas container
    const body = document.createElement('div');
    body.style.cssText = `
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #0d1117;
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.canvas.style.cssText = `
      width: 512px;
      height: 512px;
      max-width: 100%;
      border-radius: 8px;
      border: 1px solid #2d3748;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      background: repeating-conic-gradient(#1a202c 0% 25%, #14171f 0% 50%) 50% / 16px 16px;
    `;
    body.appendChild(this.canvas);

    // Status bar
    const statusBar = document.createElement('div');
    statusBar.style.cssText = `
      width: 100%;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    `;

    this.statusText = document.createElement('span');
    this.statusText.style.cssText = 'color: #cbd5e0; font-style: italic;';
    this.statusText.textContent = 'Initializing...';

    this.metricsBadge = document.createElement('span');
    this.metricsBadge.style.cssText = 'color: #63b3ed; font-family: monospace; font-size: 11px;';
    this.metricsBadge.textContent = '';

    statusBar.appendChild(this.statusText);
    statusBar.appendChild(this.metricsBadge);
    body.appendChild(statusBar);

    // Footer Controls
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 14px 20px;
      background: #14171f;
      border-top: 1px solid #2d3748;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    `;

    footer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <label style="font-size: 12px; color: #a0aec0;">Res:
          <select class="pt-res-select" style="background: #1a202c; border: 1px solid #4a5568; color: #e2e8f0; border-radius: 4px; padding: 4px 6px; font-size: 12px;">
            <option value="256">256x256</option>
            <option value="512" selected>512x512</option>
            <option value="768">768x768</option>
          </select>
        </label>
        <label style="font-size: 12px; color: #a0aec0;">SPP:
          <select class="pt-spp-select" style="background: #1a202c; border: 1px solid #4a5568; color: #e2e8f0; border-radius: 4px; padding: 4px 6px; font-size: 12px;">
            <option value="16">16 (Fast)</option>
            <option value="32" selected>32 (Balanced)</option>
            <option value="64">64 (High)</option>
            <option value="128">128 (Ultra)</option>
          </select>
        </label>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button class="pt-save-btn" style="background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer;">💾 Save PNG</button>
        <button class="pt-render-btn" style="background: #3182ce; color: #fff; border: none; border-radius: 6px; padding: 6px 16px; font-size: 12px; font-weight: 500; cursor: pointer;">🔄 Re-render</button>
      </div>
    `;

    this.resolutionSelect = footer.querySelector<HTMLSelectElement>('.pt-res-select');
    this.samplesSelect = footer.querySelector<HTMLSelectElement>('.pt-spp-select');
    this.renderBtn = footer.querySelector<HTMLButtonElement>('.pt-render-btn');
    const saveBtn = footer.querySelector<HTMLButtonElement>('.pt-save-btn');

    if (this.renderBtn) {
      this.renderBtn.onclick = () => this.startRender();
    }
    if (saveBtn) {
      saveBtn.onclick = () => this.savePNG();
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    this.overlay.appendChild(card);
    document.body.appendChild(this.overlay);

    // Close on overlay backdrop click
    this.overlay.onclick = (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    };
  }
}

/**
 * Convenient helper to instantiate and open the Ground-Truth Path Tracer modal.
 */
export function openGroundTruthModal(scene: THREE.Scene, camera: THREE.PerspectiveCamera): GroundTruthModal {
  const modal = new GroundTruthModal(scene, camera);
  modal.open();
  return modal;
}
