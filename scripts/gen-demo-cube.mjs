#!/usr/bin/env node
/**
 * gen-demo-cube.mjs — deterministic UV-carrying demo cube (Phase 3, Wave E fix).
 *
 * Writes public/models/demo-cube.gltf with NO dependencies (same policy as
 * gen-env-hdr.mjs): a unit cube, one quad (4 verts) per face, so every
 * attribute has exactly 24 vertices:
 *   POSITION   VEC3 float  24  (+ min/max on the accessor, glTF-required)
 *   NORMAL     VEC3 float  24  (per-face axis normals)
 *   TEXCOORD_0 VEC2 float  24  (standard box mapping: each face maps the
 *                               FULL [0,1] square — PBR maps can display)
 *   COLOR_0    VEC3 float  24  (per-face vertex colors, kept from the
 *                               Phase 2 hand-built asset: +X red, -X green,
 *                               +Y blue, -Y yellow, +Z magenta, -Z cyan)
 *   indices    SCALAR uint16 36 (two CCW triangles per face)
 *
 * Why regenerated, not hand-edited: the wave E review found the old asset
 * had NO TEXCOORD_0, so PBR maps could never display on the glTF model path
 * (acceptance requires maps visible on primitive AND model), and the Draco/
 * meshopt .glb variants are DERIVED from this file (gen-compressed-models.mjs)
 * — one source of truth, regenerate on change.
 *
 * Verification below re-reads the written file and checks the JSON structure
 * plus the accessor/bufferView math, then parses it through three's REAL
 * GLTFLoader headlessly (Wave D1 pattern: node has fetch for data: URIs and
 * a ProgressEvent stub stands in for FileLoader's streaming events).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'demo-cube.gltf');

const S = 0.5; // half-extent: unit cube centered at the origin

/** One face: axis quad corners in CCW order (matching the Phase 2 asset),
 * its outward normal, and its vertex color. */
const FACES = [
  {
    // +X
    quad: [
      [S, -S, -S],
      [S, S, -S],
      [S, S, S],
      [S, -S, S],
    ],
    normal: [1, 0, 0],
    color: [1, 0, 0],
  },
  {
    // -X
    quad: [
      [-S, -S, S],
      [-S, S, S],
      [-S, S, -S],
      [-S, -S, -S],
    ],
    normal: [-1, 0, 0],
    color: [0, 1, 0],
  },
  {
    // +Y
    quad: [
      [-S, S, S],
      [S, S, S],
      [S, S, -S],
      [-S, S, -S],
    ],
    normal: [0, 1, 0],
    color: [0, 0, 1],
  },
  {
    // -Y
    quad: [
      [-S, -S, -S],
      [S, -S, -S],
      [S, -S, S],
      [-S, -S, S],
    ],
    normal: [0, -1, 0],
    color: [1, 1, 0],
  },
  {
    // +Z
    quad: [
      [-S, -S, S],
      [S, -S, S],
      [S, S, S],
      [-S, S, S],
    ],
    normal: [0, 0, 1],
    color: [1, 0, 1],
  },
  {
    // -Z
    quad: [
      [S, -S, -S],
      [-S, -S, -S],
      [-S, S, -S],
      [S, S, -S],
    ],
    normal: [0, 0, -1],
    color: [0, 1, 1],
  },
];

/** Full-square UVs in the same quad order as the corners. */
const FACE_UVS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

// --- attributes -------------------------------------------------------------

const positions = new Float32Array(FACES.length * 4 * 3);
const normals = new Float32Array(FACES.length * 4 * 3);
const uvs = new Float32Array(FACES.length * 4 * 2);
const colors = new Float32Array(FACES.length * 4 * 3);
const indices = new Uint16Array(FACES.length * 6);

FACES.forEach((face, f) => {
  face.quad.forEach((corner, v) => {
    const at = (f * 4 + v) * 3;
    positions.set(corner, at);
    normals.set(face.normal, at);
    colors.set(face.color, at);
    uvs.set(FACE_UVS[v], (f * 4 + v) * 2);
  });
  const base = f * 4;
  indices.set([0, 1, 2, 0, 2, 3].map((i) => base + i), f * 6);
});

