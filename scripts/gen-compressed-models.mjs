#!/usr/bin/env node
/**
 * gen-compressed-models.mjs — compressed demo GLBs (Phase 3, Wave D1).
 *
 * Reads public/models/demo-cube.gltf (hand-built Phase 2 demo asset) and
 * produces, in public/models/:
 *   - demo-cube-draco.glb    (KHR_draco_mesh_compression, edgebreaker)
 *   - demo-cube-meshopt.glb  (EXT_meshopt_compression)
 *
 * Both variants are verified by a real decode ROUND-TRIP right here
 * (draco3d decoder / MeshoptDecoder), because three's DRACOLoader cannot
 * run headlessly in node (it requires the browser Worker global — verified:
 * `typeof Worker === 'undefined'` in node 24). The meshopt GLB gets a second
 * end-to-end proof through three's own GLTFLoader + MeshoptDecoder in
 * src/render/GLTFAdapter.test.ts.
 *
 * KTX2 sample: NOT produced — demo-cube.gltf has no textures (vertex colors
 * only) and .ktx2 encoding needs a native encoder (toktx from KTX-Software)
 * which gltf-transform does not bundle. Deferred to Game 1; see
 * docs/phase-3-materials.md wave D.
 *
 * Tooling is devDependencies (same policy as vitest): @gltf-transform/{core,
 * functions}, draco3dgltf, meshoptimizer — all WASM/JS, no native binaries.
 */
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRDracoMeshCompression,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { cloneDocument, draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const MODELS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
const SRC = resolve(MODELS_DIR, 'demo-cube.gltf');
const DRACO_OUT = resolve(MODELS_DIR, 'demo-cube-draco.glb');
const MESHOPT_OUT = resolve(MODELS_DIR, 'demo-cube-meshopt.glb');

/** First mesh primitive's POSITION accessor, raw values + flags. */
function positionAccessor(document) {
  const mesh = document.getRoot().listMeshes()[0];
  const position = mesh.listPrimitives()[0].getAttribute('POSITION');
  return {
    count: position.getCount(),
    componentType: position.getComponentType(),
    normalized: position.getNormalized(),
    array: new Float32Array(position.getArray()),
  };
}

/**
 * Order-insensitive geometry fingerprint: sorted component multiset.
 * Draco's edgebreaker legitimately reorders vertices on decode, so a
 * vertex-by-vertex delta is meaningless — the sorted multiset is not.
 */
function sortedComponents(accessor, node) {
  const scale = node?.getScale?.() ?? [1, 1, 1];
  const translation = node?.getTranslation?.() ?? [0, 0, 0];
  // KHR-mesh-quantization semantics: normalized int16 dequantizes via
  // raw/32767 (componentType 5122), then the node carries the real
  // transform (scale/translation) back to model units. Float32 passes
  // through untouched.
  const dequantize = accessor.normalized && accessor.componentType === 5122
    ? (v) => v / 32767
    : (v) => v;
  const values = [];
  for (let i = 0; i < accessor.array.length; i++) {
    const axis = i % 3;
    values.push(dequantize(accessor.array[i]) * scale[axis] + translation[axis]);
  }
  values.sort((a, b) => a - b);
  return values;
}

/** Max |a[i] - b[i]| over sorted fingerprints (0 = exact match). */
function maxAbsDelta(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

const readIo = new NodeIO();
const original = await readIo.read(SRC);

// --- draco --------------------------------------------------------------------
const dracoDoc = cloneDocument(original);
await dracoDoc.transform(draco({ method: 'edgebreaker' }));
const dracoWriteIo = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule() });
await dracoWriteIo.write(DRACO_OUT, dracoDoc);

// --- meshopt ------------------------------------------------------------------
await MeshoptEncoder.ready;
const meshoptDoc = cloneDocument(original);
await meshoptDoc.transform(meshopt({ encoder: MeshoptEncoder }));
const meshoptWriteIo = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await meshoptWriteIo.write(MESHOPT_OUT, meshoptDoc);

// --- round-trip decode verification (real decoders, headless) ------------------
// Both reads run the actual WASM decoders (draco3d decoder module /
// MeshoptDecoder) on the compressed bufferViews — decoding is not optional
// for the reader, so reaching the comparison already proves the bytes decode.
const meshNodeOf = (doc) => doc.getRoot().listNodes().find((n) => n.getMesh());
const expectedFingerprint = sortedComponents(positionAccessor(original), meshNodeOf(original));

const dracoVerifyIo = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const dracoBack = await dracoVerifyIo.read(DRACO_OUT);
const dracoFingerprint = sortedComponents(positionAccessor(dracoBack), meshNodeOf(dracoBack));

await MeshoptDecoder.ready;
const meshoptVerifyIo = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const meshoptBack = await meshoptVerifyIo.read(MESHOPT_OUT);
const meshoptFingerprint = sortedComponents(positionAccessor(meshoptBack), meshNodeOf(meshoptBack));

for (const [name, back] of [
  ['draco', dracoFingerprint],
  ['meshopt', meshoptFingerprint],
]) {
  if (back.length !== expectedFingerprint.length) {
    throw new Error(`${name}: component count changed ${expectedFingerprint.length} -> ${back.length}`);
  }
  const delta = maxAbsDelta(back, expectedFingerprint);
  // 14-bit quantization over a 2-unit bbox allows ~2.4e-4; 1e-3 tolerance.
  if (delta > 1e-3) {
    throw new Error(`${name}: sorted position delta ${delta} exceeds 1e-3`);
  }
  console.log(`${name} round-trip: ${back.length / 3} verts, sorted max |Δposition| = ${delta.toExponential(3)}`);
}

// --- honest size report ---------------------------------------------------------
const plainGlb = await new NodeIO().writeBinary(original); // uncompressed container baseline
const sizes = [
  ['demo-cube.gltf (source, JSON+base64)', statSync(SRC).size],
  ['demo-cube.glb equivalent (uncompressed binary)', plainGlb.byteLength],
  ['demo-cube-draco.glb', statSync(DRACO_OUT).size],
  ['demo-cube-meshopt.glb', statSync(MESHOPT_OUT).size],
];
for (const [name, bytes] of sizes) {
  console.log(`${bytes.toLocaleString('en-US').padStart(10)} B  ${name}`);
}
console.log('NOTE: the demo cube is a 648-byte toy mesh — compression overhead can exceed savings at this size; numbers are real, not cherry-picked.');
