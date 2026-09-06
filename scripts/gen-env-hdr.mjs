#!/usr/bin/env node
/**
 * gen-env-hdr.mjs — procedural equirectangular RADIANCE .hdr assets (Phase 3, Wave B1).
 *
 * Writes two tiny 256x128 HDRIs to public/env/ with NO dependencies:
 * - studio.hdr: neutral soft studio — vertical gradient + two softbox blobs.
 * - sunset.hdr: warm horizon / cool zenith gradient + a sun blob.
 *
 * Format notes (verified against three 0.185's HDRLoader,
 * node_modules/three/examples/jsm/loaders/HDRLoader.js):
 * - Header: '#?RADIANCE' magic line, comment lines, FORMAT=32-bit_rle_rgbe,
 *   blank line, dimensions line '-Y <h> +X <w>' (the loader's dimensions_re
 *   at line 133 accepts exactly -Y/+X). No extra newline after the dimensions
 *   line — fgets consumes its '\n' and pixel data starts immediately.
 * - Pixels: UNCOMPRESSED (flat) RGBE — RGBE_ReadPixels_RLE (lines 239-247)
 *   returns the flat buffer when the first pixel is not (R=2, G=2, B&0x80).
 *   256x128 satisfies the width bounds [8, 0x7fff], so only that first-pixel
 *   rule decides; the script guards it explicitly below.
 * - Encoding is the exact inverse of the loader's decode
 *   (float = mantissa/255 * 2^(e-128), RGBEByteToRGBFloat):
 *     E = max(0, ceil(log2(max(r, g, b))))   shared exponent, 0 for black
 *     mantissa = round(c / 2^E * 255)        max channel lands in (127, 255]
 *     exponent byte = E + 128
 *
 * Peak radiance is kept well under 65504 (half-float ceiling in the loader).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 256;
const H = 128;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'env');

// --- math helpers ------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Unit direction of an equirect pixel: row 0 = zenith, lon in radians. */
function direction(x, y) {
  const lon = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
  const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), Math.sin(lat), cosLat * Math.sin(lon)];
}

/** Gaussian blob response for a pixel direction around a blob direction. */
function blob(dot, sigma) {
  const angle = Math.acos(clamp(dot, -1, 1));
  return Math.exp(-(angle * angle) / (2 * sigma * sigma));
}

// --- environments ------------------------------------------------------------

/** Neutral soft studio: dim zenith, bright working band, two softboxes. */
function studioPixel(dir) {
  const y = dir[1];
  const zenith = 0.12;
  const horizon = 0.5;
  const floor = 0.3;
  // Continuous at the horizon: sky falls horizon→zenith, ground horizon→floor
  // (reaching floor well above the nadir, so the work band stays bright).
  const sky = horizon + (zenith - horizon) * smoothstep(y);
  const ground = horizon + (floor - horizon) * Math.min(1, smoothstep(-y) * 1.6);
  const level = y >= 0 ? sky : ground;
  const base = [level, level * 1.0, level * 1.04];
  // Two softboxes: one warm-white high front-left, one cool-white lower right.
  const softboxA = softbox(dir, azimuth(40), 0.45, 0.28, [1.0, 0.96, 0.9], 7);
  const softboxB = softbox(dir, azimuth(-75), 0.1, 0.35, [0.92, 0.96, 1.0], 4);
  return [
    base[0] + softboxA[0] + softboxB[0],
    base[1] + softboxA[1] + softboxB[1],
    base[2] + softboxA[2] + softboxB[2],
  ];
}

function softbox(dir, az, el, sigma, tint, peak) {
  const blobDir = [
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
  ];
  const d =
    blob(dir[0] * blobDir[0] + dir[1] * blobDir[1] + dir[2] * blobDir[2], sigma) * peak;
  return [d * tint[0], d * tint[1], d * tint[2]];
}

/** Warm horizon / cool zenith gradient with a low sun. */
function sunsetPixel(dir) {
  const [, y] = dir;
  const zenith = [0.06, 0.1, 0.28]; // deep cool blue
  const horizon = [1.3, 0.55, 0.16]; // warm orange band
  const floor = [0.18, 0.1, 0.07]; // dark warm ground
  const t = smoothstep((y + 0.08) / 1.16); // 0 below horizon, 1 at zenith
  const band = Math.exp(-(y * y) / 0.08); // tight glow around the horizon
  const r = floor[0] + (horizon[0] * band + zenith[0]) * t;
  const g = floor[1] + (horizon[1] * band + zenith[1]) * t;
  const b = floor[2] + (horizon[2] * band + zenith[2]) * t;
  // Sun: small bright disc + wide warm glow, sitting slightly above horizon.
  const az = azimuth(115);
  const sunDir = [Math.cos(0.12) * Math.cos(az), Math.sin(0.12), Math.cos(0.12) * Math.sin(az)];
  const dot = dir[0] * sunDir[0] + dir[1] * sunDir[1] + dir[2] * sunDir[2];
  const disc = blob(dot, 0.035) * 45;
  const glow = blob(dot, 0.3) * 1.4;
  return [r + (disc + glow) * 1.0, g + (disc + glow) * 0.72, b + (disc + glow) * 0.45];
}

