import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATERIAL_DEFINITION,
  normalize,
  validate,
  type MaterialDefinition,
} from './MaterialDefinition';

/** A definition exercising every map slot and both source kinds. */
function fullDefinition(): MaterialDefinition {
  return {
    version: 1,
    id: 'brick-wall',
    shading: 'standard',
    color: 0xcc7755,
    params: { roughness: 0.4, metalness: 0.1, shininess: 12, normalScale: 1.5 },
    uv: { repeat: [2, 3], offset: [0.1, 0.2], rotation: Math.PI / 4, center: [0.5, 0.5] },
    maps: {
      baseColor: { source: { textureSetId: 'brick' } },
      normal: { source: { uri: 'textures/brick_n.png' }, enabled: false },
      bump: { source: { uri: 'textures/brick_b.png' }, scale: 0.7 },
      roughness: { source: { textureSetId: 'brick' } },
      ao: { source: { uri: 'textures/brick_ao.png' }, intensity: 0.9 },
      displacement: { source: { uri: 'textures/brick_d.png' }, scale: 0.05 },
    },
  };
}

/** Every number anywhere in a normalized def — the finite-invariant walker. */
function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) {
      collectNumbers(entry, out);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectNumbers(entry, out);
    }
  }
  return out;
}

describe('MaterialDefinition', () => {
  describe('DEFAULT_MATERIAL_DEFINITION()', () => {
    it('returns the documented baseline: white, rough, non-metal, identity UVs', () => {
      expect(DEFAULT_MATERIAL_DEFINITION()).toEqual({
        version: 1,
        id: 'material',
        shading: 'standard',
        color: 0xffffff,
        params: { roughness: 0.8, metalness: 0, shininess: 30, normalScale: 1 },
        uv: { repeat: [1, 1], offset: [0, 0], rotation: 0, center: [0.5, 0.5] },
        maps: {},
      });
    });

    it('returns an independent frozen object per call', () => {
      const a = DEFAULT_MATERIAL_DEFINITION();
      const b = DEFAULT_MATERIAL_DEFINITION();
      expect(a).not.toBe(b);
      expect(a.params).not.toBe(b.params);
      expect(Object.isFrozen(a)).toBe(true);
      expect(Object.isFrozen(a.params)).toBe(true);
      expect(Object.isFrozen(a.uv)).toBe(true);
      expect(Object.isFrozen(a.uv.repeat)).toBe(true);
      expect(Object.isFrozen(a.maps)).toBe(true);
    });
  });

  describe('validate()', () => {
    it('accepts a full definition with every map slot', () => {
      expect(validate(fullDefinition())).toEqual({ valid: true, errors: [] });
    });

    it('accepts a minimal definition: optional containers may be absent', () => {
      const result = validate({ version: 1, id: 'm', shading: 'phong', color: 0x112233 });
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('rejects non-objects', () => {
      for (const input of [null, undefined, 42, 'nope', [], true]) {
        expect(validate(input)).toEqual({
          valid: false,
          errors: ['definition must be an object'],
        });
      }
    });

    it('reports missing version as a required field', () => {
      const result = validate({ id: 'm', shading: 'standard', color: 0 });
      expect(result.errors).toContain('missing required field "version"');
    });

    it('rejects wrong version, empty id, bad shading, bad color and unknown fields, in order', () => {
      const result = validate({
        version: 2,
        id: '',
        shading: 'toon',
        color: 'red',
        extra: 'unknown-top-level-field',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        'unknown field "extra"',
        'unsupported version: 2 (expected 1)',
        'field "id" must be a non-empty string, got ""',
        'field "shading" must be one of: standard, phong, got "toon"',
        'field "color" must be a finite number, got "red"',
      ]);
    });

    it('rejects out-of-range and non-finite params with named paths', () => {
      const result = validate({
        version: 1,
        id: 'm',
        shading: 'standard',
        color: 0,
        params: { roughness: 1.5, metalness: -0.1, shininess: -1, normalScale: Number.NaN },
      });
      expect(result.errors).toEqual([
        'params.roughness must be a finite number in [0, 1], got 1.5',
        'params.metalness must be a finite number in [0, 1], got -0.1',
        'params.shininess must be a finite number >= 0, got -1',
        'params.normalScale must be a finite number >= 0, got NaN',
      ]);
    });

    it('rejects malformed UV tuples, non-finite rotation and zero repeat', () => {
      const result = validate({
        version: 1,
        id: 'm',
        shading: 'standard',
        color: 0,
        uv: {
          repeat: [1, 0],
          offset: [0.5],
          rotation: Number.POSITIVE_INFINITY,
          center: ['a', 'b'],
        },
      });
      expect(result.errors).toEqual([
        'uv.repeat must not be zero (degenerate UV tiling)',
        'uv.offset must be a tuple of two finite numbers',
        'uv.rotation must be a finite number, got Infinity',
        'uv.center must be a tuple of two finite numbers',
      ]);
    });

    it('requires each map source to be exactly one of textureSetId/uri (non-empty)', () => {
      const result = validate({
        version: 1,
        id: 'm',
        shading: 'standard',
        color: 0,
        maps: {
          baseColor: { source: { textureSetId: 'brick', uri: 'x.png' } }, // both
          normal: { source: {} }, // neither
          bump: { source: { uri: '' }, scale: 1 }, // empty string
          ao: { source: { textureSetId: 'brick' }, intensity: 'high' }, // bad extra type
          displacement: 'not-a-slot', // not an object
        },
      });
      expect(result.errors).toEqual([
        'maps.baseColor.source must specify exactly one of "textureSetId" or "uri"',
        'maps.normal.source must specify exactly one of "textureSetId" or "uri"',
        'maps.bump.source.uri must be a non-empty string',
        'maps.ao.intensity must be a finite number',
        'maps.displacement must be an object',
      ]);
    });
  });

  describe('normalize()', () => {
    it('fills every optional field from defaults without mutating the input', () => {
      const input = {
        version: 1,
        id: 'mossy-stone',
        shading: 'standard',
        color: 0x33aa44,
        params: { roughness: 0.25 },
        uv: { repeat: [4, 2] },
        maps: { roughness: { source: { textureSetId: 'stone' } } },
      };
      const snapshot = structuredClone(input);

      const def = normalize(input);

      expect(input).toEqual(snapshot); // input untouched
      expect(def).toEqual({
        version: 1,
        id: 'mossy-stone',
        shading: 'standard',
        color: 0x33aa44,
        params: { roughness: 0.25, metalness: 0, shininess: 30, normalScale: 1 },
        uv: { repeat: [4, 2], offset: [0, 0], rotation: 0, center: [0.5, 0.5] },
        maps: { roughness: { source: { textureSetId: 'stone' } } },
      });
    });

    it('clamps out-of-range numbers and resets a degenerate repeat to identity', () => {
      const def = normalize({
        version: 1,
        id: 'm',
        shading: 'standard',
        color: 0,
        params: { roughness: 7, metalness: -3, shininess: -10, normalScale: -1 },
        uv: { repeat: [0, 3] },
      });
      expect(def.params).toEqual({ roughness: 1, metalness: 0, shininess: 0, normalScale: 0 });
      expect(def.uv.repeat).toEqual([1, 1]); // whole tuple resets, not half-patched
    });

    it('fills slot-specific defaults and drops malformed slots', () => {
      const def = normalize({
        version: 1,
        id: 'm',
        shading: 'standard',
        color: 0,
        maps: {
          normal: { source: { uri: 'n.png' } }, // enabled defaults to true
          bump: { source: { uri: 'b.png' }, scale: 2 }, // kept
          ao: { source: { uri: 'a.png' } }, // intensity defaults to 1
          displacement: { source: { uri: 'd.png' } }, // scale defaults to 1
          baseColor: { source: {} }, // invalid source → slot dropped
          roughness: 'junk', // not an object → slot dropped
        },
      });
      expect(def.maps).toEqual({
        normal: { source: { uri: 'n.png' }, enabled: true },
        bump: { source: { uri: 'b.png' }, scale: 2 },
        ao: { source: { uri: 'a.png' }, intensity: 1 },
        displacement: { source: { uri: 'd.png' }, scale: 1 },
      });
    });

    it('returns a new frozen object (drafts are copies; compiled defs are frozen)', () => {
      const input = { version: 1, id: 'm', shading: 'standard', color: 0 };
      const def = normalize(input);
      expect(def).not.toBe(input);
      expect(Object.isFrozen(def)).toBe(true);
      expect(Object.isFrozen(def.params)).toBe(true);
      expect(Object.isFrozen(def.uv)).toBe(true);
      expect(Object.isFrozen(def.uv.repeat)).toBe(true);
      expect(Object.isFrozen(def.maps)).toBe(true);
    });

    it('freezes a FULL definition deeply: every slot and its source too', () => {
      const def = normalize(fullDefinition());
      expect(Object.isFrozen(def)).toBe(true);
      expect(Object.isFrozen(def.params)).toBe(true);
      expect(Object.isFrozen(def.uv)).toBe(true);
      expect(Object.isFrozen(def.uv.repeat)).toBe(true);
      expect(Object.isFrozen(def.uv.offset)).toBe(true);
      expect(Object.isFrozen(def.uv.center)).toBe(true);
      expect(Object.isFrozen(def.maps)).toBe(true);
      for (const slot of Object.values(def.maps)) {
        expect(slot).toBeDefined();
        expect(Object.isFrozen(slot)).toBe(true);
        expect(Object.isFrozen(slot!.source)).toBe(true);
      }
    });

    it('always yields a definition that passes validate(), even from garbage', () => {
      const garbage: unknown[] = [
        null,
        undefined,
        42,
        'text',
        [],
        [fullDefinition()],
        { version: 'one', id: 7, shading: 'lambert', color: 'blue' },
        { params: 'nope', uv: 3, maps: true },
        // NaN/Infinity must fall back to defaults — never pass through as numbers.
        {
          version: 1,
          id: 'm',
          shading: 'standard',
          color: 0,
          params: { roughness: Number.NaN, metalness: Number.POSITIVE_INFINITY },
          uv: { repeat: [Number.NaN, 1], rotation: Number.POSITIVE_INFINITY },
        },
      ];
      for (const input of garbage) {
        const def = normalize(input);
        expect(validate(def)).toEqual({ valid: true, errors: [] });
        expect(collectNumbers(def).every(Number.isFinite)).toBe(true);
      }
    });

    it('falls back to the baseline for unrecognizable input', () => {
      expect(normalize(null)).toEqual(DEFAULT_MATERIAL_DEFINITION());
    });
  });
});
