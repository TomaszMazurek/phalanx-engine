import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { normalize, type MaterialDefinition } from '../assets/MaterialDefinition';
import type { TextureResolver } from './MaterialCompiler';
import { MaterialTarget } from './MaterialTarget';

/**
 * Contract tests on REAL three.js materials (headless-constructible).
 * The only fake is the resolver — here the null resolver, since the
 * target's slot handling is the compiler's job (MaterialCompiler.test.ts)
 * and these tests pin the editor→mesh BRIDGE: update vs. recompile,
 * instance identity, old-material disposal and the fresh mesh lookup.
 */

/** Standard def with values distinct from a fresh MeshStandardMaterial's. */
function standardDef(): MaterialDefinition {
  return normalize({
    version: 1,
    id: 'panel-standard',
    shading: 'standard',
    color: 0xff0000,
    params: { roughness: 0.25, metalness: 0.75, shininess: 10, normalScale: 1 },
  });
}

/** Phong def with values distinct from a fresh MeshPhongMaterial's. */
function phongDef(): MaterialDefinition {
  return normalize({
    version: 1,
    id: 'panel-phong',
    shading: 'phong',
    color: 0x00ff00,
    params: { shininess: 77 },
  });
}

/** Def exercising every map slot; the null resolver answers none of them. */
function mapsDef(): MaterialDefinition {
  return normalize({
    version: 1,
    id: 'mapped',
    shading: 'standard',
    color: 0,
    maps: {
      baseColor: { source: { textureSetId: 'ghost-set' } },
      normal: { source: { uri: 'n.png' }, enabled: true },
      bump: { source: { uri: 'b.png' } },
      roughness: { source: { uri: 'r.png' } },
      ao: { source: { uri: 'a.png' } },
      displacement: { source: { uri: 'd.png' } },
    },
  });
}

/** Resolver that can serve nothing — every slot stays unbound, no throw. */
const nullResolver: TextureResolver = { resolve: () => null };

function makeMesh(material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

/** Probe: how often `material` dispatched its dispose event (three >= r10x).
 * Single-material meshes only — viewer slots never carry material groups. */
function disposeCount(material: THREE.Material | THREE.Material[]): () => number {
  if (Array.isArray(material)) {
    throw new Error('test bug: expected a single material');
  }
  let count = 0;
  material.addEventListener('dispose', () => {
    count += 1;
  });
  return () => count;
}

describe('MaterialTarget', () => {
  it('matching class: updates IN PLACE — same instance, params applied, "updated"', () => {
    const mesh = makeMesh(new THREE.MeshStandardMaterial());
    const material = mesh.material;
    const target = new MaterialTarget({ meshes: () => [mesh], resolver: nullResolver });

    expect(target.applyDefinition(standardDef())).toEqual({ applied: 'updated' });

    expect(mesh.material).toBe(material); // no swap, no shader recompile beyond needsUpdate
    const standard = material as THREE.MeshStandardMaterial;
    expect(standard.color.getHex()).toBe(0xff0000);
    expect(standard.roughness).toBe(0.25);
    expect(standard.metalness).toBe(0.75);
  });

  it('shading mismatch: RECOMPILES — new instance of the def class, old disposed, "recompiled"', () => {
    const mesh = makeMesh(new THREE.MeshPhongMaterial());
    const old = mesh.material;
    const disposed = disposeCount(old);
    const target = new MaterialTarget({ meshes: () => [mesh], resolver: nullResolver });

    expect(target.applyDefinition(standardDef())).toEqual({ applied: 'recompiled' });

    expect(mesh.material).not.toBe(old);
    expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(disposed()).toBe(1); // the caller-visible swap disposes what it replaces
    const fresh = mesh.material as THREE.MeshStandardMaterial;
    expect(fresh.color.getHex()).toBe(0xff0000);
    expect(fresh.roughness).toBe(0.25);
    expect(fresh.metalness).toBe(0.75);
  });

  it('switches back: phong def on a standard material recompiles to phong', () => {
    const mesh = makeMesh(new THREE.MeshStandardMaterial());
    const target = new MaterialTarget({ meshes: () => [mesh], resolver: nullResolver });

    expect(target.applyDefinition(phongDef())).toEqual({ applied: 'recompiled' });

    expect(mesh.material).toBeInstanceOf(THREE.MeshPhongMaterial);
    const phong = mesh.material as THREE.MeshPhongMaterial;
    expect(phong.color.getHex()).toBe(0x00ff00);
    expect(phong.shininess).toBe(77);
  });

  it('looks meshes up FRESH on every applyDefinition (shape/model swaps replace them)', () => {
    const a = makeMesh(new THREE.MeshStandardMaterial());
    const b = makeMesh(new THREE.MeshStandardMaterial());
    let current = [a];
    const target = new MaterialTarget({ meshes: () => current, resolver: nullResolver });

    target.applyDefinition(standardDef());
    expect((a.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);

    current = [b]; // the viewer swapped the mesh out from under us
    expect(target.applyDefinition(standardDef())).toEqual({ applied: 'updated' });
    expect((b.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
    expect((a.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000); // kept state
  });

  it('empty mesh set: no-op, still reports "updated"', () => {
    const target = new MaterialTarget({ meshes: () => [], resolver: nullResolver });
    expect(target.applyDefinition(standardDef())).toEqual({ applied: 'updated' });
  });

  it('unresolvable map slots: skipped without throwing, params still applied', () => {
    const mesh = makeMesh(new THREE.MeshStandardMaterial());
    const target = new MaterialTarget({ meshes: () => [mesh], resolver: nullResolver });

    expect(() => target.applyDefinition(mapsDef())).not.toThrow();

    const standard = mesh.material as THREE.MeshStandardMaterial;
    expect(standard.map).toBeNull();
    expect(standard.normalMap).toBeNull();
    expect(standard.bumpMap).toBeNull();
    expect(standard.roughnessMap).toBeNull();
    expect(standard.aoMap).toBeNull();
    expect(standard.displacementMap).toBeNull();
    expect(standard.color.getHex()).toBe(0); // the def still landed
  });

  it('dispose() owns nothing: viewer-owned materials survive untouched', () => {
    const mesh = makeMesh(new THREE.MeshStandardMaterial());
    const material = mesh.material;
    const disposed = disposeCount(material);
    const target = new MaterialTarget({ meshes: () => [mesh], resolver: nullResolver });

    target.applyDefinition(standardDef());
    target.dispose();

    expect(disposed()).toBe(0);
    expect(mesh.material).toBe(material); // still attached, still the viewer's
  });
});
