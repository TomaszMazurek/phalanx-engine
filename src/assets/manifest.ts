/**
 * Texture manifest types + loader (pure data layer — no three.js imports).
 *
 * The manifest (`public/textures/manifest.json`) is the single source of truth
 * for what lives on disk. Adding a texture set = adding an entry, zero code
 * changes (replaces the 307-line hardcoded `legacy/scripts/Textures.js`).
 */

export type MapKind = 'baseColor' | 'bump' | 'normal' | 'roughness' | 'ao' | 'displacement';

/** One PBR texture set as declared in the manifest (file names, not yet loaded). */
export interface TextureSetDef {
  id: string;
  /** Directory, trailing slash included, relative to server root. */
  path: string;
  /** Fallback diffuse color ("#rrggbb") when a map is missing. */
  color: string;
  /** Which map files exist for this set. Keys are map kinds, values are file names. */
  files: Partial<Record<MapKind, string>>;
}

export interface SkyboxDef {
  id: string;
  path: string;
}

export interface Manifest {
  sets: TextureSetDef[];
  skyboxes: SkyboxDef[];
}

export async function fetchManifest(url: string): Promise<Manifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${url} (HTTP ${response.status})`);
  }
  return (await response.json()) as Manifest;
}
