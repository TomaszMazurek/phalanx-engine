import * as THREE from 'three';
import type { Manifest, MapKind } from '../assets/manifest';

/**
 * TextureLibrary — loads the manifest into GPU textures (task 4).
 *
 * Part of the `render/` layer because it produces three.js objects; the pure
 * manifest types live in `assets/`. Replaces the 4 copy-pasted sequential
 * loops of `legacy/scripts/Textures.js` with counted async loads.
 */

export type TextureSetMap = Partial<Record<MapKind, THREE.Texture>>;

export interface TextureSet {
  id: string;
  /** Fallback diffuse color as a three.js color number. */
  color: number;
  maps: TextureSetMap;
}

export interface LoadedAssets {
  sets: Map<string, TextureSet>;
  skyboxes: Map<string, THREE.CubeTexture>;
}

export interface LoadOptions {
  /** Max anisotropy from the renderer (`renderer.capabilities.getMaxAnisotropy()`). */
  anisotropy: number;
  onProgress?: (ratio: number) => void;
}

const SKYBOX_FACES = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'] as const;

export class TextureLibrary {
  async loadAll(manifest: Manifest, options: LoadOptions): Promise<LoadedAssets> {
    const loader = new THREE.TextureLoader();
    const cubeLoader = new THREE.CubeTextureLoader();

    const totalTextureFiles = manifest.sets.reduce(
      (count, set) => count + Object.keys(set.files).length,
      0,
    );
    const total = totalTextureFiles + manifest.skyboxes.length;
    let loaded = 0;
    const tick = (): void => {
      loaded += 1;
      options.onProgress?.(loaded / total);
    };

    const sets = new Map<string, TextureSet>();
    for (const def of manifest.sets) {
      const maps: TextureSetMap = {};
      for (const [kind, file] of Object.entries(def.files) as Array<
        [MapKind, string]
      >) {
        try {
          const texture = await loader.loadAsync(def.path + file);
          texture.name = `${def.id}_${kind}`;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.anisotropy = options.anisotropy;
          if (kind === 'baseColor') {
            texture.colorSpace = THREE.SRGBColorSpace;
          }
          if (kind === 'ao') {
            // aoMap reads UV channel 1 — MeshFactory clones uv into uv1.
            texture.channel = 1;
          }
          maps[kind] = texture;
        } catch (error) {
          console.warn(`[assets] failed to load map: ${def.path}${file}`, error);
        }
        tick();
      }
      sets.set(def.id, { id: def.id, color: parseColor(def.color), maps });
    }

    const skyboxes = new Map<string, THREE.CubeTexture>();
    for (const def of manifest.skyboxes) {
      try {
        const cube = await cubeLoader.loadAsync(SKYBOX_FACES.map((face) => def.path + face));
        cube.name = def.id;
        cube.colorSpace = THREE.SRGBColorSpace;
        skyboxes.set(def.id, cube);
      } catch (error) {
        console.warn(`[assets] failed to load skybox: ${def.path}`, error);
      }
      tick();
    }

    return { sets, skyboxes };
  }
}

function parseColor(hex: string): number {
  if (!hex.startsWith('#')) {
    throw new Error(`TextureLibrary: expected "#rrggbb" color, got "${hex}"`);
  }
  return Number.parseInt(hex.slice(1), 16);
}
