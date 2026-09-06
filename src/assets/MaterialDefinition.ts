/**
 * MaterialDefinition — declarative, versioned material model (pure data).
 *
 * Continuation of the Phase 1 manifest pattern: a material is JSON, so the
 * Phase 5 editor gets file I/O for free. No three.js imports here (ESLint
 * boundary: src/assets stays renderer-agnostic); textures are referenced
 * BY ID from the texture manifest or BY URI, never loaded eagerly.
 *
 * Data policy (see normalize/validate):
 * - validate() collects errors instead of throwing — the editor displays
 *   them next to the offending control.
 * - normalize() is lenient: it fills defaults, clamps ranges and ALWAYS
 *   returns a definition that passes validate(). Invalid pieces revert to
 *   defaults rather than aborting, because it builds editor drafts.
 * - Compiled/normalized definitions are FROZEN; the editor edits a mutable
 *   copy (e.g. `structuredClone(def)`, which drops frozenness) and
 *   re-normalizes on save.
 */

/** Shading model; `standard` = MeshStandardMaterial (PBR), `phong` = legacy cheap shading. */
export type MaterialShading = 'standard' | 'phong';

/** How a map slot finds its texture: a manifest texture-set id OR a direct URI. */
export type MaterialMapSource = { textureSetId: string } | { uri: string };

export interface MaterialMap {
  source: MaterialMapSource;
}

export interface NormalMap {
  source: MaterialMapSource;
  enabled: boolean;
}

export interface BumpMap {
  source: MaterialMapSource;
  scale: number;
}

export interface RoughnessMap {
  source: MaterialMapSource;
}

export interface AoMap {
  source: MaterialMapSource;
  intensity: number;
}

export interface DisplacementMap {
  source: MaterialMapSource;
  scale: number;
}

/**
 * Optional map slots; unknown slot names are ignored (the strict
 * unknown-field policy applies to TOP-LEVEL fields only).
 */
export interface MaterialDefinitionMaps {
  baseColor?: MaterialMap;
  normal?: NormalMap;
  bump?: BumpMap;
  roughness?: RoughnessMap;
  ao?: AoMap;
  displacement?: DisplacementMap;
}

export interface MaterialParams {
  /** Surface roughness for `standard` shading, clamped to [0, 1]. */
  roughness: number;
  /** Metalness for `standard` shading, clamped to [0, 1]. */
  metalness: number;
  /** Phong highlight sharpness for `phong` shading, >= 0. */
  shininess: number;
  /** Strength of the normal map effect, >= 0. */
  normalScale: number;
}

/**
 * UV transform applied to every data/color map, matching the old GUI's
 * UV1 semantics. `center` is the rotation pivot.
 */
export interface MaterialUv {
  repeat: [number, number];
  offset: [number, number];
  rotation: number;
  center: [number, number];
}

export interface MaterialDefinition {
  version: 1;
  /** Editor-facing identifier; also the export file name (`${id}.json`). */
  id: string;
  shading: MaterialShading;
  /** Fallback diffuse color as a 0xRRGGBB literal (three materials treat color as RGB). */
  color: number;
  params: MaterialParams;
  uv: MaterialUv;
  maps: MaterialDefinitionMaps;
}

/** Outcome of {@link validate}: an error list, not an exception. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SHADING_MODES: readonly MaterialShading[] = ['standard', 'phong'];

const TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  'version',
  'id',
  'shading',
  'color',
  'params',
  'uv',
  'maps',
]);

/**
 * Slot-specific field (besides `source`) each map slot may carry, and how
 * normalize defaults it when absent/invalid. Single source of truth for
 * both validate() and normalize().
 */
const MAP_SLOT_EXTRAS = {
  baseColor: undefined,
  normal: { key: 'enabled', kind: 'boolean', fallback: true },
  bump: { key: 'scale', kind: 'finiteNumber', fallback: 1 },
  roughness: undefined,
  ao: { key: 'intensity', kind: 'finiteNumber', fallback: 1 },
  displacement: { key: 'scale', kind: 'finiteNumber', fallback: 1 },
} as const;

/**
 * Fresh baseline definition — a FACTORY, so callers never share mutable
 * state. Defaults mirror three's out-of-the-box material look: white,
 * mostly rough, non-metal, identity UVs.
 *
 * UV `center` defaults to [0.5, 0.5] — rotation around the texel center,
 * exactly like the old GUI — rather than [0, 0]: pivoting on the UV
 * square's corner swings the whole surface, which is never what an artist
 * wants. The plan left this open; this is the documented choice.
 */
export function DEFAULT_MATERIAL_DEFINITION(): MaterialDefinition {
  return freezeDefinition({
    version: 1,
    id: 'material',
    shading: 'standard',
    color: 0xffffff,
    params: { roughness: 0.8, metalness: 0, shininess: 30, normalScale: 1 },
    uv: { repeat: [1, 1], offset: [0, 0], rotation: 0, center: [0.5, 0.5] },
    maps: {},
  });
}

