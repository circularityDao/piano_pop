// YouTube → MIDI → Piano Pop song, end to end.
//
// Pipeline:
//   1. yt-dlp            download the video's audio track  (--clip trims it)
//   2. basic-pitch       transcribe that audio to a .mid   (Spotify's AMT model)
//   3. parse-midi.mjs    split the .mid into player melody + auto-played backing
//                        and emit apps/web/src/songs/builtin/<id>.ts
//   4. registry.ts       register the new song so it shows up in the menu
//
// This is a LOCAL AUTHORING TOOL (like parse-midi.mjs) — it is NOT wired into
// the shipping PWA, and `sources/youtubeSource.ts` stays disabled. You are
// responsible for having the rights to whatever you import (same as the hand-
// added Golden MIDI). Audio transcription of a full mix is approximate: expect
// to tune --min-midi / --clip and to hand-edit the generated melody.
//
// Setup (one time):
//   brew install yt-dlp ffmpeg
//   node scripts/youtube-to-midi.mjs --setup     # creates scripts/.venv + basic-pitch
//
// Usage:
//   node scripts/youtube-to-midi.mjs <youtube-url> --id mysong --title "My Song"
//   node scripts/youtube-to-midi.mjs <url> --id chorus --clip 1:02-1:34 --difficulty 3
//   node scripts/youtube-to-midi.mjs --audio path/to/local.wav --id demo --title Demo
//
// Flags:
//   --id <slug>          song id / module name (default: slug of the title)
//   --title <str>        menu title           (default: the video title)
//   --subtitle <str>     menu subtitle        (default: "via YouTube")
//   --difficulty <1-3>   menu difficulty dots (default: 2)
//   --clip <a-b>         only transcribe a section, e.g. 0:30-1:05 or 30-65
//   --min-midi <n>       melody pitch floor   (default: 60 = C4, keyboard bottom)
//   --beat-ms <n>        ms per beat          (default: derived from MIDI tempo)
//   --audio <file>       skip YouTube, transcribe a local audio file
//   --keep-audio         keep the downloaded/working audio
//   --no-fold            don't octave-fold melody into the C4..B6 keyboard
//   --no-register        write the song module but don't touch registry.ts
//   --midi-only          stop after producing the .mid (no .ts, no registry)
//   --setup              create scripts/.venv and install basic-pitch, then exit

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPTS_DIR, "..");
const VENV = join(SCRIPTS_DIR, ".venv");
const VENV_PY = join(VENV, "bin", "python");
const VENV_BASIC_PITCH = join(VENV, "bin", "basic-pitch");
const BUILTIN_DIR = join(ROOT, "apps/web/src/songs/builtin");
const REGISTRY = join(ROOT, "apps/web/src/songs/registry.ts");
const CACHE = join(SCRIPTS_DIR, ".cache", "yt2midi");