// POSITION min/max — required by the glTF spec, checked in verification.
const positionMin = [0, 1, 2].map((axis) => Math.min(...positions.filter((_, i) => i % 3 === axis)));
const positionMax = [0, 1, 2].map((axis) => Math.max(...positions.filter((_, i) => i % 3 === axis)));

// --- glTF JSON ----------------------------------------------------------------

/** Accessor-to-buffer packing: one bufferView per attribute in this order,
 * each already 4-byte aligned (float32 blocks; the uint16 index block is
 * last and only self-alignment matters). */
const blocks = [
  { data: positions, type: 'VEC3', count: positions.length / 3 },
  { data: normals, type: 'VEC3', count: normals.length / 3 },
  { data: uvs, type: 'VEC2', count: uvs.length / 2 },
  { data: colors, type: 'VEC3', count: colors.length / 3 },
];

let offset = 0;
const bufferViews = [];
const blockBytes = [];
for (const block of blocks) {
  const bytes = Buffer.from(block.data.buffer, block.data.byteOffset, block.data.byteLength);
  if (offset % 4 !== 0) {
    throw new Error('packing bug: unaligned float32 block'); // guarded, never padded
  }
  blockBytes.push(bytes);
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target: 34962 });
  offset += bytes.byteLength;
}
const indexBytes = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
blockBytes.push(indexBytes);
bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: indexBytes.byteLength, target: 34963 });

const binary = Buffer.concat(blockBytes);

const gltf = {
  asset: {
    version: '2.0',
    generator: 'phalanx-engine scripts/gen-demo-cube.mjs (deterministic — regenerate, do not hand-edit)',
  },
  scene: 0,
  scenes: [{ name: 'Scene', nodes: [0] }],
  nodes: [{ mesh: 0, name: 'DemoCube' }],
  meshes: [
    {
      name: 'DemoCube',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 },
          indices: 4,
        },
      ],
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: blocks[0].count,
      type: 'VEC3',
      min: positionMin,
      max: positionMax,
    },
    { bufferView: 1, componentType: 5126, count: blocks[1].count, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: blocks[2].count, type: 'VEC2' },
    { bufferView: 3, componentType: 5126, count: blocks[3].count, type: 'VEC3' },
    { bufferView: 4, componentType: 5123, count: indices.length, type: 'SCALAR' },
  ],
  bufferViews,
  buffers: [
    {
      byteLength: binary.byteLength,
      uri: `data:application/octet-stream;base64,${binary.toString('base64')}`,
    },
  ],
};

writeFileSync(OUT, `${JSON.stringify(gltf, null, 2)}\n`);
console.log(`demo-cube.gltf: ${FACES.length} faces, 24 verts, 36 indices, ${binary.byteLength} B binary`);

// --- verification (re-read what was written) ------------------------------------

const written = readFileSync(OUT, 'utf8');
const parsed = JSON.parse(written); // throws on a truncated write

function expectTrue(condition, message) {
  if (!condition) {
    throw new Error(`demo-cube.gltf: ${message}`);
  }
}

const attrs = parsed.meshes[0].primitives[0].attributes;
expectTrue(
  JSON.stringify(attrs) === '{"POSITION":0,"NORMAL":1,"TEXCOORD_0":2,"COLOR_0":3}',
  `primitive attributes ${JSON.stringify(attrs)}`,
);
expectTrue(parsed.meshes[0].primitives[0].indices === 4, 'indices accessor index');

// Accessor math: each accessor's view covers exactly count * size(componentType).
const COMPONENT_SIZE = { 5126: 4, 5123: 2 };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3 };
const buffer = Buffer.from(parsed.buffers[0].uri.split(',')[1], 'base64');
expectTrue(parsed.buffers[0].byteLength === buffer.byteLength, 'buffer.byteLength vs base64 payload');
expectTrue(parsed.buffers[0].byteLength === binary.byteLength, 'buffer.byteLength vs packed bytes');
for (const [index, accessor] of parsed.accessors.entries()) {
  const view = parsed.bufferViews[accessor.bufferView];
  const perVertex =
    COMPONENT_SIZE[accessor.componentType] * COMPONENTS[accessor.type];
  expectTrue(view.byteLength === accessor.count * perVertex, `accessor ${index}: byteLength`);
  expectTrue(
    view.byteOffset + view.byteLength <= buffer.byteLength,
    `accessor ${index}: view inside buffer`,
  );
  expectTrue(view.byteOffset % COMPONENT_SIZE[accessor.componentType] === 0, `accessor ${index}: alignment`);
}

