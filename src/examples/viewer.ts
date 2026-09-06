import { fetchManifest } from '../assets/manifest';
import { AssetManager } from '../assets/AssetManager';
import { Engine } from '../core/Engine';
import { DevPanel } from '../editor/DevPanel';
import { LoadingOverlay } from '../editor/LoadingOverlay';
import { CameraRig } from '../render/CameraRig';
import { RenderSystem } from '../render/RenderSystem';
import { TextureLibrary } from '../render/TextureLibrary';
import { MaterialViewer } from './MaterialViewer';

/**
 * Phase 1 material-viewer entry (viewer.html) — preserved as-is from the
 * Phase 1 bootstrap, so the accepted demo keeps its own URL. The Phase 2
 * app (menu → gameplay) lives in src/main.ts on index.html.
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

  // Model shapes (model:<name>, wave C3) load through their own cache; the
  // demo glTF streams lazily on first pick — nothing extra to preload here.
  const viewer = new MaterialViewer(assets, new AssetManager());
  const cameraRig = new CameraRig(render);
  render.setRenderOutput(viewer.scene, cameraRig.camera);

  const engine = new Engine();
  engine.addSystem(viewer, cameraRig, render);
  await engine.init();
  engine.start();

  overlay.hide();
  new DevPanel(viewer);
}

boot().catch((error: unknown) => {
  console.error('[viewer boot] failed:', error);
  const overlayRoot = document.getElementById('loading');
  if (overlayRoot) {
    const overlay = new LoadingOverlay(overlayRoot);
    overlay.fail(error instanceof Error ? error.message : String(error));
  }
});
