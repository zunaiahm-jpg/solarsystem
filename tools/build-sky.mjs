/**
 * Converts the NASA SVS "Deep Star Map 2020" HDR panorama (OpenEXR, linear
 * radiance) into a gamma-encoded 8K JPEG that the sky dome shader can sample.
 *
 * The runtime shader re-linearises with pow(texel, 2.2), so this script must
 * emit sRGB-ish encoded values, not linear ones.
 *
 * Usage: node --max-old-space-size=8192 tools/build-sky.mjs <input.exr> <output.jpg>
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: build-sky.mjs <input.exr> <output.jpg>');
  process.exit(1);
}

const fileBuffer = fs.readFileSync(inputPath);
const arrayBuffer = fileBuffer.buffer.slice(
  fileBuffer.byteOffset,
  fileBuffer.byteOffset + fileBuffer.byteLength
);

const parsed = new EXRLoader().parse(arrayBuffer);
const { width, height } = parsed;
console.log(`[sky] decoded ${width}x${height} (${parsed.data.constructor.name})`);

// EXRLoader hands back HalfFloatType as a Uint16Array of raw IEEE 754 binary16
// bit patterns. Those must be widened to real floats before any arithmetic,
// otherwise every sample is read as a meaningless integer.
const HALF_FLOAT_LOOKUP = (() => {
  const table = new Float32Array(65536);
  const view = new DataView(new ArrayBuffer(4));
  for (let bits = 0; bits < 65536; bits++) {
    const sign = (bits & 0x8000) << 16;
    let exponent = (bits & 0x7c00) >> 10;
    let mantissa = bits & 0x03ff;
    if (exponent === 0x1f) {
      exponent = 0xff; // Inf / NaN
    } else if (exponent === 0) {
      if (mantissa !== 0) {
        // Subnormal half -> normalised single.
        let shift = 0;
        while ((mantissa & 0x0400) === 0) {
          mantissa <<= 1;
          shift++;
        }
        mantissa &= 0x03ff;
        exponent = 127 - 15 - shift;
      }
    } else {
      exponent = exponent - 15 + 127;
    }
    view.setUint32(0, sign | (exponent << 23) | (mantissa << 13));
    table[bits] = view.getFloat32(0);
  }
  return table;
})();

// Widening all 134M samples into a second typed array exhausts the heap, so
// the half-float lookup is applied per sample as the buffer is streamed.
const raw = parsed.data;
const isHalf = raw instanceof Uint16Array;
const sampleAt = isHalf ? index => HALF_FLOAT_LOOKUP[raw[index]] : index => raw[index];

const pixelCount = width * height;

// Auto-expose: anchor the 99.9th percentile of luminance near white so the
// Milky Way keeps its structure without blowing out the bright star cores.
const luminanceSamples = new Float32Array(Math.ceil(pixelCount / 97));
let sampleIndex = 0;
for (let pixel = 0; pixel < pixelCount && sampleIndex < luminanceSamples.length; pixel += 97) {
  const offset = pixel * 4;
  luminanceSamples[sampleIndex++] =
    0.2126 * sampleAt(offset) + 0.7152 * sampleAt(offset + 1) + 0.0722 * sampleAt(offset + 2);
}
const sorted = luminanceSamples.subarray(0, sampleIndex).slice().sort();
const percentile = sorted[Math.floor(sorted.length * 0.999)] || 1;
const exposure = 1 / Math.max(percentile, 1e-6);
console.log(`[sky] p99.9 luminance ${percentile.toExponential(3)} -> exposure x${exposure.toFixed(2)}`);

const INV_GAMMA = 1 / 2.2;
const rgb = Buffer.allocUnsafe(pixelCount * 3);

for (let pixel = 0; pixel < pixelCount; pixel++) {
  const source = pixel * 4;
  const target = pixel * 3;
  for (let channel = 0; channel < 3; channel++) {
    // Exposure, then a soft Reinhard shoulder so bright stars roll off
    // instead of clipping to flat white discs.
    const exposed = Math.max(sampleAt(source + channel), 0) * exposure;
    const toned = exposed / (1 + exposed);
    const encoded = Math.pow(toned, INV_GAMMA);
    rgb[target + channel] = Math.max(0, Math.min(255, Math.round(encoded * 255)));
  }
}

await sharp(rgb, { raw: { width, height, channels: 3 } })
  .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
  .toFile(outputPath);

const { size } = fs.statSync(outputPath);
console.log(`[sky] wrote ${outputPath} — ${(size / 1048576).toFixed(1)} MB`);
