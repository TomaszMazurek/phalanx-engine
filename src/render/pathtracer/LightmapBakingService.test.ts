import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightmapBakingService } from './LightmapBakingService';

describe('LightmapBakingService', () => {
  it('bakes AO into a scene and attaches lightMap to meshes', async () => {
    const scene = new THREE.Scene();

    // Floor mesh (has uv but no uv2 initially)
    const floorGeom = new THREE.PlaneGeometry(10, 10);
    floorGeom.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.name = 'Floor';
    scene.add(floorMesh);

    // Box occluder sitting on floor
    const boxGeom = new THREE.BoxGeometry(2, 2, 2);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xcc3333 });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    boxMesh.name = 'Box';
    boxMesh.position.set(0, 1, 0);
    scene.add(boxMesh);

    // Add a helper that should be ignored
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.name = 'GridHelper';
    scene.add(gridHelper);

    expect(floorGeom.attributes.uv2).toBeUndefined();

    const service = new LightmapBakingService();
    const result = await service.bakeScene(scene, {
      type: 'ao',
      resolution: 32,
      samples: 8,
      aoMaxDistance: 10.0,
      dilationPixels: 1,
    });

    expect(result.meshCount).toBe(2);
    expect(result.triangleCount).toBeGreaterThanOrEqual(14); // 2 plane + 12 box
    expect(result.texture).toBeInstanceOf(THREE.DataTexture);
    expect(result.texture.image.width).toBe(32);
    expect(result.texture.image.height).toBe(32);

    // Verify UV2 was added to floor geometry
    expect(floorGeom.attributes.uv2).toBeDefined();

    // Verify lightMap was assigned to both meshes
    expect(floorMat.lightMap).toBe(result.texture);
    expect(floorMat.lightMapIntensity).toBe(1.0);
    expect(boxMat.lightMap).toBe(result.texture);
  });
});
