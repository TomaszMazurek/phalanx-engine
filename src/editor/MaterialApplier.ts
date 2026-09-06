/**
 * MaterialApplier — last-known-good apply state for the editor's live-apply
 * pipeline (Phase 3, Wave E fix).
 *
 * WHY THIS EXISTS: the viewer rebuilds its slot materials behind the
 * editor's back (texture swap, normal-map toggle, model swap — fresh preset
 * materials are installed every time), which silently WIPES the edited
 * material until the next draft change re-applies it. The fix is a
 * re-apply path: remember the most recent def the target received and push
 * it again after every slot rebuild.
 *
 * Headless half of MaterialEditor's pipeline, by the same split as the
 * file flows (export/import live in MaterialDraft.ts): the panel is
 * DOM-bound (lil-gui) and cannot be constructed in the node test env, so
 * the state machine lives here — pure, no GUI, no draft reference (reapply
 * therefore CANNOT mutate the draft or its dirty flag; only a valid
 * toDefinition() result is ever handed to {@link MaterialApplier.apply}).
 * Unit-tested in MaterialApplier.test.ts; the panel glue is visual
 * acceptance.
 */

import type { MaterialDefinition } from '../assets/MaterialDefinition';
import type { MaterialEditorTarget } from './MaterialEditor';

export class MaterialApplier {
  private readonly target: MaterialEditorTarget;
  private lastGood: MaterialDefinition | null = null;

  constructor(target: MaterialEditorTarget) {
    this.target = target;
  }

  /** A def the target now holds: push it and remember it as last-known-good.
   * Callers hand over validated, frozen defs (toDefinition() results) —
   * sharing the reference is safe and keeps reapply byte-identical. */
  apply(def: MaterialDefinition): void {
    this.lastGood = def;
    this.target.applyDefinition(def);
  }

  /** Push the last-known-good def again (slot rebuilds replaced it). No
   * last-known-good yet (nothing was ever applied) → no-op. */
  reapply(): void {
    if (this.lastGood === null) {
      return;
    }
    this.target.applyDefinition(this.lastGood);
  }
}
