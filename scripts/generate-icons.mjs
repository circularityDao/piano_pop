// scripts/generate-icons.mjs
// Generate PWA raster icons (PNG) from a simple procedural drawing, with NO
// native/3rd-party deps (no sharp/canvas) so it runs anywhere Node runs.
//
// Lighthouse / installability want PNG 192 + 512 plus a maskable 512. We render
// the Piano-Pop motif (pink→magenta gradient rounded square + a white note
// circle) directly to an RGBA buffer and encode a valid PNG using only
// node:zlib. The crisp SVG (icon.svg) remains the primary scalable icon; these
// PNGs satisfy stores/Lighthouse that still expect rasters.
//
// Run: node scripts/generate-icons.mjs   (or: npm run icons)

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "apps", "web", "public", "icons");

// ---- minimal PNG encoder (truecolor + alpha, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // filtered raw: one filter byte (0) per scanline
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing helpers ----
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}
const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function drawIcon(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const sky1 = hexToRgb("#d79bff");
  const sky2 = hexToRgb("#ff93d2");
  const note1 = hexToRgb("#ff5fb6");
  const note2 = hexToRgb("#d6359a");
  // maskable: keep art in the inner 80% safe zone (no rounded corners; the
  // launcher applies its own mask). standard: rounded square with transparent
  // corners.
  const radius = maskable ? 0 : Math.round(size * 0.22);
  const cx = size / 2;
  const cy = size / 2;
  const noteR = size * (maskable ? 0.30 : 0.235);
  const ringR = noteR + size * 0.027;

  const inRoundedRect = (x, y) => {
    if (radius === 0) return true;
    const rx = Math.min(x, size - 1 - x);
    const ry = Math.min(y, size - 1 - y);
    if (rx >= radius || ry >= radius) return true;
    const dx = radius - rx;
    const dy = radius - ry;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRoundedRect(x, y)) {
        buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
        continue;
      }
      const ty = y / (size - 1);
      let r = lerp(sky1[0], sky2[0], ty);
      let g = lerp(sky1[1], sky2[1], ty);
      let b = lerp(sky1[2], sky2[2], ty);
      const d = Math.hypot(x - cx, y - cy);
      if (d <= noteR) {
        const nt = (y - (cy - noteR)) / (2 * noteR);
        r = lerp(note1[0], note2[0], nt);
        g = lerp(note1[1], note2[1], nt);
        b = lerp(note1[2], note2[2], nt);
      } else if (d <= ringR) {
        // white ring around the note
        r = g = b = 255;
      }
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function write(name, size, opts) {
  const png = encodePNG(size, size, drawIcon(size, opts));
  writeFileSync(join(OUT, name), png);
  console.log(`wrote ${name} (${size}x${size}, ${png.length}B)`);
}

mkdirSync(OUT, { recursive: true });
write("pwa-192x192.png", 192, { maskable: false });
write("pwa-512x512.png", 512, { maskable: false });
write("maskable-512x512.png", 512, { maskable: true });
console.log("icons generated in", OUT);
