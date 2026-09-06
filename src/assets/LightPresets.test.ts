import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIGHT_COLOR,
  MAX_LIGHT_POINTS,
  normalizeLightPreset,
  validateLightingPresets,
  type LightPreset,
  type LightingPresetManifest,
} from './LightPresets';

/**
 * Minimal fs surface for the shipped-asset tests. The app tsconfig targets
 * the browser (no @types/node), so node:fs is imported dynamically behind
 * a single documented boundary cast — the test RUNS under vitest's node
 * environment where the module exists.
 */
interface NodeFs {
  readFileSync(url: URL, encoding: 'utf8'): string;
}
// @ts-expect-error node:fs has no type declarations in this project (browser target)
const fs = (await import('node:fs')) as NodeFs;

/** Mirrors the JSON-style error rendering of stringifyValue in LightPresets. */
function renderValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/** A fully specified preset, as the shipped file carries them. */
function completePreset(id: string): LightPreset {
  return {
    id,
    name: id.toUpperCase(),
    ambient: { intensity: 0.35, color: 0xffffff },
    hemisphere: { intensity: 0.55, skyColor: 0xbfd9e8, groundColor: 0x40382e },
    directional: { intensity: 1, color: 0xfff2df },
    points: [{ intensity: 0.5, color: 0xff9a4d }],
  };
}

