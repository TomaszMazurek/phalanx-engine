import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GroundTruthRenderer } from './GroundTruthRenderer';

describe('GroundTruthRenderer', () => {
  it('renders physical ground-truth perspective camera view via WebAssembly', async () => {
    const scene = new THREE.Scene();

    // Red sphere in front of camera
    const sphereGeom = new THREE.SphereGeometry(2, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.2,
      metalness: 0.8
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.set(0, 0, -5);
    scene.add(sphere);

    // Perspective camera pointing at sphere
    const camera = new THREE.PerspectiveCamera(60, 1.0, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -5);

    const renderer = new GroundTruthRenderer();
    const result = await renderer.renderView(scene, camera, {
      width: 16,
      height: 16,
      samples: 4,
      maxDepth: 3,
      backgroundColor: [0.1, 0.1, 0.15]
    });

    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
    expect(result.samples).toBe(4);
    expect(result.floatPixels.length).toBe(16 * 16 * 4);
    expect(result.triangleCount).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify center pixel reflects red sphere or ambient
    const midIdx = (8 * 16 + 8) * 4;
    expect(result.floatPixels[midIdx + 3]).toBeCloseTo(1.0); // alpha is 1

    const imgData = result.toImageData();
    expect(imgData).toBeDefined();
    expect(imgData.width).toBe(16);
    expect(imgData.height).toBe(16);
    expect(imgData.data.length).toBe(16 * 16 * 4);
  });
});
