import { fetchManifest, type MapKind } from '../assets/manifest';
import { AssetManager } from '../assets/AssetManager';
import { DEFAULT_MATERIAL_DEFINITION } from '../assets/MaterialDefinition';
import {
  validateEnvManifest,
  type EnvironmentPreset,
  type EnvManifest,
} from '../assets/EnvManifest';
import {
  validateLightingPresets,
  type LightPreset,
  type LightingPresetManifest,
} from '../assets/LightPresets';
import { Engine } from '../core/Engine';
import { DevPanel } from '../editor/DevPanel';
import { LoadingOverlay } from '../editor/LoadingOverlay';
import { MaterialDraft } from '../editor/MaterialDraft';
import { MaterialEditor } from '../editor/MaterialEditor';
import { CameraRig } from '../render/CameraRig';
import { EnvironmentSystem } from '../render/EnvironmentSystem';
import { applyLightingPreset } from '../render/LightingPresets';
import type { TextureResolver } from '../render/MaterialCompiler';
import { MaterialTarget } from '../render/MaterialTarget';
import { RenderSystem } from '../render/RenderSystem';
import { TextureLibrary, type LoadedAssets } from '../render/TextureLibrary';
import { MaterialViewer } from './MaterialViewer';

/**
 * Material-tool entry (viewer.html) — the Phase 1 bootstrap grown into the
 * Phase 3 material tool (wave E1b). Boot order is a dependency chain:
 * RenderSystem first (EnvironmentSystem renders PMREM through the WebGL
 * context), then the texture library with the progress overlay, then the
 * viewer/engine (slot meshes must exist before the editor's initial apply),
 * and only then the editor stack: MaterialEditor driving a MaterialTarget
 * over the viewer's meshes, with EnvironmentSystem and LightingPresets
 * behind its preset callbacks. The Phase 2 app (menu → gameplay) lives in
 * src/main.ts on index.html.
 */
async function boot(): Promise<void> {
  const overlayRoot = document.getElementById('loading');
  const container = document.getElementById('app');
  if (!overlayRoot || !container) {
    throw new Error('viewer.html is missing #app or #loading');
  }
  const overlay = new LoadingOverlay(overlayRoot);

  const render = new RenderSystem(container);
  const manifest = await fetchManifest('textures/manifest.json');
  const assets = await new TextureLibrary().loadAll(manifest, {
    anisotropy: render.maxAnisotropy,
    onProgress: (ratio) => overlay.setProgress(ratio),
  });

  // One URI-keyed cache for everything lazy: glTF models (viewer shape
  // swaps) and the HDRIs behind environment presets share it.
  const assetCache = new AssetManager();

  // Model shapes (model:<name>, wave C3) load through their own cache; the
  // demo glTF streams lazily on first pick — nothing extra to preload here.
  const viewer = new MaterialViewer(assets, assetCache);
  const cameraRig = new CameraRig(render);
  render.setRenderOutput(viewer.scene, cameraRig.camera);

  const engine = new Engine();
  engine.addSystem(viewer, cameraRig, render);
  await engine.init(); // slot meshes exist — the editor's initial apply lands on them
  engine.start();

  // Wave E1b editor stack. Preset lists come from the same manifest pattern
  // as the textures: fetch, strict-validate, then use.
  const environments = await fetchEnvPresets('env/manifest.json');
  const lightings = await fetchLightPresets('lighting/presets.json');
  const envSystem = new EnvironmentSystem({
    renderer: render.renderer,
    scene: viewer.scene,
    assets: assetCache,
  });
  const editor = new MaterialEditor({
    draft: new MaterialDraft(DEFAULT_MATERIAL_DEFINITION()),
    target: new MaterialTarget({
      // Fresh lookup every apply — shape/model swaps replace the meshes.
      meshes: () => viewer.getEditorMeshes(),
      resolver: textureSetResolver(assets),
    }),
    environments,
    lightings,
    onEnvironment: (preset) => envSystem.apply(preset),
    onLighting: (preset) => applyLightingPreset(viewer.lightingRig, preset),
    textureSetIds: editorTextureSetIds(assets),
  });
  // Late wire (wave E fix): the viewer is built BEFORE the editor (it owns
  // the meshes the editor's target looks up), so the slot-rebuild hook is a
  // public field assigned here, after the editor exists — every texture/
  // shape swap installs fresh preset materials into the slots, and the
  // editor's last-known-good def must be re-applied on top.
  viewer.onSlotsRebuilt = () => editor.reapply();

  overlay.hide();
  new DevPanel(viewer);

  // Boot defaults — the first preset of each manifest (studio IBL + day
  // lights), matching the editor dropdowns' initial selection. Best
  // effort: the viewer is already up, so failures log, never throw.
  await applyBootPreset('environment', environments[0], (preset) => envSystem.apply(preset));
  await applyBootPreset('lighting', lightings[0], (preset) =>
    applyLightingPreset(viewer.lightingRig, preset),
  );
}

