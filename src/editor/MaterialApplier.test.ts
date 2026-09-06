import { describe, expect, it } from 'vitest';
import type { MaterialDefinition } from '../assets/MaterialDefinition';
import type { MaterialEditorTarget } from './MaterialEditor';
import { MaterialApplier } from './MaterialApplier';

/**
 * MaterialApplier contract — the headless half of MaterialEditor's
 * live-apply pipeline (last-known-good tracking + reapply). The panel
 * itself is DOM-bound and stays visual acceptance (see MaterialEditor's
 * header); these tests pin the state machine that survives slot rebuilds.
 */

/** Recording stand-in for the apply target. */
function recordingTarget(): { target: MaterialEditorTarget; calls: MaterialDefinition[] } {
  const calls: MaterialDefinition[] = [];
  return {
    calls,
    target: {
      applyDefinition: (def) => {
        calls.push(def);
      },
    },
  };
}

function def(id: string): MaterialDefinition {
  return Object.freeze({
    version: 1,
    id,
    shading: 'standard',
    color: 0xff0000,
    params: { roughness: 0.25, metalness: 0.75, shininess: 10, normalScale: 1 },
    uv: {
      repeat: [1, 1],
      offset: [0, 0],
      rotation: 0,
      center: [0.5, 0.5],
    },
    maps: {},
  }) as unknown as MaterialDefinition;
}

describe('MaterialApplier', () => {
  it('no last-known-good yet: reapply() is a no-op — the target is never called', () => {
    const { target, calls } = recordingTarget();
    const applier = new MaterialApplier(target);

    applier.reapply();

    expect(calls).toHaveLength(0);
  });

  it('apply(): pushes the def to the target AND remembers it as last-known-good', () => {
    const { target, calls } = recordingTarget();
    const applier = new MaterialApplier(target);
    const a = def('a');

    applier.apply(a);

    expect(calls).toEqual([a]);
  });

  it('reapply(): re-pushes the LAST good def (same frozen reference), not the first', () => {
    const { target, calls } = recordingTarget();
    const applier = new MaterialApplier(target);
    const a = def('a');
    const b = def('b');
    applier.apply(a);
    applier.apply(b);

    applier.reapply(); // the viewer rebuilt slot materials — restore the edit

    expect(calls).toEqual([a, b, b]);
    expect(calls[2]).toBe(b); // frozen defs are immutable — sharing is safe
  });

  it('reapply() keeps re-applying the same def across repeated slot rebuilds', () => {
    const { target, calls } = recordingTarget();
    const applier = new MaterialApplier(target);
    const a = def('a');
    applier.apply(a);

    applier.reapply();
    applier.reapply();
    applier.reapply();

    expect(calls).toEqual([a, a, a, a]);
  });
});
