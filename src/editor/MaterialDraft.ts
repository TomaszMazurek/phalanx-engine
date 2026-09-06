/**
 * MaterialDraft — the editor's mutable working copy of a MaterialDefinition
 * (Phase 3, Wave C2).
 *
 * Normalized definitions are FROZEN (MaterialDefinition data policy), so a
 * live GUI cannot edit them in place. A draft is a deep UNFROZEN clone
 * (see {@link unfreeze}) wrapped in typed setters that (a) keep the source
 * definition untouchable, (b) mark the draft dirty and notify subscribers
 * EventBus-style on every mutation — the editor's live-apply pipeline hangs
 * off that subscription.
 *
 * Drafts CAN be mid-edit invalid (e.g. repeat [1, 0], a cleared id): the
 * setters are unguarded by design so the GUI never has to fight them.
 * {@link MaterialDraft.toDefinition} therefore returns `{ def?, errors }`:
 * a def only when the working copy passes validate(). Live apply uses the
 * LAST-KNOWN-GOOD def — the most recent valid one the target received —
 * and simply skips the update (with a status message) while invalid.
 *
 * Pure module: no three.js, no DOM. The file plumbing (Blob download,
 * FileReader) lives in MaterialEditor; the pure halves of that flow are
 * {@link exportDefinition} and {@link importDefinition} below, so the
 * data transform itself stays unit-tested (see MaterialDraft.test.ts).
 */

import { normalize, validate, type MaterialDefinition } from '../assets/MaterialDefinition';
import {
  deserializeMaterial,
  serializeMaterial,
} from '../assets/MaterialLibrary';
import type {
  AoMap,
  BumpMap,
  DisplacementMap,
  MaterialDefinitionMaps,
  MaterialMapSource,
  MaterialParams,
  MaterialShading,
  MaterialUv,
  NormalMap,
} from '../assets/MaterialDefinition';

/** All map slots of a definition. */
export type MaterialMapSlot = keyof MaterialDefinitionMaps;

/** Successful export payload: what to download — plus the validated def
 * itself, so callers (MaterialEditor.exportJson) reuse THIS result instead
 * of running a second toDefinition() round-trip. */
export interface ExportPayload {
  filename: string;
  json: string;
  def: MaterialDefinition;
}

/** Outcome of {@link MaterialDraft.toDefinition}: a def only when valid. */
export interface DraftValidationResult {
  valid: boolean;
  errors: string[];
  def?: MaterialDefinition;
}

/** Outcome of {@link importDefinition}: errors are empty iff imported. */
export interface ImportResult {
  valid: boolean;
  errors: string[];
}

/** Deep-clone a definition WITHOUT its frozenness (structuredClone drops
 * integrity levels), so the copy is safe to mutate. Always a fresh tree —
 * the source is neither mutated nor aliased. */
export function unfreeze(def: MaterialDefinition): MaterialDefinition {
  return structuredClone(def);
}

/** Deep copy of the maps block with fresh slot and source objects. */
function cloneMaps(maps: MaterialDefinitionMaps): MaterialDefinitionMaps {
  const out: MaterialDefinitionMaps = {};
  for (const [slot, entry] of Object.entries(maps) as [MaterialMapSlot, unknown][]) {
    if (entry === undefined) {
      continue;
    }
    const source = (entry as { source: MaterialMapSource }).source;
    Object.assign(out, { [slot]: { ...(entry as object), source: { ...source } } });
  }
  return out;
}

/**
 * Mutable working copy of a definition. Getters return defensive copies —
 * the only way in is the setter surface, so every change notifies. Setters
 * return the draft for chaining.
 */
export class MaterialDraft {
  private def: MaterialDefinition;
  private dirtyFlag = false;
  private readonly listeners = new Set<() => void>();

  constructor(source: MaterialDefinition) {
    this.def = unfreeze(source);
  }

  // --- identity -----------------------------------------------------------

  get id(): string {
    return this.def.id;
  }

  setId(id: string): this {
    this.def.id = id;
    return this.changed();
  }

  get shading(): MaterialShading {
    return this.def.shading;
  }

  setShading(shading: MaterialShading): this {
    this.def.shading = shading;
    return this.changed();
  }

  get color(): number {
    return this.def.color;
  }

  setColor(color: number): this {
    this.def.color = color;
    return this.changed();
  }

  // --- params & uv ----------------------------------------------------------

  get params(): Readonly<MaterialParams> {
    return { ...this.def.params };
  }

  setParam<K extends keyof MaterialParams>(key: K, value: MaterialParams[K]): this {
    this.def.params[key] = value;
    return this.changed();
  }

  get uv(): Readonly<MaterialUv> {
    return {
      repeat: [...this.def.uv.repeat],
      offset: [...this.def.uv.offset],
      rotation: this.def.uv.rotation,
      center: [...this.def.uv.center],
    };
  }

