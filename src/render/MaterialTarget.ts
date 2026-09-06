import * as THREE from 'three';
import type { MaterialDefinition, MaterialShading } from '../assets/MaterialDefinition';
import type { MaterialEditorTarget } from '../editor/MaterialEditor';
import { applyUpdate, compile, type TextureResolver } from './MaterialCompiler';

/** Everything the target needs, injected — no scene ownership. */
export interface MaterialTargetDeps {
  /**
   * FRESH lookup on every {@link MaterialTarget.applyDefinition} call:
   * meshes are replaced behind this target's back (viewer shape/model
   * swaps detach and rebuild slot roots), so references must never be
   * cached across applies.
   */
  meshes: () => THREE.Mesh[];
  /** Editor-side texture lookup; null means "slot cannot be served". */
  resolver: TextureResolver;
}

/**
 * What one applyDefinition did — 'recompiled' means at least one mesh
 * crossed the shading boundary (wave-C review nit #8): the material CLASS
 * is fixed at compile() time, so a shading switch is necessarily a
 * dispose + fresh compile + `mesh.material` swap, not an in-place update.
 */
export interface ApplyOutcome {
  applied: 'updated' | 'recompiled';
}

/**
 * MaterialTarget — the bridge from MaterialEditor's applyDefinition(def)
 * to actual meshes (Phase 3, Wave E1a).
 *
 * Implements {@link MaterialEditorTarget} (type-only dependency — the
 * panel and the bridge share a contract, not a runtime link): per mesh,
 * a def whose shading matches the material's class routes through
 * MaterialCompiler.applyUpdate (same instance, slider-cheap, no program
 * recompiles beyond the necessary ones); a def from the OTHER shading
 * model recompiles — the old material is disposed and `mesh.material` is
 * swapped for a fresh compile(), the caller-visible recompile.
 *
 * Ownership (the viewer's slot invariant): every material attached to a
 * looked-up mesh is viewer-created and therefore safe to dispose when
 * replaced. Materials this target CREATES by recompiling are handed to
 * the mesh — ownership transfers to the viewer. {@link dispose} owns
 * nothing and frees nothing by design.
 */
export class MaterialTarget implements MaterialEditorTarget {
  private readonly meshes: () => THREE.Mesh[];
  private readonly resolver: TextureResolver;

  constructor(deps: MaterialTargetDeps) {
    this.meshes = deps.meshes;
    this.resolver = deps.resolver;
  }

  /**
   * Apply `def` to every current mesh: in-place update when the material
   * class matches the def's shading, recompile (dispose + swap) when it
   * doesn't. An empty mesh set is a no-op reporting 'updated' — nothing
   * crossed the boundary.
   */
  applyDefinition(def: MaterialDefinition): ApplyOutcome {
    let recompiled = false;
    for (const mesh of this.meshes()) {
      const current = mesh.material;
      if (!Array.isArray(current) && shadingMatches(current, def.shading)) {
        applyUpdate(current, def, this.resolver);
        continue;
      }
      // Shading mismatch (or a material group — viewer slots never carry
      // one, but a fresh lookup can surface anything): replace wholesale.
      if (Array.isArray(current)) {
        for (const entry of current) {
          entry.dispose();
        }
      } else {
        current.dispose();
      }
      mesh.material = compile(def, this.resolver);
      recompiled = true;
    }
    return { applied: recompiled ? 'recompiled' : 'updated' };
  }

  /**
   * Deliberately empty: this target owns NO resources. The meshes (and
   * the materials attached to them, including ones it compiled and handed
   * over) belong to the viewer — their lifetime is the viewer's dispose.
   */
  dispose(): void {
    /* nothing owned — see class doc */
  }
}

/** Does `material`'s class implement `shading`? (the two compiler classes) */
function shadingMatches(
  material: THREE.Material,
  shading: MaterialShading,
): material is THREE.MeshStandardMaterial | THREE.MeshPhongMaterial {
  return shading === 'standard'
    ? material instanceof THREE.MeshStandardMaterial
    : material instanceof THREE.MeshPhongMaterial;
}
