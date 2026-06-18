// scripts/decode-bundle.mjs
// Phase-0 step 1 / plan §3-D1: recover the REAL source from the standalone bundle.
//
// The standalone file `Piano_Pop_(standalone).html` (note the literal parentheses
// and underscores in the name — always quote it) embeds three JSON <script> blocks:
//   <script type="__bundler/manifest">      -> { uuid: { data:<base64>, compressed, mime } }
//   <script type="__bundler/ext_resources"> -> [ { id, uuid } ]
//   <script type="__bundler/template">      -> JSON string of the real index.html,
//                                              with every asset referenced by its uuid
//
// Each manifest asset is base64 -> (optional) gunzip -> bytes. We reproduce the
// loader's exact path: base64 -> DecompressionStream('gzip') -> text/bytes
// (with a zlib fallback if DecompressionStream is unavailable), then dump the real
// recovered source, the inline <style> CSS, and the 3 Fredoka woff2 fonts into
// recovered/. This is the fidelity anchor: we transliterate verified source, we do
// not eyeball/reinvent the game.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUNDLE = join(ROOT, "Piano_Pop_(standalone).html");
const OUT = join(ROOT, "recovered");

function extractScript(html, type) {
  // The blocks are large; match the specific type non-greedily up to its close tag.
  const re = new RegExp(
    `<script type="__bundler/${type}">([\\s\\S]*?)<\\/script>`
  );
  const m = html.match(re);
  if (!m) throw new Error(`missing __bundler/${type} block`);
  return m[1].trim();
}

// base64 -> Uint8Array
function b64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

// gunzip via DecompressionStream('gzip') exactly like the runtime loader,
// falling back to node:zlib if the stream API is unavailable.
async function gunzip(bytes) {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(bytes);
    writer.close();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
  // Fallback path (plan §3-D1 fallback): node's zlib.
  return new Uint8Array(gunzipSync(Buffer.from(bytes)));
}

// Choose a sensible file extension/subdir for a recovered asset by mime.
function extFor(mime) {
  switch (mime) {
    case "text/javascript":
    case "application/javascript":
      return "js";
    case "text/jsx":
      return "jsx";
    case "text/css":
      return "css";
    case "font/woff2":
      return "woff2";
    case "image/svg+xml":
      return "svg";
    case "text/html":
      return "html";
    default:
      return "bin";
  }
}

async function main() {
  const html = readFileSync(BUNDLE, "utf8");

  const manifest = JSON.parse(extractScript(html, "manifest"));
  let template = JSON.parse(extractScript(html, "template"));
  let extResources = [];
  try {
    extResources = JSON.parse(extractScript(html, "ext_resources"));
  } catch {
    /* ext_resources is optional */
  }

  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, "modules"), { recursive: true });
  mkdirSync(join(OUT, "fonts"), { recursive: true });

  // ext_resources maps a logical id -> uuid; use it to name modules nicely.
  const idByUuid = {};
  for (const r of extResources) idByUuid[r.uuid] = r.id;

  const index = [];
  const uuids = Object.keys(manifest);
  let fontN = 0;
  for (const uuid of uuids) {
    const entry = manifest[uuid];
    let bytes = b64ToBytes(entry.data);
    if (entry.compressed) bytes = await gunzip(bytes);

    const ext = extFor(entry.mime);
    let outPath;
    if (ext === "woff2") {
      outPath = join(OUT, "fonts", `fredoka-${++fontN}.woff2`);
      writeFileSync(outPath, Buffer.from(bytes));
    } else {
      const logical = idByUuid[uuid];
      const base = logical
        ? logical.replace(/[^\w.-]+/g, "_")
        : `${uuid}.${ext}`;
      const name = base.includes(".") ? base : `${base}.${ext}`;
      outPath = join(OUT, "modules", name);
      writeFileSync(outPath, Buffer.from(bytes));
    }
    const text = ext === "woff2" ? "" : Buffer.from(bytes).toString("utf8");
    index.push({
      uuid,
      mime: entry.mime,
      compressed: !!entry.compressed,
      bytes: bytes.length,
      id: idByUuid[uuid] || null,
      file: outPath.replace(ROOT + "/", ""),
      // a cheap fingerprint so a human can eyeball what each module is
      head: text.slice(0, 120).replace(/\s+/g, " "),
    });
    console.log(
      `decoded ${uuid}  ${entry.mime.padEnd(24)} ${String(bytes.length).padStart(8)}B -> ${outPath.replace(ROOT + "/", "")}`
    );
  }

  // Dump the real index.html template (uuids still as placeholders) — this block
  // holds the inline <style> with the ~153-rule pixel-faithful stylesheet.
  writeFileSync(join(OUT, "index-template.html"), template);

  // Pull every inline <style> out of the template. The template carries two:
  //   [0] the @font-face declarations (Fredoka, all weights)
  //   [1] the ~153-rule game stylesheet (:root vars, .keyboard, .tile, keyframes…)
  // Both are the pixel-faithful source of truth for the port.
  const styleBlocks = [...template.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
    (m) => m[1].trim()
  );
  styleBlocks.forEach((css, i) => {
    const name = i === 0 ? "styles-fonts.css" : "styles-game.css";
    writeFileSync(join(OUT, name), css);
  });

  writeFileSync(
    join(OUT, "manifest-index.json"),
    JSON.stringify(index, null, 2)
  );
  console.log(`\nrecovered ${uuids.length} assets into ${OUT}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