describe('LightPresets', () => {
  describe('validateLightingPresets()', () => {
    it('accepts a manifest of fully specified presets', () => {
      const manifest: LightingPresetManifest = {
        presets: [completePreset('day'), completePreset('dusk')],
      };
      expect(validateLightingPresets(manifest)).toEqual({ valid: true, errors: [] });
    });

    it('accepts minimal entries: every light group may be absent', () => {
      const manifest = { presets: [{ id: 'a', name: 'A' }] };
      expect(validateLightingPresets(manifest)).toEqual({ valid: true, errors: [] });
    });

    it('rejects non-objects', () => {
      for (const input of [null, undefined, 42, 'nope', [], true]) {
        expect(validateLightingPresets(input)).toEqual({
          valid: false,
          errors: ['manifest must be an object'],
        });
      }
    });

    it('reports missing/non-array "presets" and unknown manifest fields', () => {
      expect(validateLightingPresets({}).errors).toContain('missing required field "presets"');
      expect(validateLightingPresets({ presets: 7 }).errors).toContain(
        'field "presets" must be an array',
      );
      expect(validateLightingPresets({ presets: [], version: 1 }).errors).toContain(
        'unknown field "version"',
      );
    });

    it('rejects duplicate ids, naming the second occurrence', () => {
      const manifest = { presets: [completePreset('day'), completePreset('day')] };
      expect(validateLightingPresets(manifest).errors).toEqual([
        'duplicate id "day" at presets[1] (first declared at presets[0])',
      ]);
    });

    it('reports missing/empty ids and missing names with their index', () => {
      const manifest = { presets: [{ name: 'A' }, { id: '', name: 'B' }, { id: 'c' }] };
      const errors = validateLightingPresets(manifest).errors;
      expect(errors).toContain('presets[0]: missing required field "id"');
      expect(errors).toContain('presets[1].id must be a non-empty string, got ""');
      expect(errors).toContain('presets[2]: missing required field "name"');
    });

    it('rejects unknown preset fields with their index', () => {
      const manifest = { presets: [{ id: 'a', name: 'A', ambiant: { intensity: 1 } }] };
      expect(validateLightingPresets(manifest).errors).toContain(
        'presets[0]: unknown field "ambiant"',
      );
    });

    it('rejects negative or non-finite intensities in every slot', () => {
      for (const intensity of [-1, Number.NaN, Number.POSITIVE_INFINITY, 'bright', null]) {
        const preset = completePreset('a');
        (preset.ambient as { intensity: unknown }).intensity = intensity;
        const result = validateLightingPresets({ presets: [preset] });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toBe(
          `presets[0].ambient.intensity must be a finite number >= 0, got ${renderValue(intensity)}`,
        );
      }
      // Remaining slot paths report their own location.
      const paths: Array<[keyof LightPreset, string]> = [
        ['hemisphere', 'hemisphere.intensity'],
        ['directional', 'directional.intensity'],
    ];
      const manifests = paths.map(([slot]) => {
        const preset = completePreset('a');
        (preset[slot] as { intensity: unknown }).intensity = -1;
        return { presets: [preset] };
      });
      expect(validateLightingPresets(manifests[0]).errors[0]).toBe(
        'presets[0].hemisphere.intensity must be a finite number >= 0, got -1',
      );
      expect(validateLightingPresets(manifests[1]).errors[0]).toBe(
        'presets[0].directional.intensity must be a finite number >= 0, got -1',
      );
    });

    it('rejects colors outside [0x000000, 0xffffff] or non-integers', () => {
      for (const color of [1.5, -1, 0x1000000, 'red', null]) {
        const preset = completePreset('a');
        (preset.ambient as { color: unknown }).color = color;
        const result = validateLightingPresets({ presets: [preset] });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toBe(
          `presets[0].ambient.color must be an integer hex color in [0x000000, 0xffffff], got ${renderValue(color)}`,
        );
      }
      // Remaining color paths report their own location.
      const preset = completePreset('a');
      preset.hemisphere.skyColor = 0x1000000;
      preset.hemisphere.groundColor = 0.5;
      preset.directional.color = -0xffffff;
      (preset.points[0] as { color: unknown }).color = 16777216;
      const errors = validateLightingPresets({ presets: [preset] }).errors;
      expect(errors).toContain(
        'presets[0].hemisphere.skyColor must be an integer hex color in [0x000000, 0xffffff], got 16777216',
      );
      expect(errors).toContain(
        'presets[0].hemisphere.groundColor must be an integer hex color in [0x000000, 0xffffff], got 0.5',
      );
      expect(errors).toContain(
        'presets[0].directional.color must be an integer hex color in [0x000000, 0xffffff], got -16777215',
      );
      expect(errors).toContain(
        'presets[0].points[0].color must be an integer hex color in [0x000000, 0xffffff], got 16777216',
      );
    });

    it('rejects points arrays longer than the capacity, non-arrays and non-object entries', () => {
      const over = completePreset('a');
      over.points = [
        { intensity: 0.5 },
        { intensity: 0.5 },
        { intensity: 0.5 },
      ];
      expect(validateLightingPresets({ presets: [over] }).errors).toContain(
        `presets[0].points must hold at most ${MAX_LIGHT_POINTS} point entries, got 3`,
      );
      expect(validateLightingPresets({ presets: [{ id: 'a', name: 'A', points: 1 }] }).errors).toContain(
        'presets[0].points must be an array',
      );
      expect(
        validateLightingPresets({ presets: [{ id: 'a', name: 'A', points: [42] }] }).errors,
      ).toContain('presets[0].points[0] must be an object');
    });
  });

  describe('normalizeLightPreset()', () => {
    it('fills the documented defaults: intensity 0, white color per slot, no points', () => {
      expect(normalizeLightPreset({ id: 'studio', name: 'Studio' })).toEqual({
        id: 'studio',
        name: 'Studio',
        ambient: { intensity: 0, color: DEFAULT_LIGHT_COLOR },
        hemisphere: { intensity: 0, skyColor: DEFAULT_LIGHT_COLOR, groundColor: DEFAULT_LIGHT_COLOR },
        directional: { intensity: 0, color: DEFAULT_LIGHT_COLOR },
        points: [],
      });
    });

    it('keeps every valid field as given', () => {
      const input = completePreset('sunset');
      expect(normalizeLightPreset(input)).toEqual(input);
    });

    it('clamps negative intensity to 0 but keeps positive values', () => {
      const negative = normalizeLightPreset({
        id: 'a',
        name: 'A',
        ambient: { intensity: -3 },
      });
      const positive = normalizeLightPreset({
        id: 'a',
        name: 'A',
        directional: { intensity: 0.9 },
      });
      expect(negative.ambient.intensity).toBe(0);
      expect(positive.directional.intensity).toBe(0.9);
    });

    it('resets invalid colors to the default white but keeps valid ones', () => {
      const preset = normalizeLightPreset({
        id: 'a',
        name: 'A',
        hemisphere: { skyColor: 0xd88a5a, groundColor: 'nope' },
        ambient: { color: 1.5 },
      });
      expect(preset.hemisphere.skyColor).toBe(0xd88a5a);
      expect(preset.hemisphere.groundColor).toBe(DEFAULT_LIGHT_COLOR);
      expect(preset.ambient.color).toBe(DEFAULT_LIGHT_COLOR);
    });

    it('trims point lists to the two-light capacity', () => {
      const preset = normalizeLightPreset({
        id: 'a',
        name: 'A',
        points: [{ intensity: 0.1 }, { intensity: 0.2 }, { intensity: 0.3 }],
      });
      expect(preset.points).toEqual([{ intensity: 0.1, color: DEFAULT_LIGHT_COLOR }, { intensity: 0.2, color: DEFAULT_LIGHT_COLOR }]);
    });

    it('falls back to a placeholder id and derives the name from it', () => {
      const preset = normalizeLightPreset({ name: 7 });
      expect(preset.id).toBe('lighting');
      expect(preset.name).toBe('lighting');
    });

    it('normalizes non-objects to the full default preset, frozen and never aliased', () => {
      const input = { id: 'a', name: 'A', ambient: { intensity: 0.9 } };
      const preset = normalizeLightPreset(input);
      expect(normalizeLightPreset(null)).toEqual({
        id: 'lighting',
        name: 'lighting',
        ambient: { intensity: 0, color: DEFAULT_LIGHT_COLOR },
        hemisphere: { intensity: 0, skyColor: DEFAULT_LIGHT_COLOR, groundColor: DEFAULT_LIGHT_COLOR },
        directional: { intensity: 0, color: DEFAULT_LIGHT_COLOR },
        points: [],
      });
      expect(Object.isFrozen(preset)).toBe(true);
      expect(Object.isFrozen(preset.ambient)).toBe(true);
      input.ambient.intensity = 0.1;
      expect(preset.ambient.intensity).toBe(0.9);
    });
  });

  describe('public/lighting/presets.json (shipped asset)', () => {
    // Lazy read: needs the shipped file on disk; the pure tests above must
    // stay runnable without it.
    const readManifest = (): LightingPresetManifest =>
      JSON.parse(
        fs.readFileSync(new URL('../../public/lighting/presets.json', import.meta.url), 'utf8'),
      ) as LightingPresetManifest;

    it('passes validateLightingPresets', () => {
      expect(validateLightingPresets(readManifest())).toEqual({ valid: true, errors: [] });
    });

    it('declares exactly the three shipped presets with the planned values', () => {
      const presets = readManifest().presets;
      expect(presets.map((p) => p.id)).toEqual(['day', 'dusk', 'arena']);
      expect(presets[0].ambient).toMatchObject({ intensity: 0.35 });
      expect(presets[0].hemisphere).toMatchObject({ intensity: 0.55, skyColor: 0xbfd9e8, groundColor: 0x40382e });
      expect(presets[0].directional).toMatchObject({ intensity: 1, color: 0xfff2df });
      expect(presets[0].points).toEqual([]);
      expect(presets[1].hemisphere).toMatchObject({ intensity: 0.4, skyColor: 0xd88a5a, groundColor: 0x2a2438 });
      expect(presets[1].directional).toMatchObject({ intensity: 0.65, color: 0xffb066 });
      expect(presets[1].points).toEqual([{ intensity: 0.5, color: 0xff9a4d }]);
      expect(presets[2].ambient).toMatchObject({ intensity: 0.2 });
      expect(presets[2].hemisphere).toMatchObject({ intensity: 0.5 });
      expect(presets[2].directional).toMatchObject({ intensity: 0.9 });
      expect(presets[2].points).toEqual([
        { intensity: 0.4, color: DEFAULT_LIGHT_COLOR },
        { intensity: 0.4, color: DEFAULT_LIGHT_COLOR },
      ]);
    });

    it('is normalize-stable: every shipped preset already carries the defaults', () => {
      for (const preset of readManifest().presets) {
        expect(normalizeLightPreset(preset)).toEqual(preset);
      }
    });
  });
});
