import * as THREE from 'three';
import type { MaterialDefinition, MaterialMapSource } from '../assets/MaterialDefinition';

/**
 * MaterialCompiler — MaterialDefinition (pure JSON data) → THREE material.
 *
 * Phase 3 wave C1: compiles the declarative model from src/assets into a
 * live material, plus the editor's in-place update path. Supersedes the
 * ROLE of MaterialPresets (Phase 1's TextureSet factory, kept untouched
 * until wave E rewires the viewer onto definitions).
 *
 * Texture resolution is INJECTED: the compiler never loads anything. The
 * resolver answers per source; null means "this slot cannot be served
 * right now" (not loaded / unknown id) — the slot stays unbound and the
 * definition remains valid. Resolution is a runtime concern; the data
 * model stays renderer-free.
 *
 * UV application (design decision): the transform is applied by setting
 * the four idiomatic THREE.Texture properties — offset / repeat / rotation
 * / center — on EVERY bound texture (one shared UV per definition, the old
 * GUI's UV1 semantics, as in Phase 1). three recomputes each
 * texture.matrix from them at render time (matrixAutoUpdate default),
 * which is entry-for-entry what composeUVMatrix (src/assets/UVTransform.ts)
 * returns — pinned by the contract test, including the row-major
 * Matrix3.set(...) vs column-major fromArray trap.
 *
 * aoMap channel: three reads aoMap from UV channel 1. The compiler does
 * NOT touch texture.channel — textures are resolver-owned and mutating
 * them would leak into every other material binding the same texture.
 * Phase 1 already wires both halves: TextureLibrary sets `channel = 1` on
 * ao textures at load time, and MeshFactory duplicates `uv` into a `uv1`
 * attribute for every primitive geometry.
 */

/**
 * Serves a texture for a map-slot source. Implementations are expected to
 * return a STABLE instance per source (TextureLibrary's loaded sets do):
 * applyUpdate compares slot bindings by identity to decide what changed.
 */
export interface TextureResolver {
  /** null = the slot cannot be served right now — skip it, the def stays valid. */
  resolve(source: MaterialMapSource): THREE.Texture | null;
}

/** What compile() produces — one class per shading model, fixed at compile time. */
export type CompiledMaterial = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;

/**
 * Compile a definition into a FRESH material (standard → MeshStandardMaterial,
 * phong → MeshPhongMaterial). Params, color, map slots and the shared UV
 * transform run through the same code path as applyUpdate, so compiling and
 * updating land in the identical material state.
 *
 * Ownership: the caller owns the result and its lifetime (material.dispose());
 * applyUpdate never reallocates. Wave E wires the editor's lifecycle.
 */
export function compile(def: MaterialDefinition, resolver: TextureResolver): CompiledMaterial {
  const material =
    def.shading === 'standard' ? new THREE.MeshStandardMaterial() : new THREE.MeshPhongMaterial();
  applyUpdate(material, def, resolver);
  return material;
}

/**
 * Update an EXISTING material in place from `def` — the editor slider path.
 * Returns void and never reallocates: material identity is unchanged, so
 * meshes keep their reference and no shader recompiles happen beyond the
 * necessary ones.
 *
 * The shading model is fixed at compile(): params are routed by the
 * material's ACTUAL class (roughness/metalness on standard, shininess on
 * phong). A def whose `shading` no longer matches the material is edited
 * only through what that class supports — switching the model itself is a
 * compile(), not an update.
 *
 * `needsUpdate = true` is set exactly when a map slot was added, removed
 * or rebound to a different texture — the cases where three must rebind
 * shader uniforms. Param/color/UV changes ride the existing program.
 */
export function applyUpdate(
  material: CompiledMaterial,
  def: MaterialDefinition,
  resolver: TextureResolver,
): void {
  applyParams(material, def);
  if (syncMaps(material, def, resolver)) {
    material.needsUpdate = true;
  }
  applyUv(material, def.uv);
}

// --- params -----------------------------------------------------------------

