import { describe, expect, it } from 'vitest';
import { deserializeMaterial, serializeMaterial } from './MaterialLibrary';
import { normalize, type MaterialDefinition } from './MaterialDefinition';

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

describe('MaterialLibrary', () => {
  it('round-trips: serialize → deserialize → serialize is byte-stable', () => {
    const def = normalize(fullDefinition());
    const text = serializeMaterial(def);

    const result = deserializeMaterial(text);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.def).toEqual(def);
    expect(serializeMaterial(result.def!)).toBe(text);
  });

  it('serializes in canonical key order regardless of the input object shape', () => {
    const canonical: MaterialDefinition = {
      version: 1,
      id: 'm',
      shading: 'standard',
      color: 1,
      params: { roughness: 0.5, metalness: 0, shininess: 10, normalScale: 1 },
      uv: { repeat: [2, 2], offset: [0, 0], rotation: 0, center: [0.5, 0.5] },
      maps: {
        baseColor: { source: { uri: 'b.png' } },
        bump: { source: { uri: 'bump.png' }, scale: 1 },
      },
    };
    // Same content, every nesting level built in a different key order.
    const shuffled: MaterialDefinition = {
      maps: {
        bump: { source: { uri: 'bump.png' }, scale: 1 },
        baseColor: { source: { uri: 'b.png' } },
      },
      uv: { center: [0.5, 0.5], rotation: 0, offset: [0, 0], repeat: [2, 2] },
      params: { normalScale: 1, shininess: 10, metalness: 0, roughness: 0.5 },
      color: 1,
      shading: 'standard',
      id: 'm',
      version: 1,
    };

    expect(serializeMaterial(shuffled)).toBe(serializeMaterial(canonical));
  });

  it('omits unset map slots in the output; deserialize re-fills them', () => {
    const def = normalize({ version: 1, id: 'm', shading: 'standard', color: 0 });
    const text = serializeMaterial(def);
    expect(text).not.toContain('baseColor');

    const result = deserializeMaterial(text);

    expect(result.valid).toBe(true);
    expect(result.def).toEqual(def);
  });

  it('malformed JSON: graceful errors, never a throw, no def', () => {
    const result = deserializeMaterial('{ not json');
    expect(result.valid).toBe(false);
    expect(result.def).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('invalid JSON');
  });

  it('valid JSON that is not an object is rejected', () => {
    for (const text of ['null', '"material"', '42', '[]']) {
      expect(deserializeMaterial(text)).toEqual({
        valid: false,
        errors: ['definition must be a JSON object'],
      });
    }
  });

  it('versioning stub: a future version is rejected with a single clear error', () => {
    const future = { ...fullDefinition(), version: 2, unknownField: 'noise' };
    const result = deserializeMaterial(JSON.stringify(future));
    expect(result).toEqual({
      valid: false,
      errors: ['unsupported version: 2 (expected 1)'], // no schema-error cascade
    });
  });

  it('unknown top-level fields are rejected (strict, editor-friendly)', () => {
    const text = '{"version":1,"id":"m","shading":"standard","color":0,"specular":0.5}';
    const result = deserializeMaterial(text);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['unknown field "specular"']);
  });
});
