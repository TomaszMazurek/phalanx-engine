import * as THREE from 'three';
import { loadPathTracerWasm } from './loadWasm';
import { PathTracerBridge } from './PathTracerBridge';
import { SceneExtractor } from './SceneExtractor';
import type { BakeType } from './types';

export interface LightmapBakeOptions {
  type?: BakeType;
  resolution?: number;
  samples?: number;
  aoMaxDistance?: number;
  maxBounces?: number;
  normalBias?: number;
  dilationPixels?: number;
  seed?: number;
  onProgress?: (step: string, progress: number) => void;
}

export interface LightmapBakeResult {
  meshCount: number;
  triangleCount: number;
  resolution: number;
  durationMs: number;
  texture: THREE.DataTexture;
}

export class LightmapBakingService {
  private bridgePromise: Promise<PathTracerBridge> | null = null;

  private async getBridge(): Promise<PathTracerBridge> {
    if (!this.bridgePromise) {
      this.bridgePromise = loadPathTracerWasm().then((wasm) => new PathTracerBridge(wasm));
    }
    return this.bridgePromise;
  }

  /**
   * Discovers all bakeable meshes in the given scene/object hierarchy,
   * extracts world geometry and PBR materials, bakes AO/GI lightmaps via C++ WASM,
   * assigns the resulting lightMap DataTexture to the meshes, and returns execution metrics.
   */
  public async bakeScene(
    root: THREE.Object3D,
    options: LightmapBakeOptions = {}
  ): Promise<LightmapBakeResult> {
    const startTime = performance.now();
    const resolution = options.resolution ?? 128;
    const samples = options.samples ?? 32;
    const bakeType = options.type ?? 'ao';
    const aoMaxDistance = options.aoMaxDistance ?? 50.0;
    const maxBounces = options.maxBounces ?? 3;
    const normalBias = options.normalBias ?? 0.005;
    const dilationPixels = options.dilationPixels ?? 2;
    const seed = options.seed ?? 42;

    options.onProgress?.('Collecting scene meshes...', 0.1);

    // 1. Discover all bakeable meshes
    const bakeableMeshes: THREE.Mesh[] = [];
    root.traverse((obj) => {
      if (this.isBakeableMesh(obj)) {
        bakeableMeshes.push(obj);
      }
    });

    if (bakeableMeshes.length === 0) {
      throw new Error('LightmapBakingService: No bakeable meshes found in hierarchy');
    }

    // 2. Ensure UV2 attributes exist on all meshes (required by Three.js lightMap shaders)
    for (const mesh of bakeableMeshes) {
      this.ensureUV2(mesh.geometry);
    }

    options.onProgress?.('Preparing PathTracer BVH...', 0.3);

    // 3. Initialize WASM bridge
    const bridge = await this.getBridge();
    bridge.clearScene();

    // 3.5 Extract and register analytical lights and ambient background
    const extractedLights = SceneExtractor.extractLights(root);
    if (extractedLights.backgroundColor) {
      bridge.setBackgroundColor(extractedLights.backgroundColor);
    }
    for (const light of extractedLights.lights) {
      if (light.type === 'directional' && light.direction) {
        bridge.addDirectionalLight(light.direction, light.color, light.intensity);
      } else if (light.type === 'point' && light.position) {
        bridge.addPointLight(light.position, light.color, light.intensity, light.range ?? 0);
      } else if (light.type === 'spot' && light.position && light.direction) {
        bridge.addSpotLight(
          light.position,
          light.direction,
          light.color,
          light.intensity,
          light.range ?? 0,
          light.innerConeAngle ?? 0,
          light.outerConeAngle ?? Math.PI / 4
        );
      }
    }

    let totalTriangles = 0;

    // 4. Extract and upload materials & meshes to path tracer
    for (const mesh of bakeableMeshes) {
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const pbr = SceneExtractor.extractMaterialParams(mat);
      const matId = bridge.addMaterial(pbr);

      const geomBuffers = SceneExtractor.extractMeshGeometry(mesh);
      if (geomBuffers) {
        const added = bridge.addMesh(geomBuffers, matId);
        totalTriangles += added;
      }
    }

    if (totalTriangles === 0) {
      throw new Error('LightmapBakingService: Scene contains 0 extractable triangles');
    }

    // 5. Build LinearBVH acceleration structure
    const bvhOk = bridge.buildBVH();
    if (!bvhOk) {
      throw new Error('LightmapBakingService: Failed to build BVH acceleration structure');
    }

    options.onProgress?.(`Baking ${bakeType.toUpperCase()} (${resolution}x${resolution}, ${samples}spp)...`, 0.5);

    // 6. Execute bake
    const bakeResult = bridge.bake({
      width: resolution,
      height: resolution,
      samples,
      type: bakeType,
      aoMaxDistance,
      maxBounces,
      normalBias,
      dilationPixels,
      seed
    });

    options.onProgress?.('Generating Three.js DataTexture and updating materials...', 0.9);

    // 7. Create Three.js DataTexture
    const texture = SceneExtractor.createLightmapTexture(bakeResult);

    // 8. Bind lightMap texture to all meshes in the baked scene
    for (const mesh of bakeableMeshes) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          if ('lightMap' in m) {
            (m as THREE.MeshStandardMaterial).lightMap = texture;
            (m as THREE.MeshStandardMaterial).lightMapIntensity = 1.0;
            m.needsUpdate = true;
          }
        }
      } else if (mesh.material && 'lightMap' in mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).lightMap = texture;
        (mesh.material as THREE.MeshStandardMaterial).lightMapIntensity = 1.0;
        mesh.material.needsUpdate = true;
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    options.onProgress?.(`Bake completed in ${durationMs}ms`, 1.0);

    return {
      meshCount: bakeableMeshes.length,
      triangleCount: totalTriangles,
      resolution,
      durationMs,
      texture
    };
  }

  private isBakeableMesh(obj: THREE.Object3D): obj is THREE.Mesh {
    if (!(obj instanceof THREE.Mesh) && !(obj as THREE.Mesh).isMesh) {
      return false;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.geometry || !mesh.geometry.attributes.position) {
      return false;
    }
    if (mesh.geometry.attributes.position.count < 3) {
      return false;
    }
    if (
      obj.type.includes('Helper') ||
      obj.name.includes('Helper') ||
      obj.userData?.isHelper ||
      obj.userData?.isGizmo ||
      obj.userData?.isStatic === false ||
      obj.userData?.dynamic === true
    ) {
      return false;
    }
    return true;
  }

  private ensureUV2(geom: THREE.BufferGeometry): void {
    if (geom.attributes.uv2) return;

    if (geom.attributes.uv) {
      geom.setAttribute('uv2', geom.attributes.uv.clone());
    } else {
      const count = geom.attributes.position.count;
      geom.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
  }
}
