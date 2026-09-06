/**
 * MaterialEditor — the lil-gui panel that drives a MaterialDraft
 * (Phase 3, Wave C2).
 *
 * Pattern law (plan #8, DevPanel heritage): the panel holds ONLY gui state
 * objects and subscriptions; every consequence is DELEGATED through the
 * injected callbacks — target.applyDefinition for live apply, onEnvironment
 * / onLighting for presets. No three.js import, no business logic. Wave E
 * wires a target that routes MaterialCompiler.applyUpdate over the scene's
 * meshes and connects EnvironmentSystem/LightingRig behind the callbacks.
 *
 * Live-apply policy: every draft mutation re-runs draft.toDefinition(). A
 * valid result is applied IMMEDIATELY (applyUpdate is cheap — no debounce)
 * and remembered as last-known-good (MaterialApplier). A mid-edit INVALID
 * draft (cleared id, zero repeat…) is NOT applied — the target simply stays
 * at last-known-good and the status line says why (`invalid — not applied`).
 *
 * Slot rebuilds (wave E fix): the viewer replaces slot materials behind
 * this panel's back on texture/shape swaps — `reapply()` pushes the
 * last-known-good def again, so the edit survives without a draft change.
 * The state machine is MaterialApplier (headless, unit-tested there); the
 * `reapply()` method here is glue.
 *
 * NO UNIT TESTS BY DESIGN: lil-gui is DOM-bound (its constructor appends to
 * document.body on autoPlace) and the node test env has no DOM. The pure
 * halves of both file flows live in MaterialDraft.ts and are covered by
 * MaterialDraft.test.ts; the panel itself is visual acceptance (Wave E).
 */

import GUI, { type Controller } from 'lil-gui';
import type { EnvironmentPreset } from '../assets/EnvManifest';
import type { LightPreset } from '../assets/LightPresets';
import type {
  MaterialDefinition,
  MaterialMapSource,
  MaterialShading,
} from '../assets/MaterialDefinition';
import {
  exportDefinition,
  importDefinition,
  type MaterialDraft,
  type MaterialMapSlot,
} from './MaterialDraft';
import { MaterialApplier } from './MaterialApplier';

/** Where edited definitions go live. Wave E: MaterialCompiler.applyUpdate over scene meshes. */
export interface MaterialEditorTarget {
  applyDefinition(def: MaterialDefinition): void;
}

/** Everything the panel needs, injected — no direct engine references. */
export interface MaterialEditorDeps {
  draft: MaterialDraft;
  target: MaterialEditorTarget;
  /** Ids offered by the Maps source pickers (TextureLibrary's loaded sets). */
  textureSetIds: readonly string[];
  environments: readonly EnvironmentPreset[];
  lightings: readonly LightPreset[];
  onEnvironment(preset: EnvironmentPreset): Promise<void>;
  onLighting(preset: LightPreset): void;
  /** Optional hook fired with the exported def (tests assert on it). */
  onExportRequest?(def: MaterialDefinition): void;
}

/** Slot labels in folder order. */
const MAP_SLOTS: readonly { slot: MaterialMapSlot; label: string }[] = [
  { slot: 'baseColor', label: 'Base Color' },
  { slot: 'normal', label: 'Normal' },
  { slot: 'bump', label: 'Bump' },
  { slot: 'roughness', label: 'Roughness' },
  { slot: 'ao', label: 'AO' },
  { slot: 'displacement', label: 'Displacement' },
];

const MAP_SOURCE_MODES = ['none', 'texture-set', 'uri'] as const;
type MapSourceMode = (typeof MAP_SOURCE_MODES)[number];

/** Per-slot gui state — mode first, then the value the current mode uses. */
interface SlotState {
  mode: MapSourceMode;
  setId: string;
  uri: string;
}

