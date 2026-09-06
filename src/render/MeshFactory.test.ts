import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AssetManager } from '../assets/AssetManager';
import { ensureUv1, isModelId, loadModelShape, MeshFactory } from './MeshFactory';

/**
 * MeshFactory model-namespace tests (Phase 3, wave C3) — the pure headless
 * slice only: prefix detection, the combined shape list, uv1 duplication,
 * unknown-id rejection. The glTF fetch itself and the viewer swap are
 * DOM/three-visual — manual acceptance in wave E, like the WebGL renderer.
 */
describe('MeshFactory model namespace', () => {
  it('isModelId detects the model: namespace and rejects primitive names', () => {
    expect(isModelId('model:demo-cube')).toBe(true);
    // Namespace prefix, not registry membership — resolution rejects later.
    expect(isModelId('model:')).toBe(true);
    expect(isModelId('Sphere')).toBe(false);
    expect(isModelId('Box')).toBe(false);
    expect(isModelId('')).toBe(false);
    expect(isModelId('Model:demo-cube')).toBe(false); // case-sensitive prefix
    expect(isModelId('primitive:model:')).toBe(false); // prefix must match at the start
  });

  it('list() appends model ids after the untouched primitive names', () => {
    const list = MeshFactory.list();
    expect(list).toContain('Sphere'); // primitives unchanged (DevPanel backward compat)
    expect(list).toContain('model:demo-cube');
    expect(list.indexOf('model:demo-cube')).toBeGreaterThan(list.indexOf('Sphere'));
    expect(new Set(list).size).toBe(list.length); // no collisions across namespaces
  });

  it('ensureUv1 clones uv into uv1 once and leaves uv-less geometries alone', () => {
    const withUv = new THREE.BoxGeometry(1, 1, 1);
    ensureUv1(withUv);
    expect(withUv.getAttribute('uv1')).toBeDefined();
    expect(withUv.getAttribute('uv1').array).toEqual(withUv.getAttribute('uv').array);
    const uv1 = withUv.getAttribute('uv1');
    ensureUv1(withUv); // idempotent — an existing uv1 is never overwritten
    expect(withUv.getAttribute('uv1')).toBe(uv1);

    const uvless = new THREE.BufferGeometry(); // e.g. the demo cube: COLOR_0 only
    ensureUv1(uvless);
    expect(uvless.getAttribute('uv1')).toBeUndefined();
  });

  it('loadModelShape rejects unknown ids before touching the AssetManager', async () => {
    await expect(loadModelShape('model:nope', new AssetManager())).rejects.toThrow(
      'MeshFactory: unknown model "model:nope"',
    );
    await expect(loadModelShape('Sphere', new AssetManager())).rejects.toThrow(
      'MeshFactory: unknown model "Sphere"',
    );
  });
});