const azimuth = (deg) => (deg * Math.PI) / 180;

// --- RADIANCE writer ----------------------------------------------------------

const HEADER =
  `#?RADIANCE\n` +
  `# procedural asset - phalanx-engine scripts/gen-env-hdr.mjs (do not edit)\n` +
  `FORMAT=32-bit_rle_rgbe\n` +
  `\n` +
  `-Y ${H} +X ${W}\n`;

function clampByte(v) {
  return clamp(Math.round(v), 0, 255);
}

/** Shared-exponent RGBE encoding of one pixel (see file comment for the math). */
function encodePixel(rgb, out, o) {
  const maxv = Math.max(rgb[0], rgb[1], rgb[2]);
  const E = maxv > 0 ? Math.max(0, Math.ceil(Math.log2(maxv))) : 0;
  const scale = 255 / 2 ** E;
  out[o] = clampByte(rgb[0] * scale);
  out[o + 1] = clampByte(rgb[1] * scale);
  out[o + 2] = clampByte(rgb[2] * scale);
  out[o + 3] = E + 128;
}

function generateHdri(name, pixelFn) {
  const headerBytes = Buffer.from(HEADER, 'latin1');
  const pixels = Buffer.alloc(W * H * 4);
  let peak = 0;
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const rgb = pixelFn(direction(x, y));
      peak = Math.max(peak, rgb[0], rgb[1], rgb[2]);
      encodePixel(rgb, pixels, o);
      o += 4;
    }
  }
  if (peak >= 65504) {
    throw new Error(`${name}: peak radiance ${peak} exceeds the half-float ceiling 65504`);
  }
  // Flat-scanline guard (HDRLoader RGBE_ReadPixels_RLE): a first pixel of
  // (R=2, G=2, B>=128) would make the loader misparse the flat file as RLE.
  if (pixels[0] === 2 && pixels[1] === 2 && (pixels[2] & 0x80) !== 0) {
    pixels[2] -= 1; // one mantissa step (<0.8% of the channel value): visually nil
    if (pixels[2] >= 128) {
      throw new Error(`${name}: first pixel still collides with the RLE magic`);
    }
  }
  const file = Buffer.concat([headerBytes, pixels]);
  writeFileSync(resolve(OUT_DIR, name), file);
  console.log(`${name}: ${W}x${H}, ${(file.byteLength / 1024).toFixed(1)} KiB, peak ${peak.toFixed(2)}`);
}

// --- verification (re-read what was written) -----------------------------------

function verifyHdri(name) {
  const file = readFileSync(resolve(OUT_DIR, name));
  const text = file.toString('latin1');
  if (!text.startsWith('#?RADIANCE\n')) {
    throw new Error(`${name}: missing #?RADIANCE magic`);
  }
  if (!text.includes('FORMAT=32-bit_rle_rgbe\n')) {
    throw new Error(`${name}: missing FORMAT=32-bit_rle_rgbe`);
  }
  const match = text.match(/^-Y (\d+) \+X (\d+)\n/m);
  if (!match) {
    throw new Error(`${name}: unparseable dimensions line`);
  }
  const h = Number(match[1]);
  const w = Number(match[2]);
  const pixelOffset = text.indexOf('\n', text.indexOf(match[0])) + 1;
  if (h !== H || w !== W) {
    throw new Error(`${name}: dimensions ${w}x${h}, expected ${W}x${H}`);
  }
  if (file.byteLength !== pixelOffset + w * h * 4) {
    throw new Error(
      `${name}: size ${file.byteLength} != header ${pixelOffset} + ${w * h * 4} pixels`,
    );
  }
  const first = file.subarray(pixelOffset, pixelOffset + 3);
  if (first[0] === 2 && first[1] === 2 && (first[2] & 0x80) !== 0) {
    throw new Error(`${name}: first pixel collides with the RLE magic`);
  }
  console.log(`${name}: verified (magic, FORMAT, ${w}x${h}, exact payload size, flat-scanline safe)`);
}

// --- entry ----------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
generateHdri('studio.hdr', studioPixel);
generateHdri('sunset.hdr', sunsetPixel);
verifyHdri('studio.hdr');
verifyHdri('sunset.hdr');
