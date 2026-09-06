import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { normalize, type MaterialDefinition } from '../assets/MaterialDefinition';
import { composeUVMatrix } from '../assets/UVTransform';
import { applyUpdate, compile, type TextureResolver } from './MaterialCompiler';

/**
 * Contract tests on REAL three.js objects — materials and textures
 * construct headlessly in node (no WebGL), so nothing here is faked.
 *
 * needsUpdate note (three 0.185): Material.needsUpdate is a SETTER-ONLY
 * property (reading it yields undefined); the observable is `material.version`
 * — 0 for a fresh material, incremented by every `needsUpdate = true`.
 */

/** Fresh un-normalized input exercising every map slot; each call is a new mutable object. */
function fullInput() {
  return {
    version: 1,
    id: 'brick-wall',
    shading: 'standard' as const,
    color: 0xcc7755,
    params: { roughness: 0.4, metalness: 0.1, shininess: 12, normalScale: 1.5 },
    uv: { repeat: [2, 3], offset: [0.1, 0.2], rotation: Math.PI / 6, center: [0.25, 0.75] },
    maps: {
      baseColor: { source: { textureSetId: 'brick-base' } },
      normal: { source: { uri: 'brick_n.png' }, enabled: true },
      bump: { source: { uri: 'brick_b.png' }, scale: 0.7 },
      roughness: { source: { textureSetId: 'brick-rough' } },
      ao: { source: { uri: 'brick_ao.png' }, intensity: 0.9 },
      displacement: { source: { uri: 'brick_d.png' }, scale: 0.05 },
    },
  };
}

/** The same definition, normalized and frozen (the compiler's input shape). */
function fullDef(): MaterialDefinition {
  return normalize(fullInput());
}

/** Per-test world: fresh textures (uv application mutates them) + a resolver over them. */
function makeWorld(): { tex: Record<string, THREE.Texture>; resolver: TextureResolver } {
  const tex: Record<string, THREE.Texture> = {
    base: new THREE.Texture(),
    normal: new THREE.Texture(),
    bump: new THREE.Texture(),
    rough: new THREE.Texture(),
    ao: new THREE.Texture(),
    displacement: new THREE.Texture(),
  };
  const sources: Record<string, THREE.Texture> = {
    'brick-base': tex.base,
    'brick_n.png': tex.normal,
    'brick_b.png': tex.bump,
    'brick-rough': tex.rough,
    'brick_ao.png': tex.ao,
    'brick_d.png': tex.displacement,
  };
  const resolver: TextureResolver = {
    resolve: (source) => sources['textureSetId' in source ? source.textureSetId : source.uri] ?? null,
  };
  return { tex, resolver };
}

/** Entry-wise matrix comparison (toBeCloseTo, so −0 vs 0 never trips it). */
function expectMatricesClose(actual: THREE.Matrix3, expected: THREE.Matrix3): void {
  actual.elements.forEach((entry, i) => expect(entry).toBeCloseTo(expected.elements[i], 12));
}

