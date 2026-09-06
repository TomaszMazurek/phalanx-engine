import { describe, expect, it } from 'vitest';
import {
  normalizeEnvPreset,
  validateEnvManifest,
  type EnvManifest,
  type EnvironmentPreset,
} from './EnvManifest';

/**
 * Minimal fs surface for the shipped-asset tests. The app tsconfig targets
 * the browser (no @types/node), so node:fs is imported dynamically behind
 * a single documented boundary cast — the test RUNS under vitest's node
 * environment where the module exists. Uint8Array (not Buffer) keeps the
 * cast dependency-free.
 */
interface NodeFs {
  readFileSync(url: URL, encoding: 'utf8'): string;
  readFileSync(url: URL): Uint8Array;
}
// @ts-expect-error node:fs has no type declarations in this project (browser target)
const fs = (await import('node:fs')) as NodeFs;

/** The shipped manifest, as data — mirrors the real public/env/manifest.json. */
function shippedManifest(): EnvManifest {
  return {
    environments: [
      {
        id: 'studio',
        name: 'Studio',
        hdri: 'env/studio.hdr',
        background: 'off',
        blurAmount: 0,
        intensity: 1,
      },
      {
        id: 'sunset',
        name: 'Sunset',
        hdri: 'env/sunset.hdr',
        background: 'skybox',
        blurAmount: 0,
        intensity: 1.2,
      },
    ],
  };
}

