import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATERIAL_DEFINITION,
  normalize,
  type MaterialDefinition,
  type MaterialParams,
} from '../assets/MaterialDefinition';
import { deserializeMaterial, serializeMaterial } from '../assets/MaterialLibrary';
import { exportDefinition, importDefinition, MaterialDraft, unfreeze } from './MaterialDraft';

/**
 * MaterialDraft contract — the editor's mutable working copy of a frozen
 * MaterialDefinition. Pins three properties:
 * - independence: draft mutations can never touch the source definition
 *   (deep unfrozen clone, defensive getters);
 * - notification: every mutation marks dirty and notifies subscribers,
 *   EventBus-style (unsubscribe fn, snapshot delivery);
 * - validation gate: toDefinition()/export/import report mid-edit invalid
 *   states as errors instead of a def — live apply uses the last-known-good.
 */

/** A definition exercising several map slots and both source kinds. */
function fullDefinition(): MaterialDefinition {
  return normalize({
    id: 'brick-wall',
    shading: 'standard',
    color: 0xcc7755,
    params: { roughness: 0.4, metalness: 0.1, shininess: 12, normalScale: 1.5 },
    uv: { repeat: [2, 3], offset: [0.1, 0.2], rotation: Math.PI / 4, center: [0.5, 0.5] },
    maps: {
      baseColor: { source: { textureSetId: 'brick' } },
      normal: { source: { uri: 'textures/brick_n.png' }, enabled: false },
      bump: { source: { uri: 'textures/brick_b.png' }, scale: 0.7 },
      ao: { source: { uri: 'textures/brick_ao.png' }, intensity: 0.9 },
    },
  });
}

describe('MaterialDraft', () => {
  it('unfreeze() yields an unfrozen deep copy (frozen input untouched)', () => {
    const source = fullDefinition();
    const clone = unfreeze(source);
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(clone)).toBe(false);
    expect(Object.isFrozen(clone.params)).toBe(false);
    expect(Object.isFrozen(clone.uv)).toBe(false);
    expect(Object.isFrozen(clone.maps)).toBe(false);
    clone.params.roughness = 0.99;
    clone.uv.repeat[0] = 42;
    expect(source.params.roughness).toBe(0.4);
    expect(source.uv.repeat[0]).toBe(2);
  });

  it('mutating a draft never touches its source definition', () => {
    const source = fullDefinition();
    const before = serializeMaterial(source);
    const draft = new MaterialDraft(source);
    draft
      .setId('edited')
      .setShading('phong')
      .setColor(0xff0000)
      .setParam('roughness', 0.9)
      .setUvComponent('repeat', 0, 4)
      .setUvRotation(1)
      .setMapSlot('displacement', { uri: 'd.png' });
    expect(serializeMaterial(source)).toBe(before);
    expect(draft.id).toBe('edited');
    expect(draft.shading).toBe('phong');
    expect(draft.color).toBe(0xff0000);
    expect(draft.params.roughness).toBe(0.9);
    expect(draft.uv.repeat[0]).toBe(4);
    expect(draft.uv.rotation).toBe(1);
    expect(draft.maps.displacement?.source).toEqual({ uri: 'd.png' });
  });

  it('getters return defensive copies (mutating them is inert)', () => {
    const draft = new MaterialDraft(fullDefinition());
    const params = draft.params as MaterialParams; // hostile write attempt on the copy
    params.roughness = -1;
    expect(draft.params.roughness).toBe(0.4);
    const uv = draft.uv;
    uv.repeat[0] = 99;
    expect(draft.uv.repeat[0]).toBe(2);
    const maps = draft.maps;
    maps.bump!.scale = 99;
    expect(draft.maps.bump!.scale).toBe(0.7);
  });

  it('setters are chainable and notify subscribers once per mutation', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    let calls = 0;
    draft.subscribe(() => {
      calls++;
    });
    const returned = draft.setColor(0x112233).setParam('metalness', 0.5);
    expect(returned).toBe(draft);
    expect(calls).toBe(2);
  });

  it('subscribe() returns an idempotent unsubscribe', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    let calls = 0;
    const unsubscribe = draft.subscribe(() => {
      calls++;
    });
    draft.setColor(1);
    unsubscribe();
    unsubscribe();
    draft.setColor(2);
    expect(calls).toBe(1);
  });

  it('notifies a snapshot of listeners (late subscribers miss the in-flight mutation)', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    const events: string[] = [];
    draft.subscribe(() => {
      events.push('first');
      if (events.length === 1) {
        draft.subscribe(() => events.push('second'));
      }
    });
    draft.setColor(1);
    expect(events).toEqual(['first']);
    draft.setColor(2);
    expect(events).toEqual(['first', 'first', 'second']);
  });

  it('every mutation marks dirty; clearDirty() resets the flag', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    expect(draft.dirty).toBe(false);
    draft.setColor(0x00ff00);
    expect(draft.dirty).toBe(true);
    draft.clearDirty();
    expect(draft.dirty).toBe(false);
    draft.setParam('shininess', 60);
    expect(draft.dirty).toBe(true);
  });

  it('toDefinition() round-trips a valid draft to a NEW frozen definition', () => {
    const source = fullDefinition();
    const draft = new MaterialDraft(source);
    draft.setId('renamed');
    const result = draft.toDefinition();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.def?.id).toBe('renamed');
    expect(result.def).not.toBe(source);
    expect(Object.isFrozen(result.def)).toBe(true);
    expect(Object.isFrozen(result.def?.params)).toBe(true);
    expect(serializeMaterial(result.def!)).toBe(
      serializeMaterial(normalize({ ...source, id: 'renamed' })),
    );
  });

  it('toDefinition() reports mid-edit invalid states instead of a def', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    draft.setUvComponent('repeat', 1, 0); // repeat [1, 0] — degenerate tiling
    const result = draft.toDefinition();
    expect(result.valid).toBe(false);
    expect(result.def).toBeUndefined();
    expect(result.errors.join('\n')).toContain('uv.repeat');
  });

  it('replace() swaps the whole content and notifies once', () => {
    const draft = new MaterialDraft(fullDefinition());
    let calls = 0;
    draft.subscribe(() => {
      calls++;
    });
    draft.replace(normalize({ id: 'other', color: 0xff00ff, maps: { normal: { source: { uri: 'n.png' } } } }));
    expect(draft.id).toBe('other');
    expect(draft.color).toBe(0xff00ff);
    expect(draft.maps.normal?.source).toEqual({ uri: 'n.png' });
    expect(draft.maps.bump).toBeUndefined();
    expect(calls).toBe(1);
    expect(draft.dirty).toBe(true);
  });

  it('map slot setters add, update and remove slots (extras no-op when absent)', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    draft.setMapSlot('bump', { uri: 'b.png' });
    expect(draft.maps.bump?.source).toEqual({ uri: 'b.png' });
    draft.setMapBumpScale(2.5);
    expect(draft.maps.bump?.scale).toBe(2.5);
    draft.setMapSlot('normal', { textureSetId: 't1' });
    draft.setMapNormalEnabled(false);
    expect(draft.maps.normal).toEqual({ source: { textureSetId: 't1' }, enabled: false });
    draft.setMapSlot('ao', { uri: 'ao.png' });
    draft.setMapAoIntensity(0.5);
    expect(draft.maps.ao?.intensity).toBe(0.5);
    draft.setMapSlot('displacement', { uri: 'd.png' });
    draft.setMapDisplacementScale(0.25);
    expect(draft.maps.displacement?.scale).toBe(0.25);
    draft.setMapSlot('bump', null);
    expect(draft.maps.bump).toBeUndefined();
    const def = draft.toDefinition().def!;
    expect(def.maps.bump).toBeUndefined();
    expect(def.maps.normal).toEqual({ source: { textureSetId: 't1' }, enabled: false });
    // Extra setters on an absent slot must not throw or notify.
    let calls = 0;
    draft.subscribe(() => {
      calls++;
    });
    draft.setMapBumpScale(9);
    expect(calls).toBe(0);
  });
});

