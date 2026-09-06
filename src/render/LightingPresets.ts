import { DEFAULT_LIGHT_COLOR, type LightPreset } from '../assets/LightPresets';
import type { LightingRig } from './LightingRig';

/**
 * LightingPresets — thin renderer-side applier for the pure data layer in
 * src/assets/LightPresets.ts. Maps one normalized preset onto LightingRig's
 * additive setters; no loading, no defaults of its own beyond the documented
 * DEFAULT_LIGHT_COLOR for slots that omit a color.
 *
 * Point slots apply in rig order (index 0..pointLightCount-1); rig lights
 * beyond the preset's point list are switched off, and preset points beyond
 * rig capacity are ignored (validation caps both at MAX_LIGHT_POINTS = 2).
 */
export function applyLightingPreset(rig: LightingRig, preset: LightPreset): void {
  rig.setAmbientIntensity(preset.ambient.intensity);
  rig.setAmbientColor(preset.ambient.color ?? DEFAULT_LIGHT_COLOR);
  rig.setHemisphereIntensity(preset.hemisphere.intensity);
  rig.setHemisphereColors(
    preset.hemisphere.skyColor ?? DEFAULT_LIGHT_COLOR,
    preset.hemisphere.groundColor ?? DEFAULT_LIGHT_COLOR,
  );
  rig.setDirectionalIntensity(preset.directional.intensity);
  rig.setDirectionalColor(preset.directional.color ?? DEFAULT_LIGHT_COLOR);
  for (let index = 0; index < rig.pointLightCount; index++) {
    const slot = preset.points[index];
    rig.setPointLightIntensity(index, slot ? slot.intensity : 0);
    rig.setPointLightColor(index, slot ? (slot.color ?? DEFAULT_LIGHT_COLOR) : DEFAULT_LIGHT_COLOR);
  }
}