// Homebrew bins (yt-dlp, ffmpeg) aren't always on a non-login shell PATH.
process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`;

// ---- tiny arg parser ----
const argv = process.argv.slice(2);
const opts = {};
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const boolean = ["keep-audio", "no-fold", "no-register", "midi-only", "setup", "help"];
    if (boolean.includes(key)) opts[key] = true;
    else opts[key] = argv[++i];
  } else positionals.push(a);
}

const die = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};
const log = (msg) => console.log(msg);

function run(cmd, args, { capture = false, allowFail = false, env } = {}) {
  const r = spawnSync(cmd, args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (r.error) {
    if (allowFail) return { ok: false, stdout: "" };
    die(`failed to launch ${cmd}: ${r.error.message}`);
  }
  if (r.status !== 0 && !allowFail) die(`${cmd} exited with code ${r.status}`);
  return { ok: r.status === 0, stdout: r.stdout || "" };
}

const has = (bin) => run("command", ["-v", bin], { capture: true, allowFail: true }).ok ||
  spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8" }).status === 0;

// ---- --setup: build the venv + install basic-pitch ----
function setup() {
  log("• Creating Python venv at scripts/.venv …");
  run("python3", ["-m", "venv", VENV]);
  log("• Upgrading pip …");
  run(VENV_PY, ["-m", "pip", "install", "--quiet", "--upgrade", "pip"]);
  log("• Installing basic-pitch[onnx] (this downloads the model + runtime, ~1–2 min) …");
  run(VENV_PY, ["-m", "pip", "install", "basic-pitch[onnx]"]);
  // Pin two transitive deps that broke basic-pitch on Python 3.12:
  //   setuptools<81 — basic-pitch→resampy imports pkg_resources (gone in 81+)
  //   scipy<1.13     — note_creation uses scipy.signal.gaussian (removed in 1.13)
  log("• Pinning compatible setuptools/scipy …");
  run(VENV_PY, ["-m", "pip", "install", "--quiet", "setuptools<81", "scipy<1.13"]);
  const ok = existsSync(VENV_BASIC_PITCH);
  log(ok ? "\n✔ Setup complete." : "\n✖ basic-pitch not found after install.");
  if (!has("yt-dlp") || !has("ffmpeg")) {
    log("⚠ Also run: brew install yt-dlp ffmpeg");
  }
  process.exit(ok ? 0 : 1);
}

if (opts.help) {
  log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n").replace(/^\/\/ ?/gm, ""));
  process.exit(0);
}
if (opts.setup) setup();

// ---- dependency check ----
const missing = [];
if (!opts.audio && !has("yt-dlp")) missing.push("yt-dlp (brew install yt-dlp)");
if (!has("ffmpeg")) missing.push("ffmpeg (brew install ffmpeg)");
if (!existsSync(VENV_BASIC_PITCH)) missing.push("basic-pitch (node scripts/youtube-to-midi.mjs --setup)");
if (missing.length) die(`Missing dependencies:\n  - ${missing.join("\n  - ")}`);

// ---- resolve inputs ----
const url = positionals[0];
if (!url && !opts.audio) die("Pass a YouTube URL (or --audio <file>). See --help.");

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "song";

// Fetch the YouTube title up front (defaults for title/id) unless given both.
let videoTitle = opts.title;
if (url && (!opts.title || !opts.id)) {
  log("• Fetching video title …");
  const r = run("yt-dlp", ["--no-warnings", "--skip-download", "--print", "%(title)s", url], {
    capture: true,
    allowFail: true,
  });
  videoTitle = opts.title || r.stdout.trim() || "Untitled";
}
const title = opts.title || videoTitle || "Untitled";
const id = slug(opts.id || title);
const subtitle = opts.subtitle || "via YouTube";
const difficulty = opts.difficulty || "2";
const minMidi = opts["min-midi"] || "60";

const work = join(CACHE, id);
mkdirSync(work, { recursive: true });

// ---- step 1: get audio ----
let audioPath;
if (opts.audio) {
  audioPath = resolve(opts.audio);
  if (!existsSync(audioPath)) die(`audio file not found: ${audioPath}`);
  log(`• Using local audio: ${audioPath}`);
} else {
  log(`\n• [1/4] Downloading audio for "${title}" …`);
  const ytArgs = [
    "-x",
    "--audio-format",
    "wav",
    "--audio-quality",
    "0",
    "-o",
    join(work, "audio.%(ext)s"),
  ];
  if (opts.clip) {
    // accept 1:02-1:34 or 62-94; hand to yt-dlp's *start-end section syntax
    ytArgs.push("--download-sections", `*${opts.clip}`, "--force-keyframes-at-cuts");
  }
  ytArgs.push(url);
  run("yt-dlp", ytArgs);
  audioPath = join(work, "audio.wav");
  if (!existsSync(audioPath)) die("yt-dlp finished but audio.wav is missing.");
}

// ---- step 2: transcribe to MIDI ----
log(`\n• [2/4] Transcribing audio → MIDI with basic-pitch …`);
// Force the ONNX model: the venv also has TensorFlow, whose auto-selected
// SavedModel fails to load on TF 2.16, while nmp.onnx loads cleanly.
run(VENV_BASIC_PITCH, [work, audioPath, "--model-serialization", "onnx"], { allowFail: false });
// basic-pitch writes <stem>_basic_pitch.mid into the output dir.
const mid = readdirSync(work).find((f) => f.endsWith("_basic_pitch.mid"));
if (!mid) die("basic-pitch produced no .mid (check the log above).");
const midiPath = join(work, `${id}.mid`);
copyFileSync(join(work, mid), midiPath);
log(`  → ${midiPath}`);

if (opts["midi-only"]) {
  log(`\n✔ MIDI ready: ${midiPath}`);
  log(`  Next: node scripts/parse-midi.mjs "${midiPath}" all ${minMidi} ts > apps/web/src/songs/builtin/${id}.ts`);
  process.exit(0);
}

// ---- step 3: MIDI → song module ----
log(`\n• [3/4] Building song module apps/web/src/songs/builtin/${id}.ts …`);
const env = {
  SONG_ID: id,
  SONG_TITLE: title,
  SONG_SUBTITLE: subtitle,
  SONG_DIFFICULTY: String(difficulty),
  SONG_FOLD: opts["no-fold"] ? "0" : "1",
};
if (opts["beat-ms"]) env.SONG_BEATMS = String(opts["beat-ms"]);
const ts = run("node", [join(SCRIPTS_DIR, "parse-midi.mjs"), midiPath, "all", String(minMidi), "ts"], {
  capture: true,
  env,
});
if (!ts.stdout.trim()) die("parse-midi.mjs produced no output.");
const tsPath = join(BUILTIN_DIR, `${id}.ts`);
writeFileSync(tsPath, ts.stdout);
log(`  → ${tsPath}`);

// quick sanity: how many tiles / backing notes did we get?
const tiles = (ts.stdout.match(/\["[A-G]/g) || []).length;
log(`  (${tiles} player tiles parsed)`);

// ---- step 4: register the song ----
const ident = id.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[0-9]/, "_$&");
if (opts["no-register"]) {
  log(`\n• [4/4] Skipped registry edit (--no-register). Add manually:`);
  log(`    import { ${ident} } from "./builtin/${id}";  // then add ${ident} to SONGS + SONG_LIST`);
} else {
  log(`\n• [4/4] Registering "${id}" in registry.ts …`);
  let reg = readFileSync(REGISTRY, "utf8");
  if (reg.includes(`from "./builtin/${id}"`)) {
    log("  (already registered — left as is)");
  } else {
    const lines = reg.split("\n");
    let lastImport = -1;
    lines.forEach((l, i) => {
      if (/from "\.\/builtin\//.test(l)) lastImport = i;
    });
    lines.splice(lastImport + 1, 0, `import { ${ident} } from "./builtin/${id}";`);
    reg = lines.join("\n");
    const addToList = (re, open, close, entry) =>
      reg.replace(re, (_, a, inner) => {
        const items = inner.split(",").map((s) => s.trim()).filter(Boolean);
        if (!items.includes(entry)) items.push(entry);
        return `${a}${open}${items.join(", ")}${close}`;
      });
    // SONGS is keyed by the song's `id` (App does SONGS[selectedSongId]); an id
    // like "turkish-march" is NOT a valid identifier, so use an explicit
    // "<id>": <ident> entry whenever they differ. SONG_LIST is just the objects.
    const songsEntry = id === ident ? ident : `"${id}": ${ident}`;
    reg = addToList(/(export const SONGS: Record<string, Song> = )\{([^}]*)\}/, "{ ", " }", songsEntry);
    reg = addToList(/(export const SONG_LIST: Song\[\] = )\[([^\]]*)\]/, "[", "]", ident);
    writeFileSync(REGISTRY, reg);
    log("  ✓ added import + SONGS + SONG_LIST entries");
  }
}

if (!opts["keep-audio"] && !opts.audio) {
  // leave the .mid + .ts; the big wav is the only heavy artifact
  try {
    run("rm", ["-f", join(work, "audio.wav")], { allowFail: true });
  } catch {}
}

log(`\n✔ Done. "${title}" is now a song.`);
log(`  • MIDI:   ${midiPath}`);
log(`  • Module: apps/web/src/songs/builtin/${id}.ts`);
log(`  Run \`npm run dev\` and pick it from the menu.`);
log(`  Tweak: re-run parse-midi.mjs with a different --min-midi, or hand-edit the melody array.`);
