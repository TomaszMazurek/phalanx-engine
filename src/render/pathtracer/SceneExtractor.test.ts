import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneExtractor } from './SceneExtractor';

describe('SceneExtractor', () => {
  it('extracts world-space geometry from a Three.js Mesh', () => {
    const geometry = new THREE.PlaneGeometry(10, 10);
    geometry.rotateX(-Math.PI / 2); // Orient horizontally on XZ plane so local Y = 0
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);

    // Place at y = 5
    mesh.position.set(0, 5, 0);
    mesh.updateMatrixWorld(true);

    const extracted = SceneExtractor.extractMeshGeometry(mesh);
    expect(extracted).not.toBeNull();
    expect(extracted!.positions.length).toBe(geometry.attributes.position.count * 3);

    // Verify positions were transformed in Y by +5
    for (let i = 1; i < extracted!.positions.length; i += 3) {
      expect(extracted!.positions[i]).toBeCloseTo(5.0);
    }

    // Verify indices
    expect(extracted!.indices).toBeDefined();
    expect(extracted!.indices!.length).toBe(6); // 2 triangles for a plane
  });

  it('extracts PBR material properties from MeshStandardMaterial', () => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x336699,
      roughness: 0.25,
      metalness: 0.75,
      emissive: 0x112233,
      emissiveIntensity: 2.0
    });

    const pbr = SceneExtractor.extractMaterialParams(mat);
    expect(pbr.roughness).toBe(0.25);
    expect(pbr.metalness).toBe(0.75);
    expect(pbr.emissiveIntensity).toBe(2.0);
    expect(pbr.baseColor).toBeDefined();
    expect(pbr.baseColor![0]).toBeCloseTo(mat.color.r);
    expect(pbr.baseColor![1]).toBeCloseTo(mat.color.g);
    expect(pbr.baseColor![2]).toBeCloseTo(mat.color.b);
  });

  it('creates DataTexture from BakeResult', () => {
    const bakeResult = {
      width: 4,
      height: 4,
      data: new Float32Array(4 * 4 * 4).fill(0.5)
    };

    const texture = SceneExtractor.createLightmapTexture(bakeResult);
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture.image.width).toBe(4);
    expect(texture.image.height).toBe(4);
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(texture.type).toBe(THREE.FloatType);
  });
});