describe('EnvManifest', () => {
  describe('validateEnvManifest()', () => {
    it('accepts the shipped manifest with two complete presets', () => {
      expect(validateEnvManifest(shippedManifest())).toEqual({ valid: true, errors: [] });
    });

    it('accepts minimal presets: background/blurAmount/intensity may be absent', () => {
      const manifest = {
        environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr' }],
      };
      expect(validateEnvManifest(manifest)).toEqual({ valid: true, errors: [] });
    });

    it('accepts every background mode in range', () => {
      for (const background of ['off', 'skybox', 'blur'] as const) {
        const manifest = {
          environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr', background }],
        };
        expect(validateEnvManifest(manifest).valid).toBe(true);
      }
    });

    it('rejects non-objects', () => {
      for (const input of [null, undefined, 42, 'nope', [], true]) {
        expect(validateEnvManifest(input)).toEqual({
          valid: false,
          errors: ['manifest must be an object'],
        });
      }
    });

    it('reports missing "environments" as a required field', () => {
      const result = validateEnvManifest({});
      expect(result.errors).toContain('missing required field "environments"');
      expect(result.valid).toBe(false);
    });

    it('reports a non-array "environments"', () => {
      const result = validateEnvManifest({ environments: { id: 'a' } });
      expect(result.errors).toContain('field "environments" must be an array');
    });

    it('rejects unknown manifest fields', () => {
      const result = validateEnvManifest({ ...shippedManifest(), version: 1 });
      expect(result.errors).toContain('unknown field "version"');
      expect(result.valid).toBe(false);
    });

    it('reports non-object entries with their index', () => {
      const result = validateEnvManifest({
        environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr' }, 42],
      });
      expect(result.errors).toContain('environments[1] must be an object');
    });

    it('rejects unknown entry fields with their index', () => {
      const manifest = {
        environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr', roation: 1 }],
      };
      const result = validateEnvManifest(manifest);
      expect(result.errors).toContain('environments[0]: unknown field "roation"');
    });

    it('reports missing, empty and non-string ids', () => {
      const result = validateEnvManifest({
        environments: [{ name: 'A', hdri: 'env/a.hdr' }, { id: '', name: 'B', hdri: 'b.hdr' }],
      });
      expect(result.errors).toContain('environments[0]: missing required field "id"');
      expect(result.errors).toContain('environments[1].id must be a non-empty string, got ""');
    });

    it('rejects duplicate ids, naming the second occurrence', () => {
      const result = validateEnvManifest({
        environments: [
          { id: 'studio', name: 'A', hdri: 'env/a.hdr' },
          { id: 'studio', name: 'B', hdri: 'env/b.hdr' },
        ],
      });
      expect(result.errors).toEqual([
        'duplicate id "studio" at environments[1] (first declared at environments[0])',
      ]);
    });

    it('reports missing names', () => {
      const result = validateEnvManifest({
        environments: [{ id: 'a', hdri: 'env/a.hdr' }],
      });
      expect(result.errors).toContain('environments[0]: missing required field "name"');
    });

    it('rejects hdri URIs not ending in .hdr', () => {
      const result = validateEnvManifest({
        environments: [
          { id: 'a', name: 'A', hdri: 'env/a.exr' },
          { id: 'b', name: 'B', hdri: 7 },
        ],
      });
      expect(result.errors).toContain('environments[0].hdri must end in ".hdr", got "env/a.exr"');
      expect(result.errors).toContain('environments[1].hdri must end in ".hdr", got 7');
    });

    it('rejects a background outside the enum', () => {
      const result = validateEnvManifest({
        environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr', background: 'gradient' }],
      });
      expect(result.errors).toContain(
        'environments[0].background must be one of: off, skybox, blur, got "gradient"',
      );
    });

    it('rejects blurAmount outside [0, 1] or not a finite number', () => {
      for (const blurAmount of [-0.1, 1.5, Number.POSITIVE_INFINITY, 'half', null]) {
        const result = validateEnvManifest({
          environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr', blurAmount }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/^environments\[0\]\.blurAmount must be a finite number in \[0, 1\]/);
      }
    });

    it('rejects negative or non-finite intensity', () => {
      for (const intensity of [-1, Number.NaN, 'bright', null]) {
        const result = validateEnvManifest({
          environments: [{ id: 'a', name: 'A', hdri: 'env/a.hdr', intensity }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatch(/^environments\[0\]\.intensity must be a finite number >= 0/);
      }
    });
  });

  describe('normalizeEnvPreset()', () => {
    it('fills the documented defaults: background off, blur 0, intensity 1', () => {
      const preset = normalizeEnvPreset({ id: 'studio', name: 'Studio', hdri: 'env/studio.hdr' });
      expect(preset).toEqual({
        id: 'studio',
        name: 'Studio',
        hdri: 'env/studio.hdr',
        background: 'off',
        blurAmount: 0,
        intensity: 1,
      });
    });

    it('keeps every valid field as given', () => {
      const input: EnvironmentPreset = {
        id: 'sunset',
        name: 'Sunset',
        hdri: 'env/sunset.hdr',
        background: 'blur',
        blurAmount: 0.4,
        intensity: 1.2,
      };
      expect(normalizeEnvPreset(input)).toEqual(input);
    });

    it('clamps blurAmount into [0, 1]', () => {
      const high = normalizeEnvPreset({ id: 'a', name: 'A', hdri: 'a.hdr', blurAmount: 2 });
      const low = normalizeEnvPreset({ id: 'a', name: 'A', hdri: 'a.hdr', blurAmount: -1 });
      expect(high.blurAmount).toBe(1);
      expect(low.blurAmount).toBe(0);
    });

    it('clamps negative intensity to 0 but keeps positive values', () => {
      const negative = normalizeEnvPreset({ id: 'a', name: 'A', hdri: 'a.hdr', intensity: -3 });
      const positive = normalizeEnvPreset({ id: 'a', name: 'A', hdri: 'a.hdr', intensity: 4.5 });
      expect(negative.intensity).toBe(0);
      expect(positive.intensity).toBe(4.5);
    });

    it('resets an invalid background to "off"', () => {
      const preset = normalizeEnvPreset({
        id: 'a',
        name: 'A',
        hdri: 'a.hdr',
        background: 'nebula',
      });
      expect(preset.background).toBe('off');
    });

    it('falls back to a placeholder id and derives name from id; keeps malformed hdri empty', () => {
      const preset = normalizeEnvPreset({ name: 7, hdri: 'env/studio.png' });
      expect(preset.id).toBe('environment');
      expect(preset.name).toBe('environment');
      expect(preset.hdri).toBe('');
    });

    it('normalizes non-objects to the full default preset', () => {
      expect(normalizeEnvPreset(null)).toEqual({
        id: 'environment',
        name: 'environment',
        hdri: '',
        background: 'off',
        blurAmount: 0,
        intensity: 1,
      });
    });

    it('returns a frozen preset and never aliases the input', () => {
      const input = { id: 'a', name: 'A', hdri: 'a.hdr', blurAmount: 0.9 };
      const preset = normalizeEnvPreset(input);
      expect(Object.isFrozen(preset)).toBe(true);
      input.blurAmount = 0.1;
      expect(preset.blurAmount).toBe(0.9);
    });
  });

  describe('public/env/manifest.json (shipped asset)', () => {
    // Lazy reads: these tests need the generated assets on disk; the pure
    // data-layer tests above must stay runnable without them.
    const readManifest = (): EnvManifest =>
      JSON.parse(
        fs.readFileSync(new URL('../../public/env/manifest.json', import.meta.url), 'utf8'),
      ) as EnvManifest;

    it('passes validateEnvManifest', () => {
      const result = validateEnvManifest(readManifest());
      expect(result).toEqual({ valid: true, errors: [] });
    });

    it('declares exactly the two shipped presets with the planned modes', () => {
      const envs = readManifest().environments;
      expect(envs.map((p) => p.id)).toEqual(['studio', 'sunset']);
      expect(envs[0]).toMatchObject({ background: 'off', intensity: 1 });
      expect(envs[1]).toMatchObject({ background: 'skybox', intensity: 1.2 });
    });

    it('references .hdr files that exist, carry a RADIANCE header and exact pixel payload', () => {
      for (const preset of readManifest().environments) {
        const file = fs.readFileSync(new URL(`../../public/${preset.hdri}`, import.meta.url));
        // Single-byte decode: char index === byte offset for header parsing.
        const text = new TextDecoder('latin1').decode(file);
        expect(text.startsWith('#?RADIANCE\n')).toBe(true);
        expect(text).toContain('FORMAT=32-bit_rle_rgbe');
        // Header: magic line, FORMAT line, blank line, "-Y h +X w" line.
        const match = text.match(/^-Y (\d+) \+X (\d+)\n/m);
        expect(match).not.toBeNull();
        const [, h, w] = match as RegExpMatchArray;
        const pixelOffset = text.indexOf('\n', text.indexOf(match![0])) + 1;
        expect(file.byteLength).toBe(pixelOffset + Number(w) * Number(h) * 4);
        // Flat-scanline trap (HDRLoader RGBE_ReadPixels_RLE): a file whose
        // first RGBE pixel is (2, 2, >=128) would be misparsed as RLE.
        const first = file.subarray(pixelOffset, pixelOffset + 3);
        expect(first[0] === 2 && first[1] === 2 && (first[2] & 0x80) !== 0).toBe(false);
      }
    });
  });
});