boot().catch((error: unknown) => {
  console.error('[viewer boot] failed:', error);
  const overlayRoot = document.getElementById('loading');
  if (overlayRoot) {
    const overlay = new LoadingOverlay(overlayRoot);
    overlay.fail(error instanceof Error ? error.message : String(error));
  }
});

/**
 * Editor-side TextureResolver (sync contract): a `set/kind`-qualified
 * textureSetId resolves to that map of the LOADED set. Everything else —
 * unknown ids and ALL `uri` sources — returns null ("slot cannot be
 * served"), which the compiler turns into an unbound slot while the
 * definition stays valid.
 *
 * Why the id carries the kind: resolve() receives ONLY the source, and one
 * set carries all five maps, so the slot's kind must ride inside the id —
 * the picker ids are generated from the loaded sets (editorTextureSetIds)
 * and never offer an unresolvable combo.
 *
 * v1 limitation (future need): `uri` sources cannot be served — resolution
 * is synchronous by contract (the compiler never loads), so on-demand
 * loading of arbitrary URIs needs async resolution later. The editor's uri
 * field stays; unresolved slots are simply skipped by the compiler.
 */
function textureSetResolver(assets: LoadedAssets): TextureResolver {
  return {
    resolve: (source) => {
      if (!('textureSetId' in source)) {
        return null; // uri source — v1 limitation, see above
      }
      const separator = source.textureSetId.indexOf('/');
      if (separator < 0) {
        return null; // unqualified id — no kind, nothing to serve
      }
      const set = assets.sets.get(source.textureSetId.slice(0, separator));
      return set ? (set.maps[source.textureSetId.slice(separator + 1) as MapKind] ?? null) : null;
    },
  };
}

/** Picker ids for the editor's Maps folders: one `set/kind` per map each
 * LOADED set actually has (e.g. `metal3/baseColor`). */
function editorTextureSetIds(assets: LoadedAssets): string[] {
  const ids: string[] = [];
  for (const set of assets.sets.values()) {
    for (const kind of Object.keys(set.maps) as MapKind[]) {
      ids.push(`${set.id}/${kind}`);
    }
  }
  return ids;
}

/** Preset-manifest fetch + strict validation (the textures-manifest pattern). */
async function fetchEnvPresets(url: string): Promise<EnvironmentPreset[]> {
  const data = await fetchJson(url);
  const { valid, errors } = validateEnvManifest(data);
  if (!valid) {
    throw new Error(`Invalid environment manifest ${url}: ${errors.join('; ')}`);
  }
  return (data as EnvManifest).environments;
}

/** Preset-manifest fetch + strict validation (the same pattern). */
async function fetchLightPresets(url: string): Promise<LightPreset[]> {
  const data = await fetchJson(url);
  const { valid, errors } = validateLightingPresets(data);
  if (!valid) {
    throw new Error(`Invalid lighting manifest ${url}: ${errors.join('; ')}`);
  }
  return (data as LightingPresetManifest).presets;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${url} (HTTP ${response.status})`);
  }
  return response.json();
}

/** Best-effort boot preset apply: no preset (empty manifest) or a failed
 * apply logs to the console and moves on — the viewer is already running. */
async function applyBootPreset<T>(
  kind: string,
  preset: T | undefined,
  apply: (preset: T) => void | Promise<void>,
): Promise<void> {
  if (!preset) {
    return;
  }
  try {
    await apply(preset);
  } catch (error: unknown) {
    console.error(`[viewer boot] ${kind} preset failed:`, error);
  }
}
