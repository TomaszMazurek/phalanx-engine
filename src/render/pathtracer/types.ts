/**
 * Types and interfaces for Phalanx Path Tracer / Lightmap Baker.
 */

export type BakeType = 'ao' | 'irradiance';

export interface BakeOptions {
  width: number;
  height: number;
  samples?: number;
  type?: BakeType;
  aoMaxDistance?: number;
  maxBounces?: number;
  normalBias?: number;
  dilationPixels?: number;
  seed?: number;
}

export interface RenderCameraOptions {
  width: number;
  height: number;
  samples?: number;
  maxDepth?: number;
  seed?: number;
  lookFrom: [number, number, number];
  lookAt: [number, number, number];
  vup?: [number, number, number];
  vfov?: number;
  focusDist?: number;
}

export interface PbrMaterialParams {
  baseColor?: [number, number, number];
  roughness?: number;
  metalness?: number;
  emissive?: [number, number, number];
  emissiveIntensity?: number;
  ior?: number;
  transmission?: number;
}

export interface MeshGeometryBuffers {
  positions: Float32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  uv2s?: Float32Array;
  indices?: Uint32Array;
}

export interface BakeResult {
  width: number;
  height: number;
  /** RGBA float values in [0.0, 1.0] (or HDR irradiance). Length: width * height * 4 */
  data: Float32Array;
}

/**
 * Raw WebAssembly C ABI exports.
 */
export interface NativePathTracerExports {
  _pt_alloc(bytes: number): number;
  _pt_free(ptr: number): void;
  _pt_clear_scene(): void;
  _pt_add_material(
    r: number, g: number, b: number,
    roughness: number,
    metalness: number,
    emissiveR: number, emissiveG: number, emissiveB: number,
    emissiveIntensity: number,
    ior: number,
    transmission: number
  ): number;
  _pt_add_mesh(
    positionsPtr: number, vertexCount: number,
    normalsPtr: number,
    uvsPtr: number,
    uv2sPtr: number,
    indicesPtr: number, indexCount: number,
    materialId: number
  ): number;
  _pt_set_camera(
    lookfromX: number, lookfromY: number, lookfromZ: number,
    lookatX: number, lookatY: number, lookatZ: number,
    vupX: number, vupY: number, vupZ: number,
    vfov: number,
    focusDist: number
  ): void;
  _pt_set_background_color(r: number, g: number, b: number): void;
  _pt_build_bvh(): number;
  _pt_get_primitive_count(): number;
  _pt_bake(
    width: number, height: number,
    samples: number,
    bakeType: number,
    aoMaxDistance: number,
    maxBounces: number,
    normalBias: number,
    dilationPixels: number,
    seed: number,
    outRgbaPtr: number
  ): number;
  _pt_render_camera(
    width: number, height: number,
    samples: number,
    maxDepth: number,
    seed: number,
    outRgbaPtr: number
  ): number;

  HEAPF32: Float32Array;
  HEAPU32: Uint32Array;
  HEAPU8: Uint8Array;
}
