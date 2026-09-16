import type * as THREE from 'three';
import type { IEditorContext, EditorContextUpdateParams } from './IEditorContext';
import type { ViewportController } from '../app/ViewportController';
import { LightmapBakingService } from '../../render/pathtracer';

export class LightingContext implements IEditorContext {
  readonly id = 'lighting' as const;
  readonly label = 'Lighting';
  readonly icon = '💡';

  private activeObject: THREE.Object3D | null = null;
  private viewport?: ViewportController;
  private readonly baker = new LightmapBakingService();

  get selected(): THREE.Object3D | null {
    return this.activeObject;
  }

  constructor(viewport?: ViewportController) {
    this.viewport = viewport;
  }

  setViewport(viewport: ViewportController): void {
    this.viewport = viewport;
  }

  activate(): void {
    if (this.viewport) {
      this.viewport.setTransformEnabled(true);
      this.viewport.setLightHelpersVisible(true);
      this.viewport.setGridVisible(true);
    }
  }

  deactivate(): void {
    if (this.viewport) {
      this.viewport.setLightHelpersVisible(false);
    }
  }

  update(_params: EditorContextUpdateParams): void {
    // Dynamic light updates
  }

  onSelectionChange(selected: THREE.Object3D | null): void {
    this.activeObject = selected;
  }