/** Params + color, routed by the material's actual class. */
function applyParams(material: CompiledMaterial, def: MaterialDefinition): void {
  material.color.setHex(def.color);
  material.normalScale.set(def.params.normalScale, def.params.normalScale);
  if (material instanceof THREE.MeshStandardMaterial) {
    material.roughness = def.params.roughness;
    material.metalness = def.params.metalness;
  } else {
    material.shininess = def.params.shininess;
  }
  // Slot extras are ignored by three while their map is null, so writing
  // them unconditionally-from-present-slot keeps compile ≡ applyUpdate.
  if (def.maps.bump) {
    material.bumpScale = def.maps.bump.scale;
  }
  if (def.maps.ao) {
    material.aoMapIntensity = def.maps.ao.intensity;
  }
  if (def.maps.displacement) {
    material.displacementScale = def.maps.displacement.scale;
  }
}

// --- map slots ---------------------------------------------------------------

const SHARED_SLOTS = ['map', 'normalMap', 'bumpMap', 'aoMap', 'displacementMap'] as const;
type SharedSlot = (typeof SHARED_SLOTS)[number];

/**
 * The map slots BOTH shading models expose with identical shape —
 * MeshStandardMaterial and MeshPhongMaterial each satisfy this
 * structurally, keeping the sync/UV loops below cast-free. roughnessMap
 * is standard-only and lives on the narrowed MeshStandardMaterial branch.
 */
type SharedMapSlots = Record<SharedSlot, THREE.Texture | null>;

/** Bind/unbind map slots by identity; true when the slot set changed. */
function syncMaps(
  material: CompiledMaterial,
  def: MaterialDefinition,
  resolver: TextureResolver,
): boolean {
  const slots: SharedMapSlots = material;
  const normal = def.maps.normal;
  let changed = false;
  changed = setSlot(slots, 'map', resolveTexture(def.maps.baseColor, resolver)) || changed;
  changed =
    setSlot(
      slots,
      'normalMap',
      normal && normal.enabled ? resolveTexture(normal, resolver) : null,
    ) || changed;
  changed = setSlot(slots, 'bumpMap', resolveTexture(def.maps.bump, resolver)) || changed;
  changed = setSlot(slots, 'aoMap', resolveTexture(def.maps.ao, resolver)) || changed;
  changed = setSlot(slots, 'displacementMap', resolveTexture(def.maps.displacement, resolver)) || changed;
  if (material instanceof THREE.MeshStandardMaterial) {
    changed = setRoughnessSlot(material, resolveTexture(def.maps.roughness, resolver)) || changed;
  }
  return changed;
}

/** Identity-compare and assign a shared slot; true when the binding changed. */
function setSlot(slots: SharedMapSlots, prop: SharedSlot, next: THREE.Texture | null): boolean {
  if (slots[prop] === next) {
    return false;
  }
  slots[prop] = next;
  return true;
}

/** Standard-only counterpart of {@link setSlot} for roughnessMap. */
function setRoughnessSlot(
  material: THREE.MeshStandardMaterial,
  next: THREE.Texture | null,
): boolean {
  if (material.roughnessMap === next) {
    return false;
  }
  material.roughnessMap = next;
  return true;
}

/** Texture for a present slot, or null when the slot is absent. */
function resolveTexture(
  slot: { source: MaterialMapSource } | undefined,
  resolver: TextureResolver,
): THREE.Texture | null {
  return slot ? resolver.resolve(slot.source) : null;
}

// --- shared UV transform ------------------------------------------------------

/** The `uv` block of a definition. */
type MatUv = MaterialDefinition['uv'];

/** Refresh the shared UV on every currently bound texture (no flags — texture.matrix rides the existing program). */
function applyUv(material: CompiledMaterial, uv: MatUv): void {
  const slots: SharedMapSlots = material;
  for (const prop of SHARED_SLOTS) {
    const bound = slots[prop];
    if (bound) {
      applyUvToTexture(bound, uv);
    }
  }
  if (material instanceof THREE.MeshStandardMaterial && material.roughnessMap) {
    applyUvToTexture(material.roughnessMap, uv);
  }
}

/** Idiomatic route: set the four Texture properties; three recomputes texture.matrix. */
function applyUvToTexture(texture: THREE.Texture, uv: MatUv): void {
  texture.offset.set(uv.offset[0], uv.offset[1]);
  texture.repeat.set(uv.repeat[0], uv.repeat[1]);
  texture.rotation = uv.rotation;
  texture.center.set(uv.center[0], uv.center[1]);
}