  /** Set one component of a uv pair: `setUvComponent('repeat', 0, 2)`. */
  setUvComponent(key: 'repeat' | 'offset' | 'center', axis: 0 | 1, value: number): this {
    this.def.uv[key][axis] = value;
    return this.changed();
  }

  setUvRotation(rotation: number): this {
    this.def.uv.rotation = rotation;
    return this.changed();
  }

  // --- map slots -------------------------------------------------------------

  get maps(): Readonly<MaterialDefinitionMaps> {
    return cloneMaps(this.def.maps);
  }

  /**
   * Set a slot's source, or remove the slot entirely (`source === null`).
   * Slot extras (enabled/scale/intensity) are preserved when present;
   * creating a fresh slot leaves them absent — schema defaults apply at
   * normalize time.
   */
  setMapSlot(slot: MaterialMapSlot, source: MaterialMapSource | null): this {
    if (source === null) {
      delete this.def.maps[slot];
    } else {
      const existing = this.def.maps[slot] as Record<string, unknown> | undefined;
      this.def.maps[slot] = existing ? ({ ...existing, source } as never) : ({ source } as never);
    }
    return this.changed();
  }

  /**
   * Slot-extra setters. No-ops while their slot is absent: an extra without
   * a source would be an invalid definition, and the GUI never shows extras
   * for an unbound slot. No notification, no dirty flag — nothing changed.
   */
  setMapNormalEnabled(enabled: boolean): this {
    if (this.def.maps.normal) {
      (this.def.maps.normal as NormalMap).enabled = enabled;
      return this.changed();
    }
    return this;
  }

  setMapBumpScale(scale: number): this {
    if (this.def.maps.bump) {
      (this.def.maps.bump as BumpMap).scale = scale;
      return this.changed();
    }
    return this;
  }

  setMapAoIntensity(intensity: number): this {
    if (this.def.maps.ao) {
      (this.def.maps.ao as AoMap).intensity = intensity;
      return this.changed();
    }
    return this;
  }

  setMapDisplacementScale(scale: number): this {
    if (this.def.maps.displacement) {
      (this.def.maps.displacement as DisplacementMap).scale = scale;
      return this.changed();
    }
    return this;
  }

  // --- change tracking ---------------------------------------------------------

  get dirty(): boolean {
    return this.dirtyFlag;
  }

  /** Mark the working copy as applied. The editor's live-apply pipeline
   * calls this after a valid def has been pushed to the target, so dirty
   * reads as "has changes the target has NOT seen" — mid-edit invalid
   * states stay dirty (they are never applied). */
  clearDirty(): void {
    this.dirtyFlag = false;
  }

  /** Subscribe to every mutation. Returns an idempotent unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- definition materialization ---------------------------------------------

  /**
   * Validate the working copy and, when valid, normalize it into a NEW
   * frozen definition. Mid-edit invalid states yield `valid: false` plus
   * the collected errors — never a patched-up def (that would silently
   * diverge the applied material from what the artist sees on screen).
   */
  toDefinition(): DraftValidationResult {
    const { valid, errors } = validate(this.def);
    if (!valid) {
      return { valid, errors };
    }
    return { valid: true, errors: [], def: normalize(this.def) };
  }

  /**
   * Swap the whole working copy for a deep clone of `source` (used by
   * import). One notification, marks dirty — the editor rebuilds its
   * controls from the getters afterwards.
   */
  replace(source: MaterialDefinition): this {
    this.def = unfreeze(source);
    return this.changed();
  }

  /** Shared tail of every mutating setter. */
  private changed(): this {
    this.dirtyFlag = true;
    for (const listener of [...this.listeners]) {
      listener();
    }
    return this;
  }
}

/**
 * Pure half of the File → Export flow: serialize the draft when valid.
 * The download itself (Blob + URL.createObjectURL) is MaterialEditor's
 * DOM concern; this function only decides the bytes and the file name
 * (`${id}.json`), or reports why export must be blocked.
 */
export function exportDefinition(draft: MaterialDraft): ExportPayload | { errors: string[] } {
  const { valid, errors, def } = draft.toDefinition();
  if (!valid || !def) {
    return { errors };
  }
  return { filename: `${def.id}.json`, json: serializeMaterial(def), def };
}

/**
 * Pure half of the File → Import flow: parse and (when valid) replace the
 * draft's content, firing its change notification. Invalid input leaves
 * the draft untouched and reports errors — the editor shows them in the
 * status line instead of throwing.
 */
export function importDefinition(draft: MaterialDraft, text: string): ImportResult {
  const { valid, errors, def } = deserializeMaterial(text);
  if (!valid || !def) {
    return { valid: false, errors };
  }
  draft.replace(def);
  return { valid: true, errors: [] };
}
