import type {
  BakeOptions,
  BakeResult,
  MeshGeometryBuffers,
  NativePathTracerExports,
  PbrMaterialParams,
  RenderCameraOptions
} from './types';

export class PathTracerBridge {
  private wasm: NativePathTracerExports;

  constructor(wasmModule: NativePathTracerExports) {
    this.wasm = wasmModule;
  }

  public clearScene(): void {
    this.wasm._pt_clear_scene();
  }

  public addMaterial(params: PbrMaterialParams = {}): number {
    const baseColor = params.baseColor ?? [1.0, 1.0, 1.0];
    const roughness = params.roughness ?? 1.0;
    const metalness = params.metalness ?? 0.0;
    const emissive = params.emissive ?? [0.0, 0.0, 0.0];
    const emissiveIntensity = params.emissiveIntensity ?? 1.0;
    const ior = params.ior ?? 1.5;
    const transmission = params.transmission ?? 0.0;

    return this.wasm._pt_add_material(
      baseColor[0], baseColor[1], baseColor[2],
      roughness,
      metalness,
      emissive[0], emissive[1], emissive[2],
      emissiveIntensity,
      ior,
      transmission
    );
  }

  public addMesh(geom: MeshGeometryBuffers, materialId: number): number {
    const vertexCount = geom.positions.length / 3;
    if (vertexCount < 3) return 0;

    const posPtr = this.uploadFloat32(geom.positions);
    const normPtr = geom.normals ? this.uploadFloat32(geom.normals) : 0;
    const uvPtr = geom.uvs ? this.uploadFloat32(geom.uvs) : 0;
    const uv2Ptr = geom.uv2s ? this.uploadFloat32(geom.uv2s) : 0;

    let indexPtr = 0;
    let indexCount = 0;
    if (geom.indices && geom.indices.length >= 3) {
      indexPtr = this.uploadUint32(geom.indices);
      indexCount = geom.indices.length;
    }

    const added = this.wasm._pt_add_mesh(
      posPtr, vertexCount,
      normPtr,
      uvPtr,
      uv2Ptr,
      indexPtr, indexCount,
      materialId
    );

    this.wasm._pt_free(posPtr);
    if (normPtr) this.wasm._pt_free(normPtr);
    if (uvPtr) this.wasm._pt_free(uvPtr);
    if (uv2Ptr) this.wasm._pt_free(uv2Ptr);
    if (indexPtr) this.wasm._pt_free(indexPtr);

    return added;
  }

  public buildBVH(): boolean {
    return this.wasm._pt_build_bvh() === 1;
  }

  public getPrimitiveCount(): number {
    return this.wasm._pt_get_primitive_count();
  }

  public bake(options: BakeOptions): BakeResult {
    const width = options.width;
    const height = options.height;
    const samples = options.samples ?? 32;
    const bakeType = options.type === 'irradiance' ? 1 : 0;
    const aoMaxDist = options.aoMaxDistance ?? 100.0;
    const maxBounces = options.maxBounces ?? 3;
    const normalBias = options.normalBias ?? 0.005;
    const dilation = options.dilationPixels ?? 2;
    const seed = options.seed ?? 42;

    const floatCount = width * height * 4;
    const byteSize = floatCount * Float32Array.BYTES_PER_ELEMENT;
    const outPtr = this.wasm._pt_alloc(byteSize);

    const success = this.wasm._pt_bake(
      width, height,
      samples,
      bakeType,
      aoMaxDist,
      maxBounces,
      normalBias,
      dilation,
      seed,
      outPtr
    );

    if (success !== 1) {
      this.wasm._pt_free(outPtr);
      throw new Error(`PathTracerBridge.bake failed for size ${width}x${height}`);
    }

    const floatOffset = outPtr / Float32Array.BYTES_PER_ELEMENT;
    const resultData = new Float32Array(floatCount);
    resultData.set(this.wasm.HEAPF32.subarray(floatOffset, floatOffset + floatCount));

    this.wasm._pt_free(outPtr);

    return {
      width,
      height,
      data: resultData
    };
  }

  public renderCamera(options: RenderCameraOptions): Float32Array {
    const width = options.width;
    const height = options.height;
    const samples = options.samples ?? 16;
    const maxDepth = options.maxDepth ?? 5;
    const seed = options.seed ?? 42;
    const vup = options.vup ?? [0, 1, 0];
    const vfov = options.vfov ?? 40.0;
    const focusDist = options.focusDist ?? 10.0;

    this.wasm._pt_set_camera(
      options.lookFrom[0], options.lookFrom[1], options.lookFrom[2],
      options.lookAt[0], options.lookAt[1], options.lookAt[2],
      vup[0], vup[1], vup[2],
      vfov,
      focusDist
    );

    const floatCount = width * height * 4;
    const byteSize = floatCount * Float32Array.BYTES_PER_ELEMENT;
    const outPtr = this.wasm._pt_alloc(byteSize);

    const success = this.wasm._pt_render_camera(
      width, height,
      samples,
      maxDepth,
      seed,
      outPtr
    );

    if (success !== 1) {
      this.wasm._pt_free(outPtr);
      throw new Error(`PathTracerBridge.renderCamera failed for size ${width}x${height}`);
    }

    const floatOffset = outPtr / Float32Array.BYTES_PER_ELEMENT;
    const resultData = new Float32Array(floatCount);
    resultData.set(this.wasm.HEAPF32.subarray(floatOffset, floatOffset + floatCount));

    this.wasm._pt_free(outPtr);

    return resultData;
  }

  private uploadFloat32(array: Float32Array): number {
    const bytes = array.byteLength;
    const ptr = this.wasm._pt_alloc(bytes);
    const offset = ptr / Float32Array.BYTES_PER_ELEMENT;
    this.wasm.HEAPF32.set(array, offset);
    return ptr;
  }

  private uploadUint32(array: Uint32Array): number {
    const bytes = array.byteLength;
    const ptr = this.wasm._pt_alloc(bytes);
    const offset = ptr / Uint32Array.BYTES_PER_ELEMENT;
    this.wasm.HEAPU32.set(array, offset);
    return ptr;
  }
}
