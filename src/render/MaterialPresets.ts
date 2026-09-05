import * as THREE from 'three';
import type { TextureSet } from './TextureLibrary';

/**
 * Material presets from a loaded TextureSet (replaces the 239-line
 * `legacy/scripts/Material.js` ShaderLib hack with stock three.js materials).
 *
 * Color-space rule (phase 1 plan, technical note 2): baseColor textures are
 * sRGB (set at load time), data maps (normal/bump/AO/roughness) stay linear.
 */
export function createPhongMaterial(
  set: TextureSet,
  useNormalMap: boolean,
  shininess: number,
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: set.color,
    shininess,
  });
  applyStandardMaps(material, set, useNormalMap);
  return material;
}

export function createStandardMaterial(
  set: TextureSet,
  useNormalMap: boolean,
  roughness: number,
  metalness: number,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: set.color,
    roughness,
    metalness,
  });
  applyStandardMaps(material, set, useNormalMap);
  if (set.maps.roughness) {
    material.roughnessMap = set.maps.roughness;
  }
  return material;
}

function applyStandardMaps(
  material: THREE.MeshPhongMaterial | THREE.MeshStandardMaterial,
  set: TextureSet,
  useNormalMap: boolean,
): void {
  if (set.maps.baseColor) {
    material.map = set.maps.baseColor;
  }
  if (useNormalMap && set.maps.normal) {
    material.normalMap = set.maps.normal;
    material.normalScale = new THREE.Vector2(1, 1);
  } else if (set.maps.bump) {
    material.bumpMap = set.maps.bump;
    material.bumpScale = 1;
  }
  if (set.maps.ao) {
    material.aoMap = set.maps.ao;
    material.aoMapIntensity = 1;
  }
}