export class MaterialEditor {
  private readonly gui: GUI;
  private readonly deps: MaterialEditorDeps;
  private readonly applier: MaterialApplier;
  private readonly unsubscribe: () => void;
  private importInput: HTMLInputElement | null = null;
  private statusController: Controller | null = null;
  private readonly statusState = { status: '' };
  // Shading swap: roughness/metalness are standard-only, shininess phong-only.
  private roughnessController: Controller | null = null;
  private metalnessController: Controller | null = null;
  private shininessController: Controller | null = null;

  constructor(deps: MaterialEditorDeps) {
    this.deps = deps;
    this.gui = new GUI({ title: 'Material Editor' });
    this.applier = new MaterialApplier(deps.target);
    this.build();
    this.unsubscribe = this.deps.draft.subscribe(() => this.onDraftChange());
    this.onDraftChange(); // initial live-apply: the target starts at the draft's def
  }

  /** Push the last-known-good def to the current meshes again — the viewer
   * fires this after every slot rebuild (fresh preset materials replaced
   * the edited one). No draft touch, no dirty change; no lastGood yet →
   * no-op (MaterialApplier). */
  reapply(): void {
    this.applier.reapply();
  }

  dispose(): void {
    this.unsubscribe();
    this.gui.destroy();
    this.importInput?.remove();
    this.importInput = null;
  }

  // --- build --------------------------------------------------------------

  /** One folder tree from the CURRENT draft state. Called once and after import. */
  private build(): void {
    this.buildIdentityFolder();
    this.buildParamsFolder();
    this.buildUvFolder();
    const maps = this.gui.addFolder('Maps');
    for (const { slot, label } of MAP_SLOTS) {
      this.buildSlotFolder(maps, slot, label);
    }
    this.buildEnvironmentFolder();
    this.buildLightingFolder();
    this.buildFileFolder();
    this.statusController = this.gui.add(this.statusState, 'status').disable();
    this.importInput = this.createImportInput();
  }

  /** Destroy the gui + import input and rebuild from the draft's current content. */
  private rebuild(): void {
    this.gui.destroy();
    this.importInput?.remove();
    this.importInput = null;
    this.statusController = null;
    this.build();
  }

  private buildIdentityFolder(): void {
    const folder = this.gui.addFolder('Identity');
    const state = { id: this.deps.draft.id, shading: this.deps.draft.shading };
    folder.add(state, 'id').onChange((id: string) => this.deps.draft.setId(id));
    folder.add(state, 'shading', ['standard', 'phong']).onChange((shading: string) => {
      const next = shading as MaterialShading;
      this.deps.draft.setShading(next);
      this.refreshParamsVisibility(next);
    });
  }

  private buildParamsFolder(): void {
    const folder = this.gui.addFolder('Params');
    const params = this.deps.draft.params;
    const state = {
      color: this.deps.draft.color,
      roughness: params.roughness,
      metalness: params.metalness,
      shininess: params.shininess,
      normalScale: params.normalScale,
    };
    folder.addColor(state, 'color').onChange((value: number) => this.deps.draft.setColor(value));
    this.roughnessController = folder
      .add(state, 'roughness', 0, 1, 0.01)
      .onChange((value: number) => this.deps.draft.setParam('roughness', value));
    this.metalnessController = folder
      .add(state, 'metalness', 0, 1, 0.01)
      .onChange((value: number) => this.deps.draft.setParam('metalness', value));
    this.shininessController = folder
      .add(state, 'shininess', 0, 500, 1)
      .onChange((value: number) => this.deps.draft.setParam('shininess', value));
    folder
      .add(state, 'normalScale', 0, 4, 0.01)
      .onChange((value: number) => this.deps.draft.setParam('normalScale', value));
    this.refreshParamsVisibility(this.deps.draft.shading);
  }

