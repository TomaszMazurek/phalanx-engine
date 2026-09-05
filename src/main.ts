import { fetchManifest } from './assets/manifest';
import { Engine } from './core/Engine';
import { DevPanel } from './editor/DevPanel';
import { LoadingOverlay } from './editor/LoadingOverlay';
import { MaterialViewer } from './examples/MaterialViewer';
import { CameraRig } from './render/CameraRig';
import { RenderSystem } from './render/RenderSystem';
import { TextureLibrary } from './render/TextureLibrary';

/**
 * Phase 1 bootstrap:
 *   1. renderer (needs to exist first — anisotropy budget for the asset loader),
 *   2. manifest + textures with a loading progress overlay,
 *   3. Engine + systems (viewer → camera → render, in update order),
 *   4. dev panel once the loop is running.
 */

async function boot(): Promise<void> {
  const overlayRoot = document.getElementById('loading');
  const container = document.getElementById('app');
  if (!overlayRoot || !container) {
    throw new Error('index.html is missing #app or #loading');
  }
  const overlay = new LoadingOverlay(overlayRoot);

  const render = new RenderSystem(container);
  const manifest = await fetchManifest('textures/manifest.json');
  const assets = await new TextureLibrary().loadAll(manifest, {
    anisotropy: render.maxAnisotropy,
    onProgress: (ratio) => overlay.setProgress(ratio),
  });

  const viewer = new MaterialViewer(assets);
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
  console.error('[boot] failed:', error);
  const overlayRoot = document.getElementById('loading');
  if (overlayRoot) {
    const overlay = new LoadingOverlay(overlayRoot);
    overlay.fail(error instanceof Error ? error.message : String(error));
  }
});
