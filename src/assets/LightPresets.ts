/**
 * LightPresets — declarative lighting presets (pure data layer, no three.js).
 *
 * Companion to EnvManifest: a lighting preset is JSON (ambient, hemisphere,
 * directional and up to two point-light slots), so editors get file I/O and
 * preset dropdowns for free. Nothing is applied here — the renderer-facing
 * applier lives in src/render/LightingPresets.ts and dispatches a normalized
 * preset onto LightingRig (ESLint boundary: src/assets stays
 * renderer-agnostic).
 *
 * Data policy — mirrors EnvManifest:
 * - validateLightingPresets() collects errors instead of throwing.
 * - normalizeLightPreset() is lenient: fills defaults, clamps ranges and
 *   always yields a well-formed preset object. Real content is gated through
 *   validateLightingPresets() first; normalize is for editor drafts.
 */

/** Color applied wherever a preset slot omits one (neutral warm-less white). */
export const DEFAULT_LIGHT_COLOR = 0xffffff;

/** Upper bound of point-light entries per preset (matches LightingRig capacity). */
export const MAX_LIGHT_POINTS = 2;

/** One intensity+color light (ambient, directional, or a single point slot). */
export interface LightColorSlot {
  /** Light intensity multiplier, >= 0. */
  intensity: number;
  /** Light color as a 0xRRGGBB integer; defaults to {@link DEFAULT_LIGHT_COLOR}. */
  color?: number;
}

/** Hemisphere light: separate sky and ground tinting. */
export interface HemisphereSlot {
  /** Light intensity multiplier, >= 0. */
  intensity: number;
  /** Sky color as a 0xRRGGBB integer; defaults to {@link DEFAULT_LIGHT_COLOR}. */
  skyColor?: number;
  /** Ground color as a 0xRRGGBB integer; defaults to {@link DEFAULT_LIGHT_COLOR}. */
  groundColor?: number;
}

/** One lighting mood as declared in the manifest (numbers only, not yet applied). */
export interface LightPreset {
  /** Editor-facing identifier; unique within a manifest. */
  id: string;
  /** Human-readable label for preset dropdowns. */
  name: string;
  ambient: LightColorSlot;
  hemisphere: HemisphereSlot;
  directional: LightColorSlot;
  /** Up to {@link MAX_LIGHT_POINTS} point slots, applied in rig point order. Frozen in normalized presets. */
  points: readonly LightColorSlot[];
}

export interface LightingPresetManifest {
  presets: LightPreset[];
}

/** Outcome of {@link validateLightingPresets}: an error list, not an exception. */
export interface LightingValidationResult {
  valid: boolean;
  errors: string[];
}

const MANIFEST_FIELDS: ReadonlySet<string> = new Set(['presets']);

const PRESET_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'ambient',
  'hemisphere',
  'directional',
  'points',
]);

const COLOR_SLOT_FIELDS: ReadonlySet<string> = new Set(['intensity', 'color']);

const HEMISPHERE_FIELDS: ReadonlySet<string> = new Set(['intensity', 'skyColor', 'groundColor']);

/**
 * Strict structural check, mirroring EnvManifest.validateEnvManifest(): every
 * field PRESENT must be well-typed and in range, required fields must exist
 * (id, name — the identity fields normalize cannot invent meaningfully), and
 * unknown fields are rejected (manifest, preset AND slot level) so typos in
 * hand-written JSON surface. Light groups are optional — normalizeLightPreset()
 * fills them with intensity 0 / white.
 */