  private buildUvFolder(): void {
    const folder = this.gui.addFolder('UV');
    const uv = this.deps.draft.uv;
    const state = {
      repeatX: uv.repeat[0],
      repeatY: uv.repeat[1],
      offsetX: uv.offset[0],
      offsetY: uv.offset[1],
      rotation: uv.rotation,
      centerX: uv.center[0],
      centerY: uv.center[1],
    };
    folder
      .add(state, 'repeatX', 0.1, 8, 0.1)
      .onChange((v: number) => this.deps.draft.setUvComponent('repeat', 0, v));
    folder
      .add(state, 'repeatY', 0.1, 8, 0.1)
      .onChange((v: number) => this.deps.draft.setUvComponent('repeat', 1, v));
    folder
      .add(state, 'offsetX', -2, 2, 0.01)
      .onChange((v: number) => this.deps.draft.setUvComponent('offset', 0, v));
    folder
      .add(state, 'offsetY', -2, 2, 0.01)
      .onChange((v: number) => this.deps.draft.setUvComponent('offset', 1, v));
    folder
      .add(state, 'rotation', -Math.PI, Math.PI, 0.01)
      .onChange((v: number) => this.deps.draft.setUvRotation(v));
    folder
      .add(state, 'centerX', 0, 1, 0.01)
      .onChange((v: number) => this.deps.draft.setUvComponent('center', 0, v));
    folder
      .add(state, 'centerY', 0, 1, 0.01)
      .onChange((v: number) => this.deps.draft.setUvComponent('center', 1, v));
  }

  /** One subfolder per map slot: source mode, then mode-specific value + slot extra. */
  private buildSlotFolder(maps: GUI, slot: MaterialMapSlot, label: string): void {
    const folder = maps.addFolder(label);
    const current = this.deps.draft.maps[slot];
    const source = current?.source;
    const state: SlotState = {
      mode:
        source && 'textureSetId' in source
          ? 'texture-set'
          : source && 'uri' in source
            ? 'uri'
            : 'none',
      setId: source && 'textureSetId' in source ? source.textureSetId : this.deps.textureSetIds[0] ?? '',
      uri: source && 'uri' in source ? source.uri : '',
    };

    // Controllers below are captured by sync(); they only run AFTER build
    // completes (onChange fires on user input), so the forward use is safe.
    const sync = (): void => {
      this.deps.draft.setMapSlot(slot, this.sourceFrom(state));
      refreshVisibility();
    };
    const refreshVisibility = (): void => {
      setIdController.show(state.mode === 'texture-set');
      uriController.show(state.mode === 'uri');
      for (const controller of extraControllers) {
        controller.show(state.mode !== 'none');
      }
    };

    folder.add(state, 'mode', [...MAP_SOURCE_MODES]).onChange(() => sync());
    const setIdController = folder
      .add(state, 'setId', [...this.deps.textureSetIds])
      .name('texture set')
      .onChange(() => sync());
    const uriController = folder
      .add(state, 'uri')
      .name('uri')
      .onChange(() => sync());

    // Slot-specific extra; display defaults mirror the schema fallbacks
    // (MAP_SLOT_EXTRAS in MaterialDefinition.ts).
    const extraControllers: Controller[] = [];
    if (slot === 'normal') {
      const extra = { enabled: this.deps.draft.maps.normal?.enabled ?? true };
      extraControllers.push(
        folder
          .add(extra, 'enabled')
          .onChange((v: boolean) => this.deps.draft.setMapNormalEnabled(v)),
      );
    } else if (slot === 'bump') {
      const extra = { scale: this.deps.draft.maps.bump?.scale ?? 1 };
      extraControllers.push(
        folder
          .add(extra, 'scale', 0, 4, 0.01)
          .onChange((v: number) => this.deps.draft.setMapBumpScale(v)),
      );
    } else if (slot === 'ao') {
      const extra = { intensity: this.deps.draft.maps.ao?.intensity ?? 1 };
      extraControllers.push(
        folder
          .add(extra, 'intensity', 0, 1, 0.01)
          .onChange((v: number) => this.deps.draft.setMapAoIntensity(v)),
      );
    } else if (slot === 'displacement') {
      const extra = { scale: this.deps.draft.maps.displacement?.scale ?? 1 };
      extraControllers.push(
        folder
          .add(extra, 'scale', 0, 2, 0.01)
          .onChange((v: number) => this.deps.draft.setMapDisplacementScale(v)),
      );
    }
    refreshVisibility();
  }