describe('MaterialCompiler', () => {
  describe('compile()', () => {
    it('standard: binds every slot with the values from the def', () => {
      const { tex, resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const standard = material as THREE.MeshStandardMaterial;
      expect(standard.map).toBe(tex.base);
      expect(standard.normalMap).toBe(tex.normal);
      expect(standard.normalScale.x).toBe(1.5); // params.normalScale → Vector2(s, s)
      expect(standard.normalScale.y).toBe(1.5);
      expect(standard.bumpMap).toBe(tex.bump);
      expect(standard.bumpScale).toBe(0.7); // slot extra passes through
      expect(standard.roughnessMap).toBe(tex.rough);
      expect(standard.aoMap).toBe(tex.ao);
      expect(standard.aoMapIntensity).toBe(0.9); // slot extra passes through
      expect(standard.displacementMap).toBe(tex.displacement);
      expect(standard.displacementScale).toBe(0.05); // slot extra passes through
      expect(standard.roughness).toBe(0.4);
      expect(standard.metalness).toBe(0.1);
      expect(standard.color.getHex()).toBe(0xcc7755);
    });

    it('phong: shininess from params, shared slots bound, roughness slot not consumed', () => {
      const { tex, resolver } = makeWorld();
      const calls: string[] = [];
      const tracking: TextureResolver = {
        resolve: (source) => {
          const key = 'textureSetId' in source ? source.textureSetId : source.uri;
          calls.push(key);
          return resolver.resolve(source);
        },
      };
      const def = normalize({ ...fullInput(), shading: 'phong' as const });
      const material = compile(def, tracking);
      expect(material).toBeInstanceOf(THREE.MeshPhongMaterial);
      const phong = material as THREE.MeshPhongMaterial;
      expect(phong.shininess).toBe(12);
      expect(phong.map).toBe(tex.base);
      expect(phong.normalMap).toBe(tex.normal);
      expect(phong.bumpMap).toBe(tex.bump);
      expect(phong.aoMap).toBe(tex.ao);
      expect(phong.displacementMap).toBe(tex.displacement);
      // The standard-only slot is never even asked for…
      expect(calls).not.toContain('brick-rough');
      // …and phong has no roughnessMap property at all.
      expect('roughnessMap' in phong).toBe(false);
    });

    it('skips a disabled normal slot even when the resolver can serve it', () => {
      const { tex, resolver } = makeWorld();
      const input = fullInput();
      input.maps.normal = { source: { uri: 'brick_n.png' }, enabled: false };
      const material = compile(normalize(input), resolver);
      expect((material as THREE.MeshStandardMaterial).normalMap).toBeNull();
      expect(tex.normal.offset.x).toBe(0); // never bound → never uv-touched
    });

    it('skips unresolvable slots (null) without throwing; the def is untouched', () => {
      const def = fullDef();
      const snapshot = structuredClone(def);
      const empty: TextureResolver = { resolve: () => null };
      const material = compile(def, empty);
      const standard = material as THREE.MeshStandardMaterial;
      expect(standard.map).toBeNull();
      expect(standard.normalMap).toBeNull();
      expect(standard.bumpMap).toBeNull();
      expect(standard.roughnessMap).toBeNull();
      expect(standard.aoMap).toBeNull();
      expect(standard.displacementMap).toBeNull();
      expect(standard.roughness).toBe(0.4); // params still applied
      expect(standard.color.getHex()).toBe(0xcc7755);
      expect(def).toEqual(snapshot);
    });
  });

  describe('UV transform', () => {
    it('writes the four Texture properties onto every bound texture', () => {
      const { tex, resolver } = makeWorld();
      compile(fullDef(), resolver);
      for (const texture of Object.values(tex)) {
        expect(texture.offset.x).toBeCloseTo(0.1, 12);
        expect(texture.offset.y).toBeCloseTo(0.2, 12);
        expect(texture.repeat.x).toBeCloseTo(2, 12);
        expect(texture.repeat.y).toBeCloseTo(3, 12);
        expect(texture.rotation).toBeCloseTo(Math.PI / 6, 12);
        expect(texture.center.x).toBeCloseTo(0.25, 12);
        expect(texture.center.y).toBeCloseTo(0.75, 12);
      }
    });

    it('updateMatrix() then yields exactly composeUVMatrix loaded row-major via Matrix3.set()', () => {
      const { tex, resolver } = makeWorld();
      compile(fullDef(), resolver);
      tex.base.updateMatrix(); // recompute matrix from the four properties
      const expected = new THREE.Matrix3();
      expected.set(...composeUVMatrix(fullDef().uv)); // row-major load — the ONLY correct way
      expectMatricesClose(tex.base.matrix, expected);
    });

    it('fromArray of the row-major tuple silently transposes (the wave-A trap)', () => {
      // fromArray consumes COLUMN-major: with rotation ≠ 0 it yields the
      // TRANSPOSE of the intended matrix — the discriminator for the layout.
      const tuple = composeUVMatrix(fullDef().uv);
      const rowMajor = new THREE.Matrix3().set(...tuple);
      const columnMajor = new THREE.Matrix3().fromArray(tuple);
      expect(columnMajor.elements).not.toEqual(rowMajor.elements);
      // …and it is exactly the transpose:
      const transpose = new THREE.Matrix3().set(
        tuple[0],
        tuple[3],
        tuple[6],
        tuple[1],
        tuple[4],
        tuple[7],
        tuple[2],
        tuple[5],
        tuple[8],
      );
      expectMatricesClose(columnMajor, transpose);
    });
  });

  describe('applyUpdate()', () => {
    it('mutates the SAME instance: params/color applied, identity unchanged', () => {
      const { resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      const before = material;
      const next = normalize({
        version: 1,
        id: 'repaint',
        shading: 'standard',
        color: 0x00ff00,
        params: { roughness: 0.9, metalness: 0.8, normalScale: 2 },
      });
      expect(applyUpdate(material, next, resolver)).toBeUndefined(); // void — no realloc API
      expect(material).toBe(before);
      const standard = material as THREE.MeshStandardMaterial;
      expect(standard.roughness).toBe(0.9);
      expect(standard.metalness).toBe(0.8);
      expect(standard.normalScale.x).toBe(2);
      expect(standard.normalScale.y).toBe(2);
      expect(standard.color.getHex()).toBe(0x00ff00);
      // In-place update lands in the same state a fresh compile would:
      const fresh = compile(next, resolver) as THREE.MeshStandardMaterial;
      expect(standard.roughness).toBe(fresh.roughness);
      expect(standard.metalness).toBe(fresh.metalness);
      expect(standard.color.equals(fresh.color)).toBe(true);
    });

    it('flags a slot ADDITION via needsUpdate (version++)', () => {
      const { tex, resolver } = makeWorld();
      const material = compile(normalize({ version: 1, id: 'bare', shading: 'standard', color: 0 }), resolver);
      expect(material.version).toBe(0); // bare def: nothing ever flagged
      applyUpdate(material, fullDef(), resolver);
      expect(material.version).toBeGreaterThan(0);
      expect((material as THREE.MeshStandardMaterial).map).toBe(tex.base);
    });

    it('nulls REMOVED slots and flags needsUpdate', () => {
      const { resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      const version = material.version;
      applyUpdate(material, normalize({ version: 1, id: 'bare', shading: 'standard', color: 0 }), resolver);
      expect(material.version).toBeGreaterThan(version);
      const standard = material as THREE.MeshStandardMaterial;
      expect(standard.map).toBeNull();
      expect(standard.normalMap).toBeNull();
      expect(standard.bumpMap).toBeNull();
      expect(standard.roughnessMap).toBeNull();
      expect(standard.aoMap).toBeNull();
      expect(standard.displacementMap).toBeNull();
    });

    it('leaves needsUpdate untouched when nothing changes (slider round-trip)', () => {
      const { resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      const version = material.version; // compile flagged its initial bindings once
      applyUpdate(material, fullDef(), resolver); // same values, stable resolver identities
      expect(material.version).toBe(version); // no re-flag
    });

    it('flags a slot whose texture IDENTITY changed', () => {
      const { resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      const version = material.version;
      const replacement = new THREE.Texture();
      const swap: TextureResolver = {
        resolve: (source) =>
          'textureSetId' in source && source.textureSetId === 'brick-base' ? replacement : resolver.resolve(source),
      };
      applyUpdate(material, fullDef(), swap);
      expect(material.version).toBeGreaterThan(version);
      expect((material as THREE.MeshStandardMaterial).map).toBe(replacement);
    });

    it('refreshes the shared UV on bound textures without flagging needsUpdate', () => {
      const { tex, resolver } = makeWorld();
      const material = compile(fullDef(), resolver);
      const version = material.version;
      const input = fullInput();
      input.uv = { repeat: [5, 6], offset: [-0.5, 0.25], rotation: Math.PI / 3, center: [0, 0] };
      applyUpdate(material, normalize(input), resolver);
      for (const texture of Object.values(tex)) {
        expect(texture.repeat.x).toBe(5);
        expect(texture.repeat.y).toBe(6);
        expect(texture.offset.x).toBe(-0.5);
        expect(texture.offset.y).toBe(0.25);
        expect(texture.rotation).toBe(Math.PI / 3);
        expect(texture.center.y).toBe(0);
      }
      expect(material.version).toBe(version); // texture matrix rides the existing program
      expect((material as THREE.MeshStandardMaterial).map).toBe(tex.base); // slots untouched
    });
  });
});
