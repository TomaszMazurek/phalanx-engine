import * as THREE from 'three';
import type { BakeResult, ExtractedLights, LightParams, MeshGeometryBuffers, PbrMaterialParams } from './types';

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

  /**
   * Extracts analytical lights (Directional, Point, Spot) and ambient/sky background from a Three.js scene hierarchy.
   */
  public static extractLights(root: THREE.Object3D): ExtractedLights {
    const lights: LightParams[] = [];
    let bgR = 0.05;
    let bgG = 0.05;
    let bgB = 0.08;
    let hasExplicitBg = false;

    if (root instanceof THREE.Scene && root.background instanceof THREE.Color) {
      bgR = root.background.r;
      bgG = root.background.g;
      bgB = root.background.b;
      hasExplicitBg = true;
    }

    const lightPos = new THREE.Vector3();
    const targetPos = new THREE.Vector3();
    const dir = new THREE.Vector3();

    root.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight) {
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(lightPos);
        if (obj.target) {
          obj.target.updateMatrixWorld(true);
          obj.target.getWorldPosition(targetPos);
          dir.subVectors(targetPos, lightPos).normalize();
        } else {
          dir.set(0, -1, 0);
        }

        lights.push({
          type: 'directional',
          direction: [dir.x, dir.y, dir.z],
          color: [obj.color.r, obj.color.g, obj.color.b],
          intensity: obj.intensity
        });
      } else if (obj instanceof THREE.SpotLight) {
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(lightPos);
        if (obj.target) {
          obj.target.updateMatrixWorld(true);
          obj.target.getWorldPosition(targetPos);
          dir.subVectors(targetPos, lightPos).normalize();
        } else {
          dir.set(0, -1, 0);
        }

        const innerCone = obj.angle * (1.0 - obj.penumbra);
        lights.push({
          type: 'spot',
          position: [lightPos.x, lightPos.y, lightPos.z],
          direction: [dir.x, dir.y, dir.z],
          color: [obj.color.r, obj.color.g, obj.color.b],
          intensity: obj.intensity,
          range: obj.distance > 0 ? obj.distance : 0,
          innerConeAngle: innerCone,
          outerConeAngle: obj.angle
        });
      } else if (obj instanceof THREE.PointLight) {
        obj.updateMatrixWorld(true);
        obj.getWorldPosition(lightPos);

        lights.push({
          type: 'point',
          position: [lightPos.x, lightPos.y, lightPos.z],
          color: [obj.color.r, obj.color.g, obj.color.b],
          intensity: obj.intensity,
          range: obj.distance > 0 ? obj.distance : 0
        });
      } else if (obj instanceof THREE.AmbientLight || obj instanceof THREE.HemisphereLight) {
        const amb = obj as THREE.AmbientLight;
        const addR = amb.color.r * amb.intensity;
        const addG = amb.color.g * amb.intensity;
        const addB = amb.color.b * amb.intensity;
        if (!hasExplicitBg) {
          bgR = addR;
          bgG = addG;
          bgB = addB;
          hasExplicitBg = true;
        } else {
          bgR += addR;
          bgG += addG;
          bgB += addB;
        }
      }
    });

    return {
      lights,
      backgroundColor: [bgR, bgG, bgB]
    };
  }
}