  /**
   * Draft source for a slot state. An unusable picker value (empty string
   * is not a valid id/uri) keeps the slot unbound, i.e. REMOVED — same
   * outcome as mode 'none'.
   */
  private sourceFrom(state: SlotState): MaterialMapSource | null {
    if (state.mode === 'texture-set' && state.setId !== '') {
      return { textureSetId: state.setId };
    }
    if (state.mode === 'uri' && state.uri !== '') {
      return { uri: state.uri };
    }
    return null;
  }

  private buildEnvironmentFolder(): void {
    const folder = this.gui.addFolder('Environment');
    const environments = this.deps.environments;
    const state = { preset: environments[0]?.id ?? '' };
    folder
      .add(state, 'preset', [...environments.map((preset) => preset.id)])
      .onChange((id: string) => {
        const preset = environments.find((entry) => entry.id === id);
        if (preset) {
          void this.deps.onEnvironment(preset).catch((error: unknown) => {
            this.setStatus(`environment failed: ${String(error)}`);
          });
        }
      });
  }

  private buildLightingFolder(): void {
    const folder = this.gui.addFolder('Lighting');
    const lightings = this.deps.lightings;
    const state = { preset: lightings[0]?.id ?? '' };
    folder
      .add(state, 'preset', [...lightings.map((preset) => preset.id)])
      .onChange((id: string) => {
        const preset = lightings.find((entry) => entry.id === id);
        if (preset) {
          this.deps.onLighting(preset);
        }
      });
  }

  private buildFileFolder(): void {
    const folder = this.gui.addFolder('File');
    folder.add({ export: () => this.exportJson() }, 'export').name('Export JSON');
    folder.add({ import: () => this.importInput?.click() }, 'import').name('Import JSON');
  }

  // --- file flows ------------------------------------------------------------

  private exportJson(): void {
    const payload = exportDefinition(this.deps.draft);
    if ('errors' in payload) {
      this.setStatus(`export blocked: ${payload.errors.join('; ')}`);
      return;
    }
    this.deps.onExportRequest?.(payload.def); // the def exportDefinition already validated
    this.download(payload.filename, payload.json);
  }

  private download(filename: string, json: string): void {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Hidden file input appended to body; the Import button clicks it. */
  private createImportInput(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      input.value = ''; // re-selecting the same file must re-fire change
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const result = importDefinition(this.deps.draft, text);
        if (result.valid) {
          this.rebuild(); // controllers mirror the replaced draft
          this.setStatus(`imported "${this.deps.draft.id}"`);
        } else {
          this.setStatus(`import failed: ${result.errors.join('; ')}`);
        }
      };
      reader.onerror = () => this.setStatus(`import failed: ${String(reader.error)}`);
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    return input;
  }

  // --- live apply pipeline ------------------------------------------------------

  /**
   * Draft changed: apply when valid, else keep the target at LAST-KNOWN-GOOD
   * (the most recent valid def it received — nothing is re-pushed, the
   * material simply keeps that state while the edit is invalid).
   */
  private onDraftChange(): void {
    const { valid, errors, def } = this.deps.draft.toDefinition();
    if (valid && def) {
      this.applier.apply(def); // push + remember as last-known-good
      this.deps.draft.clearDirty(); // the target now holds exactly this state
      this.setStatus('');
      return;
    }
    this.setStatus(`invalid — not applied: ${errors.join('; ')}`);
  }

  private setStatus(text: string): void {
    this.statusState.status = text;
    this.statusController?.updateDisplay();
  }

  private refreshParamsVisibility(shading: MaterialShading): void {
    const standard = shading === 'standard';
    this.roughnessController?.show(standard);
    this.metalnessController?.show(standard);
    this.shininessController?.show(!standard);
  }
}