describe('exportDefinition', () => {
  it('serializes a valid draft into a `${id}.json` download payload', () => {
    const draft = new MaterialDraft(fullDefinition());
    draft.setColor(0x123456);
    const payload = exportDefinition(draft);
    if (!('filename' in payload)) {
      throw new Error(`expected an export payload, got errors: ${payload.errors.join('; ')}`);
    }
    expect(payload.filename).toBe('brick-wall.json');
    const round = deserializeMaterial(payload.json);
    expect(round.valid).toBe(true);
    expect(round.def?.color).toBe(0x123456);
    expect(serializeMaterial(round.def!)).toBe(serializeMaterial(draft.toDefinition().def!));
  });

  it('carries the validated def so callers reuse this result (no second toDefinition)', () => {
    const draft = new MaterialDraft(fullDefinition());
    draft.setColor(0x123456);
    const payload = exportDefinition(draft);
    if (!('filename' in payload)) {
      throw new Error('expected an export payload');
    }
    expect(payload.def).toEqual(draft.toDefinition().def); // frozen, normalized
    expect(Object.isFrozen(payload.def)).toBe(true);
    expect(payload.def.color).toBe(0x123456);
  });

  it('returns errors and no payload for an invalid draft', () => {
    const draft = new MaterialDraft(fullDefinition());
    draft.setId(''); // mid-edit: cleared id field
    const payload = exportDefinition(draft);
    expect('filename' in payload).toBe(false);
    if ('errors' in payload) {
      expect(payload.errors.join('\n')).toContain('id');
    } else {
      throw new Error('expected an errors result');
    }
  });
});

describe('importDefinition', () => {
  it('replaces the draft content and notifies on valid JSON', () => {
    const draft = new MaterialDraft(DEFAULT_MATERIAL_DEFINITION());
    let calls = 0;
    draft.subscribe(() => {
      calls++;
    });
    const result = importDefinition(
      draft,
      serializeMaterial(normalize({ id: 'plastic', params: { roughness: 0.1 } })),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(draft.id).toBe('plastic');
    expect(draft.params.roughness).toBeCloseTo(0.1);
    expect(calls).toBe(1);
  });

  it('leaves the draft untouched on invalid JSON (errors reported, no throw)', () => {
    const draft = new MaterialDraft(fullDefinition());
    let calls = 0;
    draft.subscribe(() => {
      calls++;
    });
    const result = importDefinition(draft, '{ not json');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('invalid JSON');
    expect(draft.id).toBe('brick-wall');
    expect(calls).toBe(0);
  });
});
