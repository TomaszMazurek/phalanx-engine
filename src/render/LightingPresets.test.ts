import { describe, expect, it } from 'vitest';
import { normalizeLightPreset, type LightPreset } from '../assets/LightPresets';
import { applyLightingPreset } from './LightingPresets';
import type { LightingRig } from './LightingRig';

/**
 * Structural fake: applyLightingPreset only DISPATCHES to rig setters (no
 * THREE objects are constructed here, and LightingRig appears solely as an
 * erased type), so the smoke test records calls without importing three.js.
 */
interface RecordedCall {
  method: string;
  args: unknown[];
}

function fakeRig(pointLightCount = 2): { calls: RecordedCall[]; rig: LightingRig } {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): void => {
      calls.push({ method, args });
    };
  const rig = {
    pointLightCount,
    setAmbientIntensity: record('setAmbientIntensity'),
    setAmbientColor: record('setAmbientColor'),
    setHemisphereIntensity: record('setHemisphereIntensity'),
    setHemisphereColors: record('setHemisphereColors'),
    setDirectionalIntensity: record('setDirectionalIntensity'),
    setDirectionalColor: record('setDirectionalColor'),
    setPointLightIntensity: record('setPointLightIntensity'),
    setPointLightColor: record('setPointLightColor'),
  };
  return { calls, rig: rig as unknown as LightingRig };
}

describe('applyLightingPreset()', () => {
  it('dispatches every slot of a normalized preset to the matching rig setter', () => {
    const dusk: LightPreset = normalizeLightPreset({
      id: 'dusk',
      name: 'Dusk',
      ambient: { intensity: 0.25 },
      hemisphere: { intensity: 0.4, skyColor: 0xd88a5a, groundColor: 0x2a2438 },
      directional: { intensity: 0.65, color: 0xffb066 },
      points: [{ intensity: 0.5, color: 0xff9a4d }],
    });
    const { calls, rig } = fakeRig();
    applyLightingPreset(rig, dusk);
    expect(calls).toEqual([
      { method: 'setAmbientIntensity', args: [0.25] },
      { method: 'setAmbientColor', args: [0xffffff] },
      { method: 'setHemisphereIntensity', args: [0.4] },
      { method: 'setHemisphereColors', args: [0xd88a5a, 0x2a2438] },
      { method: 'setDirectionalIntensity', args: [0.65] },
      { method: 'setDirectionalColor', args: [0xffb066] },
      { method: 'setPointLightIntensity', args: [0, 0.5] },
      { method: 'setPointLightColor', args: [0, 0xff9a4d] },
      // Rig point 1 is beyond the preset's single point slot: switched off.
      { method: 'setPointLightIntensity', args: [1, 0] },
      { method: 'setPointLightColor', args: [1, 0xffffff] },
    ]);
  });

  it('fills omitted colors with the default white and zeroes both rig points for pointless presets', () => {
    const minimal: LightPreset = normalizeLightPreset({ id: 'day', name: 'Day', points: [] });
    const { calls, rig } = fakeRig();
    applyLightingPreset(rig, minimal);
    expect(calls).toEqual([
      { method: 'setAmbientIntensity', args: [0] },
      { method: 'setAmbientColor', args: [0xffffff] },
      { method: 'setHemisphereIntensity', args: [0] },
      { method: 'setHemisphereColors', args: [0xffffff, 0xffffff] },
      { method: 'setDirectionalIntensity', args: [0] },
      { method: 'setDirectionalColor', args: [0xffffff] },
      { method: 'setPointLightIntensity', args: [0, 0] },
      { method: 'setPointLightColor', args: [0, 0xffffff] },
      { method: 'setPointLightIntensity', args: [1, 0] },
      { method: 'setPointLightColor', args: [1, 0xffffff] },
    ]);
  });

  it('ignores preset points beyond the rig point capacity', () => {
    const preset: LightPreset = normalizeLightPreset({
      id: 'a',
      name: 'A',
      points: [{ intensity: 0.4 }, { intensity: 0.6 }],
    });
    const { calls, rig } = fakeRig(1);
    applyLightingPreset(rig, preset);
    expect(calls.filter((call) => call.method === 'setPointLightIntensity')).toEqual([
      { method: 'setPointLightIntensity', args: [0, 0.4] },
    ]);
  });
});
