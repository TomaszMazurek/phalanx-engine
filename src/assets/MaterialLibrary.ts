/**
 * MaterialLibrary — JSON I/O for MaterialDefinition (pure data transforms).
 *
 * No AssetManager involvement on purpose: serialize/deserialize are
 * synchronous and touch no network. The editor's file plumbing (Blob
 * download, FileReader) is a later wave — this module only guarantees the
 * BYTES are stable: canonical field order for git-friendly exports and
 * byte-identical round-trips.
 */

import { normalize, validate, type MaterialDefinition } from './MaterialDefinition';

/** Result of {@link deserializeMaterial}: either a normalized def or the collected errors. */
export interface DeserializedMaterial {
  valid: boolean;
  errors: string[];
  def?: MaterialDefinition;
}

/**
 * Serialize a definition with a CANONICAL key order (schema order at every
 * nesting level), so exports are deterministic and diff-friendly. The
 * content is written as-is: serialize does not validate or fill defaults —
 * normalize first for stable round-trips. Unset map slots are omitted.
 *
 * Map slots are rebuilt canonically: only the schema's slot fields (source
 * + the slot's extra) are emitted, and deserialize (via normalize) drops
 * unknown nested keys inside a slot the same way — a slot never carries
 * anything the schema does not know about (wave-A decision).
 */
export function serializeMaterial(def: MaterialDefinition): string {
  return JSON.stringify({
    version: def.version,
    id: def.id,
    shading: def.shading,
    color: def.color,
    params: {
      roughness: def.params.roughness,
      metalness: def.params.metalness,
      shininess: def.params.shininess,
      normalScale: def.params.normalScale,
    },
    uv: {
      repeat: def.uv.repeat,
      offset: def.uv.offset,
      rotation: def.uv.rotation,
      center: def.uv.center,
    },
    maps: {
      baseColor: def.maps.baseColor && { source: def.maps.baseColor.source },
      normal: def.maps.normal && { source: def.maps.normal.source, enabled: def.maps.normal.enabled },
      bump: def.maps.bump && { source: def.maps.bump.source, scale: def.maps.bump.scale },
      roughness: def.maps.roughness && { source: def.maps.roughness.source },
      ao: def.maps.ao && { source: def.maps.ao.source, intensity: def.maps.ao.intensity },
      displacement:
        def.maps.displacement && {
          source: def.maps.displacement.source,
          scale: def.maps.displacement.scale,
        },
    },
  });
}

/**
 * Parse a JSON string into a definition. Never throws: malformed JSON,
 * non-objects, unsupported versions and schema violations all come back as
 * `errors` (the editor shows them next to the import). A valid parse is
 * normalized — defaults filled, ranges clamped, result frozen.
 *
 * Versioning stub: a wrong `version` short-circuits with a single
 * "unsupported version" error (no schema-error cascade — a future
 * version's fields are not judged by v1 rules). Migration hooks land here
 * when schema v2 exists. A MISSING version falls through to validate()
 * for the precise "missing required field" message.
 */
export function deserializeMaterial(text: string): DeserializedMaterial {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { valid: false, errors: [`invalid JSON: ${String(error)}`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['definition must be a JSON object'] };
  }
  if ('version' in parsed && parsed.version !== 1) {
    return {
      valid: false,
      errors: [`unsupported version: ${JSON.stringify(parsed.version)} (expected 1)`],
    };
  }
  const { valid, errors } = validate(parsed);
  if (!valid) {
    return { valid, errors };
  }
  return { valid: true, errors: [], def: normalize(parsed) };
}
