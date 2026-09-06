/**
 * EnvManifest — declarative environment presets (pure data layer, no three.js).
 *
 * Continuation of the manifest pattern (`assets/manifest.ts`,
 * `MaterialDefinition.ts`): an environment is JSON, so the editor gets file
 * I/O and preset dropdowns for free. Presets reference equirectangular HDRIs
 * BY URI; nothing is loaded here (ESLint boundary: src/assets stays
 * renderer-agnostic).
 *
 * Data policy — mirrors MaterialDefinition:
 * - validateEnvManifest() collects errors instead of throwing.
 * - normalizeEnvPreset() is lenient: fills defaults, clamps ranges and
 *   always yields a well-formed preset object. Real content is gated through
 *   validateEnvManifest() first; normalize is for editor drafts.
 */

/** How the environment shows up behind the scene. */
export type EnvironmentBackground = 'off' | 'skybox' | 'blur';

/** One IBL environment as declared in the manifest (URI, not yet loaded). */
export interface EnvironmentPreset {
  /** Editor-facing identifier; unique within a manifest. */
  id: string;
  /** Human-readable label for preset dropdowns. */
  name: string;
  /** URI of the equirectangular RADIANCE .hdr file. */
  hdri: string;
  /** Background mode; `blur` uses {@link blurAmount}. */
  background: EnvironmentBackground;
  /** Background blur in [0, 1]; only used when background is `blur`. */
  blurAmount: number;
  /** IBL intensity multiplier, >= 0 (scene.environmentIntensity). */
  intensity: number;
}

export interface EnvManifest {
  environments: EnvironmentPreset[];
}

/** Outcome of {@link validateEnvManifest}: an error list, not an exception. */
export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

const BACKGROUNDS: readonly EnvironmentBackground[] = ['off', 'skybox', 'blur'];

const MANIFEST_FIELDS: ReadonlySet<string> = new Set(['environments']);

const ENTRY_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'hdri',
  'background',
  'blurAmount',
  'intensity',
]);

/**
 * Strict structural check, mirroring MaterialDefinition.validate(): every
 * field PRESENT must be well-typed and in range, required fields must exist,
 * and unknown fields are rejected (top level AND per entry) so typos in
 * hand-written JSON surface. The three optional fields (background,
 * blurAmount, intensity) may be absent — normalizeEnvPreset() fills them.
 */
export function validateEnvManifest(input: unknown): EnvValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  for (const key of Object.keys(input)) {
    if (!MANIFEST_FIELDS.has(key)) {
      errors.push(`unknown field "${key}"`);
    }
  }
  if (!('environments' in input)) {
    errors.push('missing required field "environments"');
    return { valid: false, errors };
  }
  if (!Array.isArray(input.environments)) {
    errors.push('field "environments" must be an array');
    return { valid: false, errors };
  }
  const firstSeen = new Map<string, string>();
  input.environments.forEach((entry: unknown, index: number) => {
    validateEntry(entry, `environments[${index}]`, firstSeen, errors);
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Lenient counterpart for a single preset: overlays the well-formed pieces
 * of `input` onto the defaults (background 'off', blurAmount 0, intensity 1),
 * clamps ranges and returns a NEW frozen preset. Identity fields pass
 * through when well-formed — normalize never invents asset paths (a
 * malformed hdri yields '', which fails loading with a descriptive error;
 * gate real manifests through validateEnvManifest() first).
 */
export function normalizeEnvPreset(input: unknown): EnvironmentPreset {
  const record = isRecord(input) ? input : {};
  const id = isNonEmptyString(record.id) ? record.id : 'environment';
  return Object.freeze({
    id,
    name: isNonEmptyString(record.name) ? record.name : id,
    hdri: isHdrUri(record.hdri) ? record.hdri : '',
    background: isBackground(record.background) ? record.background : 'off',
    blurAmount: clamp(pickNumber(record.blurAmount) ?? 0, 0, 1),
    intensity: Math.max(0, pickNumber(record.intensity) ?? 1),
  });
}

// --- validation internals -------------------------------------------------

function validateEntry(
  entry: unknown,
  path: string,
  firstSeen: Map<string, string>,
  errors: string[],
): void {
  if (!isRecord(entry)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_FIELDS.has(key)) {
      errors.push(`${path}: unknown field "${key}"`);
    }
  }
  if (!('id' in entry)) {
    errors.push(`${path}: missing required field "id"`);
  } else if (!isNonEmptyString(entry.id)) {
    errors.push(`${path}.id must be a non-empty string, got ${stringifyValue(entry.id)}`);
  } else if (firstSeen.has(entry.id)) {
    errors.push(`duplicate id "${entry.id}" at ${path} (first declared at ${firstSeen.get(entry.id)})`);
  } else {
    firstSeen.set(entry.id, path);
  }
  if (!('name' in entry)) {
    errors.push(`${path}: missing required field "name"`);
  } else if (!isNonEmptyString(entry.name)) {
    errors.push(`${path}.name must be a non-empty string, got ${stringifyValue(entry.name)}`);
  }
  if (!('hdri' in entry)) {
    errors.push(`${path}: missing required field "hdri"`);
  } else if (!isHdrUri(entry.hdri)) {
    errors.push(`${path}.hdri must end in ".hdr", got ${stringifyValue(entry.hdri)}`);
  }
  if ('background' in entry && !isBackground(entry.background)) {
    errors.push(
      `${path}.background must be one of: ${BACKGROUNDS.join(', ')}, got ${stringifyValue(entry.background)}`,
    );
  }
  if ('blurAmount' in entry) {
    checkNumber(errors, entry.blurAmount, `${path}.blurAmount`, 'a finite number in [0, 1]', (n) =>
      n >= 0 && n <= 1,
    );
  }
  if ('intensity' in entry) {
    checkNumber(errors, entry.intensity, `${path}.intensity`, 'a finite number >= 0', (n) => n >= 0);
  }
}

function checkNumber(
  errors: string[],
  value: unknown,
  path: string,
  constraint: string,
  inRange: (n: number) => boolean,
): void {
  if (!isFiniteNumber(value) || !inRange(value)) {
    errors.push(`${path} must be ${constraint}, got ${stringifyValue(value)}`);
  }
}

// --- shared small helpers (MaterialDefinition style) ------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBackground(value: unknown): value is EnvironmentBackground {
  return typeof value === 'string' && (BACKGROUNDS as readonly string[]).includes(value);
}

function isHdrUri(value: unknown): value is string {
  return isNonEmptyString(value) && value.endsWith('.hdr');
}

function pickNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** JSON-style rendering of a found value for error messages ("toon", 2, NaN, null). */
function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
