import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadPathTracerWasm } from './loadWasm';
import { PathTracerBridge } from './PathTracerBridge';
import { SceneExtractor } from './SceneExtractor';

describe('PathTracer WebAssembly & Bridge', () => {
  it('loads WebAssembly module and exposes native functions', async () => {
    const wasm = await loadPathTracerWasm();
    expect(wasm).toBeDefined();
    expect(typeof wasm._pt_alloc).toBe('function');
    expect(typeof wasm._pt_free).toBe('function');
    expect(typeof wasm._pt_bake).toBe('function');
  });

  it('runs complete scene extraction, BVH build, and AO baking', async () => {
    const wasm = await loadPathTracerWasm();
    const bridge = new PathTracerBridge(wasm);

    bridge.clearScene();
    expect(bridge.getPrimitiveCount()).toBe(0);

    // Create a Three.js ground plane
    const planeGeom = new THREE.PlaneGeometry(10, 10);
    planeGeom.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);

    // Extract geometry and material
    const geomBuffers = SceneExtractor.extractMeshGeometry(planeMesh);
    expect(geomBuffers).not.toBeNull();
    const matParams = SceneExtractor.extractMaterialParams(planeMat);

    const matId = bridge.addMaterial(matParams);
    const triCount = bridge.addMesh(geomBuffers!, matId);
    expect(triCount).toBe(2);
    expect(bridge.getPrimitiveCount()).toBe(2);

    const bvhOk = bridge.buildBVH();
    expect(bvhOk).toBe(true);

    // Perform a small 16x16 AO bake
    const bakeResult = bridge.bake({
      width: 16,
      height: 16,
      samples: 8,
      type: 'ao',
      aoMaxDistance: 20.0,
      seed: 1234
    });

    expect(bakeResult.width).toBe(16);
    expect(bakeResult.height).toBe(16);
    expect(bakeResult.data.length).toBe(16 * 16 * 4);

    // Convert to Three.js DataTexture
    const lightmap = SceneExtractor.createLightmapTexture(bakeResult);
    expect(lightmap).toBeInstanceOf(THREE.DataTexture);
    expect(lightmap.image.width).toBe(16);
    expect(lightmap.image.height).toBe(16);
  });
});