// POSITION min/max vs the decoded payload.
const decodedPositions = new Float32Array(
  buffer.buffer.slice(
    buffer.byteOffset + parsed.bufferViews[0].byteOffset,
    buffer.byteOffset + parsed.bufferViews[0].byteOffset + parsed.bufferViews[0].byteLength,
  ),
);
for (const axis of [0, 1, 2]) {
  const values = decodedPositions.filter((_, i) => i % 3 === axis);
  expectTrue(
    Math.min(...values) === parsed.accessors[0].min[axis] &&
      Math.max(...values) === parsed.accessors[0].max[axis],
    `POSITION min/max axis ${axis}`,
  );
}

// Indices in range and CCW-normal consistency: every triangle's face normal
// (cross product) matches the NORMAL attribute of its first vertex.
const decodedNormals = new Float32Array(
  buffer.buffer.slice(
    buffer.byteOffset + parsed.bufferViews[1].byteOffset,
    buffer.byteOffset + parsed.bufferViews[1].byteOffset + parsed.bufferViews[1].byteLength,
  ),
);
const decodedIndices = new Uint16Array(
  buffer.buffer.slice(
    buffer.byteOffset + parsed.bufferViews[4].byteOffset,
    buffer.byteOffset + parsed.bufferViews[4].byteOffset + parsed.bufferViews[4].byteLength,
  ),
);
const at3 = (array, i) => [array[i * 3], array[i * 3 + 1], array[i * 3 + 2]];
for (let t = 0; t < decodedIndices.length; t += 3) {
  const [a, b, c] = [decodedIndices[t], decodedIndices[t + 1], decodedIndices[t + 2]];
  for (const vertex of [a, b, c]) {
    expectTrue(vertex < decodedPositions.length / 3, `triangle ${t / 3}: index in range`);
  }
  const pa = at3(decodedPositions, a);
  const pb = at3(decodedPositions, b);
  const pc = at3(decodedPositions, c);
  const cross = [
    (pb[1] - pa[1]) * (pc[2] - pa[2]) - (pb[2] - pa[2]) * (pc[1] - pa[1]),
    (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]),
    (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]),
  ];
  const normal = at3(decodedNormals, a);
  const dot = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2];
  expectTrue(dot > 0, `triangle ${t / 3}: winding opposes its normal attribute`);
}
console.log('verified: JSON structure, accessor/view math, POSITION min/max, index winding');

// --- bonus: real GLTFLoader parse, headless (Wave D1 pattern) -------------------
// node has fetch for the embedded data: URI; FileLoader also constructs DOM
// ProgressEvents while streaming, so the stub mirrors GLTFAdapter.test.ts.
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class {
    lengthComputable = false;
    loaded = 0;
    total = 0;
    constructor(_type, init) {
      this.lengthComputable = init?.lengthComputable ?? false;
      this.loaded = init?.loaded ?? 0;
      this.total = init?.total ?? 0;
    }
  };
}
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const loader = new GLTFLoader();
const loaded = await new Promise((resolve, reject) =>
  loader.parse(written, '', resolve, reject),
);
const mesh = loaded.scene.children[0];
const geometry = mesh.geometry;
const counts = {
  position: geometry.getAttribute('position').count,
  normal: geometry.getAttribute('normal').count,
  uv: geometry.getAttribute('uv').count,
  color: geometry.getAttribute('color').count,
};
expectTrue(mesh.isMesh, 'GLTFLoader produced a Mesh');
expectTrue(
  Object.values(counts).every((count) => count === 24),
  `GLTFLoader attribute counts ${JSON.stringify(counts)}`,
);
expectTrue(geometry.getIndex().count === 36, 'GLTFLoader index count');
const uv = geometry.getAttribute('uv');
for (let i = 0; i < uv.count; i++) {
  if (uv.getX(i) < 0 || uv.getX(i) > 1 || uv.getY(i) < 0 || uv.getY(i) > 1) {
    throw new Error(`demo-cube.gltf: uv ${i} outside [0,1]`);
  }
}
console.log(
  `verified: GLTFLoader parse — Mesh with position/normal/uv/color × 24, 36 indices, uvs in [0,1]`,
);