export function validateLightingPresets(input: unknown): LightingValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['manifest must be an object'] };
  }
  for (const key of Object.keys(input)) {
    if (!MANIFEST_FIELDS.has(key)) {
      errors.push(`unknown field "${key}"`);
    }
  }
  if (!('presets' in input)) {
    errors.push('missing required field "presets"');
    return { valid: false, errors };
  }
  if (!Array.isArray(input.presets)) {
    errors.push('field "presets" must be an array');
    return { valid: false, errors };
  }
  const firstSeen = new Map<string, string>();
  input.presets.forEach((entry: unknown, index: number) => {
    validatePreset(entry, `presets[${index}]`, firstSeen, errors);
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Lenient counterpart for a single preset: overlays the well-formed pieces of
 * `input` onto the defaults (every intensity 0, every color
 * {@link DEFAULT_LIGHT_COLOR}, no points), clamps ranges and returns a NEW
 * deeply frozen preset. Identity fields pass through when well-formed —
 * normalize falls back to the placeholder id "lighting", never inventing
 * editor-facing names. Gate real manifests through validateLightingPresets()
 * first.
 */
export function normalizeLightPreset(input: unknown): LightPreset {
  const record = isRecord(input) ? input : {};
  const id = isNonEmptyString(record.id) ? record.id : 'lighting';
  return Object.freeze({
    id,
    name: isNonEmptyString(record.name) ? record.name : id,
    ambient: normalizeColorSlot(record.ambient),
    hemisphere: normalizeHemisphere(record.hemisphere),
    directional: normalizeColorSlot(record.directional),
    points: normalizePoints(record.points),
  });
}

// --- validation internals ---------------------------------------------------

function validatePreset(
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
    if (!PRESET_FIELDS.has(key)) {
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
  // Light groups are optional; anything PRESENT must be well-formed.
  if ('ambient' in entry) {
    validateColorSlot(entry.ambient, `${path}.ambient`, errors);
  }
  if ('hemisphere' in entry) {
    validateHemisphere(entry.hemisphere, `${path}.hemisphere`, errors);
  }
  if ('directional' in entry) {
    validateColorSlot(entry.directional, `${path}.directional`, errors);
  }
  if ('points' in entry) {
    validatePoints(entry.points, path, errors);
  }
}

function validateColorSlot(slot: unknown, path: string, errors: string[]): void {
  if (!isRecord(slot)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of Object.keys(slot)) {
    if (!COLOR_SLOT_FIELDS.has(key)) {
      errors.push(`${path}: unknown field "${key}"`);
    }
  }
  if ('intensity' in slot) {
    checkIntensity(errors, slot.intensity, `${path}.intensity`);
  }
  if ('color' in slot) {
    checkColor(errors, slot.color, `${path}.color`);
  }
}

function validateHemisphere(slot: unknown, path: string, errors: string[]): void {
  if (!isRecord(slot)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const key of Object.keys(slot)) {
    if (!HEMISPHERE_FIELDS.has(key)) {
      errors.push(`${path}: unknown field "${key}"`);
    }
  }
  if ('intensity' in slot) {
    checkIntensity(errors, slot.intensity, `${path}.intensity`);
  }
  if ('skyColor' in slot) {
    checkColor(errors, slot.skyColor, `${path}.skyColor`);
  }
  if ('groundColor' in slot) {
    checkColor(errors, slot.groundColor, `${path}.groundColor`);
  }
}

function validatePoints(points: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(points)) {
    errors.push(`${path}.points must be an array`);
    return;
  }
  if (points.length > MAX_LIGHT_POINTS) {
    errors.push(
      `${path}.points must hold at most ${MAX_LIGHT_POINTS} point entries, got ${points.length}`,
    );
  }
  points.forEach((slot: unknown, index: number) => {
    validateColorSlot(slot, `${path}.points[${index}]`, errors);
  });
}

function checkIntensity(errors: string[], value: unknown, path: string): void {
  if (!isFiniteNumber(value) || value < 0) {
    errors.push(`${path} must be a finite number >= 0, got ${stringifyValue(value)}`);
  }
}

function checkColor(errors: string[], value: unknown, path: string): void {
  if (!isHexColor(value)) {
    errors.push(
      `${path} must be an integer hex color in [0x000000, 0xffffff], got ${stringifyValue(value)}`,
    );
  }
}

// --- normalize internals ------------------------------------------------------

function normalizeColorSlot(slot: unknown): LightColorSlot {
  const record = isRecord(slot) ? slot : {};
  return Object.freeze({
    intensity: Math.max(0, pickNumber(record.intensity) ?? 0),
    color: pickColor(record.color) ?? DEFAULT_LIGHT_COLOR,
  });
}

function normalizeHemisphere(slot: unknown): HemisphereSlot {
  const record = isRecord(slot) ? slot : {};
  return Object.freeze({
    intensity: Math.max(0, pickNumber(record.intensity) ?? 0),
    skyColor: pickColor(record.skyColor) ?? DEFAULT_LIGHT_COLOR,
    groundColor: pickColor(record.groundColor) ?? DEFAULT_LIGHT_COLOR,
  });
}

function normalizePoints(points: unknown): readonly LightColorSlot[] {
  if (!Array.isArray(points)) {
    return [];
  }
  return Object.freeze(
    points.slice(0, MAX_LIGHT_POINTS).map((slot: unknown) => normalizeColorSlot(slot)),
  );
}

// --- shared small helpers (EnvManifest style) ---------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isHexColor(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0x000000 && value <= 0xffffff;
}

function pickNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function pickColor(value: unknown): number | null {
  return isHexColor(value) ? value : null;
}

/** JSON-style rendering of a found value for error messages ("toon", 2, NaN, null). */
function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
