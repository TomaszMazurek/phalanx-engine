import * as THREE from 'three';
import { loadPathTracerWasm } from './loadWasm';
import { PathTracerBridge } from './PathTracerBridge';
import { SceneExtractor } from './SceneExtractor';

export interface GroundTruthRenderOptions {
  width?: number;
  height?: number;
  samples?: number;
  maxDepth?: number;
  seed?: number;
  backgroundColor?: [number, number, number];
  onProgress?: (message: string, progress: number) => void;
}

export interface GroundTruthRenderResult {
  width: number;
  height: number;
  samples: number;
  durationMs: number;
  triangleCount: number;
  floatPixels: Float32Array;
  toImageData(): ImageData;
  drawToCanvas(canvas: HTMLCanvasElement): void;
}

export class GroundTruthRenderer {
  private bridgePromise: Promise<PathTracerBridge> | null = null;

  private async getBridge(): Promise<PathTracerBridge> {
    if (!this.bridgePromise) {
      this.bridgePromise = loadPathTracerWasm().then((wasm) => new PathTracerBridge(wasm));
    }
    return this.bridgePromise;
  }

  /**
   * Renders the physical ground-truth perspective camera view of the scene
   * using the C++ WebAssembly LinearBVH Monte Carlo Path Tracer.
   */
  public async renderView(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    options: GroundTruthRenderOptions = {}
  ): Promise<GroundTruthRenderResult> {
    const startTime = performance.now();
    const width = options.width ?? 512;
    const height = options.height ?? 512;
    const samples = options.samples ?? 32;
    const maxDepth = options.maxDepth ?? 5;
    const seed = options.seed ?? 42;
    const bg = options.backgroundColor ?? [0.08, 0.08, 0.12];

    options.onProgress?.('Extracting scene geometry & materials...', 0.1);

    const bridge = await this.getBridge();
    bridge.clearScene();
    bridge.setBackgroundColor(bg[0], bg[1], bg[2]);

    // 1. Camera setup
    camera.updateMatrixWorld(true);
    const lookFrom = new THREE.Vector3();
    camera.getWorldPosition(lookFrom);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const focusDist = 200.0;
    const lookAt = lookFrom.clone().add(dir.clone().multiplyScalar(focusDist));

    const vup = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // 2. Discover meshes & upload
    let totalTriangles = 0;
    scene.traverse((obj) => {
      if (this.isRenderableMesh(obj)) {
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        const pbr = SceneExtractor.extractMaterialParams(mat);
        const matId = bridge.addMaterial(pbr);

        const geom = SceneExtractor.extractMeshGeometry(obj);
        if (geom) {
          totalTriangles += bridge.addMesh(geom, matId);
        }
      }
    });

    if (totalTriangles === 0) {
      throw new Error('GroundTruthRenderer: No renderable geometry found in scene');
    }

    options.onProgress?.('Building LinearBVH...', 0.3);
    const bvhOk = bridge.buildBVH();
    if (!bvhOk) {
      throw new Error('GroundTruthRenderer: Failed to build BVH');
    }

    options.onProgress?.(`Path tracing ${width}x${height} (${samples} spp)...`, 0.5);

    const floatPixels = bridge.renderCamera({
      width,
      height,
      samples,
      maxDepth,
      seed,
      lookFrom: [lookFrom.x, lookFrom.y, lookFrom.z],
      lookAt: [lookAt.x, lookAt.y, lookAt.z],
      vup: [vup.x, vup.y, vup.z],
      vfov: camera.fov,
      focusDist
    });

    const durationMs = Math.round(performance.now() - startTime);
    options.onProgress?.(`Render finished in ${durationMs}ms`, 1.0);

    return {
      width,
      height,
      samples,
      durationMs,
      triangleCount: totalTriangles,
      floatPixels,
      toImageData: () => this.createImageData(floatPixels, width, height),
      drawToCanvas: (canvas: HTMLCanvasElement) => {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(this.createImageData(floatPixels, width, height), 0, 0);
        }
      }
    };
  }

  private isRenderableMesh(obj: THREE.Object3D): obj is THREE.Mesh {
    if (!(obj instanceof THREE.Mesh) && !(obj as THREE.Mesh).isMesh) return false;
    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry || !mesh.geometry.attributes.position) return false;
    if (mesh.geometry.attributes.position.count < 3) return false;
    if (obj.type.includes('Helper') || obj.name.includes('Helper')) return false;
    if (obj.userData?.isHelper || obj.userData?.isGizmo) return false;
    return true;
  }

  private createImageData(floats: Float32Array, width: number, height: number): ImageData {
    const uint8 = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; ++i) {
      const r = floats[i * 4];
      const g = floats[i * 4 + 1];
      const b = floats[i * 4 + 2];
      const a = floats[i * 4 + 3];

      // Reinhard tone mapping & gamma 2.2 correction
      const tr = r / (1.0 + r);
      const tg = g / (1.0 + g);
      const tb = b / (1.0 + b);

      uint8[i * 4] = Math.round(Math.min(1.0, Math.max(0.0, Math.pow(tr, 1.0 / 2.2))) * 255);
      uint8[i * 4 + 1] = Math.round(Math.min(1.0, Math.max(0.0, Math.pow(tg, 1.0 / 2.2))) * 255);
      uint8[i * 4 + 2] = Math.round(Math.min(1.0, Math.max(0.0, Math.pow(tb, 1.0 / 2.2))) * 255);
      uint8[i * 4 + 3] = Math.round(Math.min(1.0, Math.max(0.0, a)) * 255);
    }

    if (typeof ImageData !== 'undefined') {
      return new ImageData(uint8, width, height);
    }
    return { data: uint8, width, height, colorSpace: 'srgb' } as unknown as ImageData;
  }
}