/**
 * Strict structural check. Missing `params`/`uv`/`maps` containers are OK
 * (normalize() fills them); everything PRESENT must be well-typed and in
 * range. Unknown TOP-LEVEL fields are rejected — strict on purpose, so a
 * typo in hand-written JSON surfaces instead of being silently dropped.
 * Unknown nested keys (inside params/uv/maps/slots) are ignored.
 */
export function validate(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, errors: ['definition must be an object'] };
  }
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      errors.push(`unknown field "${key}"`);
    }
  }
  if (!('version' in input)) {
    errors.push('missing required field "version"');
  } else if (input.version !== 1) {
    errors.push(`unsupported version: ${stringifyValue(input.version)} (expected 1)`);
  }
  if (!('id' in input)) {
    errors.push('missing required field "id"');
  } else if (!isNonEmptyString(input.id)) {
    errors.push(`field "id" must be a non-empty string, got ${stringifyValue(input.id)}`);
  }
  if (!('shading' in input)) {
    errors.push('missing required field "shading"');
  } else if (!isShading(input.shading)) {
    errors.push(
      `field "shading" must be one of: ${SHADING_MODES.join(', ')}, got ${stringifyValue(input.shading)}`,
    );
  }
  if (!('color' in input)) {
    errors.push('missing required field "color"');
  } else if (!isFiniteNumber(input.color)) {
    errors.push(`field "color" must be a finite number, got ${stringifyValue(input.color)}`);
  }
  if ('params' in input) {
    validateParams(input.params, errors);
  }
  if ('uv' in input) {
    validateUv(input.uv, errors);
  }
  if ('maps' in input) {
    validateMaps(input.maps, errors);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Lenient counterpart to validate(): overlays every well-formed piece of
 * `input` onto the defaults, clamps out-of-range numbers, drops malformed
 * map slots and returns a NEW frozen definition — the input is never
 * mutated or aliased (all nested values are fresh copies).
 *
 * Invariant: the result always passes validate(), for any input.
 */
export function normalize(input: unknown): MaterialDefinition {
  const record = isRecord(input) ? input : {};
  const base = DEFAULT_MATERIAL_DEFINITION();
  const params = isRecord(record.params) ? record.params : {};
  const uv = isRecord(record.uv) ? record.uv : {};
  return freezeDefinition({
    version: 1,
    id: isNonEmptyString(record.id) ? record.id : base.id,
    shading: isShading(record.shading) ? record.shading : base.shading,
    color: isFiniteNumber(record.color) ? record.color : base.color,
    params: {
      roughness: clamp(pickNumber(params.roughness) ?? base.params.roughness, 0, 1),
      metalness: clamp(pickNumber(params.metalness) ?? base.params.metalness, 0, 1),
      shininess: Math.max(0, pickNumber(params.shininess) ?? base.params.shininess),
      normalScale: Math.max(0, pickNumber(params.normalScale) ?? base.params.normalScale),
    },
    uv: {
      repeat: normalizeRepeat(uv.repeat, base.uv.repeat),
      offset: pickFinitePair(uv.offset) ?? [...base.uv.offset],
      rotation: pickNumber(uv.rotation) ?? base.uv.rotation,
      center: pickFinitePair(uv.center) ?? [...base.uv.center],
    },
    maps: normalizeMaps(record.maps),
  });
}

// --- validation internals -------------------------------------------------

function validateParams(params: unknown, errors: string[]): void {
  if (!isRecord(params)) {
    errors.push(`field "params" must be an object, got ${stringifyValue(params)}`);
    return;
  }
  checkNumber(errors, params.roughness, 'params.roughness', 'a finite number in [0, 1]', (n) =>
    n >= 0 && n <= 1,
  );
  checkNumber(errors, params.metalness, 'params.metalness', 'a finite number in [0, 1]', (n) =>
    n >= 0 && n <= 1,
  );
  checkNumber(errors, params.shininess, 'params.shininess', 'a finite number >= 0', (n) => n >= 0);
  checkNumber(errors, params.normalScale, 'params.normalScale', 'a finite number >= 0', (n) =>
    n >= 0,
  );
}

function validateUv(uv: unknown, errors: string[]): void {
  if (!isRecord(uv)) {
    errors.push(`field "uv" must be an object, got ${stringifyValue(uv)}`);
    return;
  }
  checkTuple(errors, uv.repeat, 'uv.repeat');
  if (isFinitePair(uv.repeat) && (uv.repeat[0] === 0 || uv.repeat[1] === 0)) {
    errors.push('uv.repeat must not be zero (degenerate UV tiling)');
  }
  checkTuple(errors, uv.offset, 'uv.offset');
  checkNumber(errors, uv.rotation, 'uv.rotation', 'a finite number', () => true);
  checkTuple(errors, uv.center, 'uv.center');
}

function validateMaps(maps: unknown, errors: string[]): void {
  if (!isRecord(maps)) {
    errors.push(`field "maps" must be an object, got ${stringifyValue(maps)}`);
    return;
  }
  for (const [slot, extra] of Object.entries(MAP_SLOT_EXTRAS)) {
    const entry = maps[slot];
    if (entry === undefined) {
      continue; // optional slot
    }
    if (!isRecord(entry)) {
      errors.push(`maps.${slot} must be an object`);
      continue;
    }
    checkSource(entry.source, `maps.${slot}.source`, errors);
    if (extra && extra.key in entry) {
      const value = entry[extra.key];
      if (extra.kind === 'boolean' && typeof value !== 'boolean') {
        errors.push(`maps.${slot}.${extra.key} must be a boolean`);
      }
      if (extra.kind === 'finiteNumber' && !isFiniteNumber(value)) {
        errors.push(`maps.${slot}.${extra.key} must be a finite number`);
      }
    }
  }
}

function checkSource(source: unknown, path: string, errors: string[]): void {
  if (!isRecord(source)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const hasSet = 'textureSetId' in source;
  const hasUri = 'uri' in source;
  if (hasSet === hasUri) {
    errors.push(`${path} must specify exactly one of "textureSetId" or "uri"`);
    return;
  }
  if (hasSet && !isNonEmptyString(source.textureSetId)) {
    errors.push(`${path}.textureSetId must be a non-empty string`);
  }
  if (hasUri && !isNonEmptyString(source.uri)) {
    errors.push(`${path}.uri must be a non-empty string`);
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

function checkTuple(errors: string[], value: unknown, path: string): void {
  if (!isFinitePair(value)) {
    errors.push(`${path} must be a tuple of two finite numbers`);
  }
}

// --- normalize internals --------------------------------------------------

/** A zero repeat component collapses the UVs — reset the whole tuple, don't half-patch it. */
function normalizeRepeat(value: unknown, fallback: [number, number]): [number, number] {
  const pair = pickFinitePair(value);
  if (!pair || pair[0] === 0 || pair[1] === 0) {
    return [...fallback];
  }
  return pair;
}

function normalizeMaps(maps: unknown): MaterialDefinitionMaps {
  const record = isRecord(maps) ? maps : {};
  const out: MaterialDefinitionMaps = {};
  for (const [slot, extra] of Object.entries(MAP_SLOT_EXTRAS)) {
    const entry = record[slot];
    if (!isRecord(entry)) {
      continue; // absent or malformed → slot dropped, not guessed
    }
    const source = readSource(entry.source);
    if (!source) {
      continue;
    }
    const slotOut: Record<string, unknown> = { source };
    if (extra) {
      const value = entry[extra.key];
      slotOut[extra.key] =
        extra.kind === 'boolean'
          ? typeof value === 'boolean'
            ? value
            : extra.fallback
          : isFiniteNumber(value)
            ? value
            : extra.fallback;
    }
    Object.assign(out, { [slot]: slotOut });
  }
  return out;
}

/** Validated fresh copy of a map source, or null when malformed. */
function readSource(source: unknown): MaterialMapSource | null {
  if (!isRecord(source)) {
    return null;
  }
  const hasSet = 'textureSetId' in source;
  if (hasSet === ('uri' in source)) {
    return null; // both or neither
  }
  if (hasSet) {
    return isNonEmptyString(source.textureSetId) ? { textureSetId: source.textureSetId } : null;
  }
  return isNonEmptyString(source.uri) ? { uri: source.uri } : null;
}

/**
 * Freeze the definition and every nested object/tuple — all freshly
 * allocated by normalize/DEFAULT_MATERIAL_DEFINITION, never user input.
 * Deliberately not a general deep-freeze: the schema is fixed and shallow,
 * so an explicit walk suffices. Draft copies made by the editor (e.g.
 * structuredClone) are unfrozen; everything compiled from a definition is
 * frozen, so a draft edit can never leak into a shared definition.
 */
function freezeDefinition(def: MaterialDefinition): MaterialDefinition {
  Object.freeze(def.params);
  Object.freeze(def.uv.repeat);
  Object.freeze(def.uv.offset);
  Object.freeze(def.uv.center);
  Object.freeze(def.uv);
  for (const slot of Object.values(def.maps)) {
    if (slot) {
      Object.freeze(slot.source);
      Object.freeze(slot);
    }
  }
  Object.freeze(def.maps);
  return Object.freeze(def);
}

// --- shared small helpers ---------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFinitePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) && value.length === 2 && isFiniteNumber(value[0]) && isFiniteNumber(value[1])
  );
}

function isShading(value: unknown): value is MaterialShading {
  return typeof value === 'string' && (SHADING_MODES as readonly string[]).includes(value);
}

function pickNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

/** Fresh [a, b] copy of a finite pair, or null. */
function pickFinitePair(value: unknown): [number, number] | null {
  return isFinitePair(value) ? [value[0], value[1]] : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** JSON-style rendering of a found value for error messages ("toon", 2, NaN, null). */
function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