  mountToolbar(container: HTMLElement): void {
    container.innerHTML = `
      <div class="toolbar-section">
        <div class="toolbar-title">Light Sources</div>
        <button class="tool-btn" data-light="point">💡 Point Light</button>
        <button class="tool-btn" data-light="spot">🔦 Spot Light</button>
        <button class="tool-btn" data-light="directional">☀️ Directional Sun</button>
      </div>
      <div class="toolbar-section">
        <div class="toolbar-title">Environment & Sky</div>
        <button class="tool-btn" data-env="dark_arena">🌌 Gothic Arena (Game)</button>
        <button class="tool-btn" data-env="studio">🏢 Studio PBR</button>
        <button class="tool-btn" data-env="sunset">🌇 Sunset Sky</button>
      </div>
      <div class="toolbar-section">
        <div class="toolbar-title">Lightmap & GI Baker</div>
        <button class="tool-btn" data-bake="ao">✨ Bake Ambient Occlusion</button>
        <button class="tool-btn" data-bake="gi">🔥 Bake Full Lightmap (GI)</button>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>('button[data-light]').forEach((btn) => {
      btn.onclick = () => {
        const type = btn.dataset.light;
        if (this.viewport && type) {
          this.viewport.addLight(type as 'point' | 'spot' | 'directional');
        }
      };
    });

    container.querySelectorAll<HTMLButtonElement>('button[data-env]').forEach((btn) => {
      btn.onclick = () => {
        const preset = btn.dataset.env;
        if (this.viewport && preset) {
          this.viewport.setEnvironmentPreset(preset);
        }
      };
    });

    container.querySelectorAll<HTMLButtonElement>('button[data-bake]').forEach((btn) => {
      btn.onclick = async () => {
        const bakeType = btn.dataset.bake as 'ao' | 'gi';
        if (!this.viewport || !this.viewport.scene) {
          console.warn('[LightingContext] Cannot bake: no active viewport scene');
          return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        try {
          console.log(`[LightingContext] Initiating ${bakeType.toUpperCase()} bake via PathTracer...`);
          const result = await this.baker.bakeScene(this.viewport.scene, {
            type: bakeType === 'gi' ? 'irradiance' : 'ao',
            resolution: 256,
            samples: bakeType === 'gi' ? 64 : 32,
            onProgress: (_step, progress) => {
              btn.textContent = `⏳ ${Math.round(progress * 100)}%`;
            }
          });
          btn.textContent = `✅ Baked ${result.meshCount} meshes (${result.durationMs}ms)`;
          console.log(
            `[LightingContext] Bake successful: ${result.meshCount} meshes, ${result.triangleCount} triangles in ${result.durationMs}ms`
          );
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 3000);
        } catch (err: unknown) {
          console.error('[LightingContext] Bake failed:', err);
          btn.textContent = '❌ Bake Failed';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 3000);
        }
      };
    });
  }

  mountInspector(container: HTMLElement, selected: THREE.Object3D | null): void {
    const isLight =
      selected && (selected.type.includes('Light') || selected.name.toLowerCase().includes('light'));
    const isMesh = selected && (selected.type === 'Mesh' || (selected as THREE.Mesh).isMesh);

    if (isLight && selected) {
      const light = selected as THREE.Light;
      const hasDistance = 'distance' in light;
      const isSpot = light.type.includes('Spot');

      container.innerHTML = `
        <div class="inspector-group">
          <div class="inspector-header">Light: <strong>${light.name || light.type}</strong></div>
          <div class="inspector-field">
            <label>Type:</label>
            <span>${light.type}</span>
          </div>
          <div class="inspector-field">
            <label>Color:</label>
            <input type="color" value="#${light.color.getHexString()}" data-light-prop="color" />
          </div>
          <div class="inspector-field">
            <label>Intensity:</label>
            <input type="range" min="0" max="1000" step="1" value="${light.intensity}" data-light-prop="intensity" />
          </div>
          ${
            hasDistance
              ? `<div class="inspector-field">
                   <label>Range (m):</label>
                   <input type="number" min="0" max="500" step="1" value="${(light as THREE.PointLight).distance}" data-light-prop="distance" />
                 </div>`
              : ''
          }
          ${
            isSpot
              ? `<div class="inspector-field">
                   <label>Angle (deg):</label>
                   <input type="range" min="5" max="90" step="1" value="${Math.round(
                     ((light as THREE.SpotLight).angle * 180) / Math.PI
                   )}" data-light-prop="angle" />
                 </div>`
              : ''
          }
          <div class="inspector-field">
            <label>Cast Shadows:</label>
            <input type="checkbox" ${light.castShadow ? 'checked' : ''} data-light-prop="shadow" />
          </div>
        </div>
      `;

      container.querySelectorAll<HTMLInputElement>('input[data-light-prop]').forEach((input) => {
        input.oninput = () => {
          const prop = input.dataset.lightProp;
          if (prop === 'color') {
            light.color.set(input.value);
          } else if (prop === 'intensity') {
            light.intensity = parseFloat(input.value);
          } else if (prop === 'shadow') {
            light.castShadow = input.checked;
          } else if (prop === 'distance' && hasDistance) {
            (light as THREE.PointLight).distance = parseFloat(input.value) || 0;
          } else if (prop === 'angle' && isSpot) {
            (light as THREE.SpotLight).angle = (parseFloat(input.value) * Math.PI) / 180;
          }
        };
      });
      return;
    }

    if (isMesh && selected) {
      const isStatic = selected.userData?.isStatic !== false && selected.userData?.dynamic !== true;
      container.innerHTML = `
        <div class="inspector-group">
          <div class="inspector-header">Object: <strong>${selected.name || 'Static Mesh'}</strong></div>
          <div class="inspector-field">
            <label>Bake Lightmap (Static):</label>
            <input type="checkbox" ${isStatic ? 'checked' : ''} data-mesh-prop="static" />
          </div>
          <div class="inspector-empty">
            <p>Static objects receive direct light shadows and global illumination baked to material.lightMap.</p>
          </div>
        </div>
      `;

      const staticCheckbox = container.querySelector<HTMLInputElement>('input[data-mesh-prop="static"]');
      if (staticCheckbox) {
        staticCheckbox.onchange = () => {
          selected.userData.isStatic = staticCheckbox.checked;
          selected.userData.dynamic = !staticCheckbox.checked;
        };
      }
      return;
    }

    container.innerHTML = `
      <div class="inspector-group">
        <div class="inspector-header">Global Scene Lighting</div>
        <div class="inspector-field">
          <label>Exposure (EV):</label>
          <input type="range" min="0.1" max="3.0" step="0.1" value="1.0" data-light-prop="exposure" />
        </div>
        <div class="inspector-field">
          <label>Sky Ambient:</label>
          <input type="range" min="0" max="2" step="0.1" value="0.5" data-light-prop="ambient" />
        </div>
      </div>
      <div class="inspector-empty">
        <p>Select a light source to adjust its color, intensity, and shadows, or select a mesh to toggle static baking.</p>
      </div>
    `;

    container.querySelector<HTMLInputElement>('input[data-light-prop="exposure"]')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (this.viewport) this.viewport.setExposure(val);
    });
  }
}
