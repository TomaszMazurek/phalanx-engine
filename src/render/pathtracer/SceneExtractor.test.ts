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

  it('extracts analytical lights and ambient background from scene hierarchy', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.2, 0.3, 0.4);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(0, 10, 0);
    dirLight.target.position.set(0, 0, 0);
    scene.add(dirLight);
    scene.add(dirLight.target);

    const pointLight = new THREE.PointLight(0xff8844, 5.0, 15.0);
    pointLight.position.set(2, 3, 4);
    scene.add(pointLight);

    const spotLight = new THREE.SpotLight(0x00ff00, 3.0, 20.0, Math.PI / 3, 0.5);
    spotLight.position.set(0, 5, 0);
    spotLight.target.position.set(0, 0, 0);
    scene.add(spotLight);
    scene.add(spotLight.target);

    const ambLight = new THREE.AmbientLight(0x111111, 0.5);
    scene.add(ambLight);

    const result = SceneExtractor.extractLights(scene);

    expect(result.lights.length).toBe(3);
    expect(result.lights[0].type).toBe('directional');
    expect(result.lights[0].intensity).toBe(2.0);
    expect(result.lights[0].direction![1]).toBeCloseTo(-1.0); // pointing downwards

    expect(result.lights[1].type).toBe('point');
    expect(result.lights[1].position).toEqual([2, 3, 4]);
    expect(result.lights[1].intensity).toBe(5.0);
    expect(result.lights[1].range).toBe(15.0);

    expect(result.lights[2].type).toBe('spot');
    expect(result.lights[2].intensity).toBe(3.0);
    expect(result.lights[2].range).toBe(20.0);
    expect(result.lights[2].outerConeAngle).toBeCloseTo(Math.PI / 3);

    expect(result.backgroundColor).toBeDefined();
    expect(result.backgroundColor![0]).toBeGreaterThan(0.2); // background + ambient
  });
});
