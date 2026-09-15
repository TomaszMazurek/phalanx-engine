import * as THREE from 'three';
import type { BakeResult, MeshGeometryBuffers, PbrMaterialParams } from './types';

export class SceneExtractor {
  /**
   * Extracts transformed world-space geometry buffers from a Three.js Mesh.
   */
  public static extractMeshGeometry(mesh: THREE.Mesh): MeshGeometryBuffers | null {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes.position) {
      return null;
    }

    mesh.updateMatrixWorld(true);
    const matrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    const posAttr = geom.attributes.position;
    const vertexCount = posAttr.count;

    // 1. Transform positions to world space
    const worldPositions = new Float32Array(vertexCount * 3);
    const v = new THREE.Vector3();

    for (let i = 0; i < vertexCount; ++i) {
      v.fromBufferAttribute(posAttr, i);
      v.applyMatrix4(matrix);
      worldPositions[i * 3] = v.x;
      worldPositions[i * 3 + 1] = v.y;
      worldPositions[i * 3 + 2] = v.z;
    }

    // 2. Transform normals if present
    let worldNormals: Float32Array | undefined;
    if (geom.attributes.normal) {
      const normAttr = geom.attributes.normal;
      worldNormals = new Float32Array(vertexCount * 3);
      const n = new THREE.Vector3();

      for (let i = 0; i < vertexCount; ++i) {
        n.fromBufferAttribute(normAttr, i);
        n.applyMatrix3(normalMatrix).normalize();
        worldNormals[i * 3] = n.x;
        worldNormals[i * 3 + 1] = n.y;
        worldNormals[i * 3 + 2] = n.z;
      }
    }

    // 3. Extract UV1
    let uvs: Float32Array | undefined;
    if (geom.attributes.uv) {
      uvs = new Float32Array(geom.attributes.uv.array);
    }

    // 4. Extract UV2 (lightmap coordinates). Fallback to UV1 if UV2 is missing
    let uv2s: Float32Array | undefined;
    if (geom.attributes.uv2) {
      uv2s = new Float32Array(geom.attributes.uv2.array);
    } else if (uvs) {
      uv2s = new Float32Array(uvs);
    }

    // 5. Extract indices
    let indices: Uint32Array | undefined;
    if (geom.index) {
      const idxArray = geom.index.array;
      if (idxArray instanceof Uint32Array) {
        indices = idxArray;
      } else {
        indices = new Uint32Array(idxArray);
      }
    }

    return {
      positions: worldPositions,
      normals: worldNormals,
      uvs,
      uv2s,
      indices
    };
  }

  /**
   * Extracts PBR material properties from a Three.js material.
   */
  public static extractMaterialParams(material: THREE.Material): PbrMaterialParams {
    if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
      const pbr: PbrMaterialParams = {
        baseColor: [material.color.r, material.color.g, material.color.b],
        roughness: material.roughness,
        metalness: material.metalness,
        emissive: [material.emissive.r, material.emissive.g, material.emissive.b],
        emissiveIntensity: material.emissiveIntensity
      };

      if (material instanceof THREE.MeshPhysicalMaterial) {
        pbr.ior = material.ior;
        pbr.transmission = material.transmission;
      }

      return pbr;
    }

    return {
      baseColor: [0.8, 0.8, 0.8],
      roughness: 1.0,
      metalness: 0.0
    };
  }

  /**
   * Converts a BakeResult into a Three.js DataTexture ready to be assigned to material.lightMap.
   */
  public static createLightmapTexture(result: BakeResult): THREE.DataTexture {
    const texture = new THREE.DataTexture(
      result.data,
      result.width,
      result.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}
