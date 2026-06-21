// Render a .mid to a .wav so you can audition it (the OS has no built-in MIDI
// player). Uses the youtube-to-midi venv's pretty_midi.
//
//   node scripts/midi-to-wav.mjs <file.mid> [--soundfont path.sf2] [--no-open]
//
// Default is sine synthesis (no extra downloads) — thin/organ-like but it
// reveals exactly which notes/timing were transcribed. For piano-quality sound,
// `brew install fluid-synth`, grab a General-MIDI soundfont (e.g. FluidR3_GM),
// and pass --soundfont path/to.sf2 (rendered via fluidsynth instead).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const VENV_PY = join(SCRIPTS_DIR, ".venv", "bin", "python");
process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}`;

const argv = process.argv.slice(2);
const mid = argv.find((a) => !a.startsWith("--"));
const sf = argv[argv.indexOf("--soundfont") + 1];
const noOpen = argv.includes("--no-open");

if (!mid) {
  console.error("usage: node scripts/midi-to-wav.mjs <file.mid> [--soundfont path.sf2] [--no-open]");
  process.exit(1);
}
if (!existsSync(mid)) {
  console.error(`✖ not found: ${mid}`);
  process.exit(1);
}
const out = mid.replace(/\.midi?$/i, "") + ".wav";

if (sf && argv.includes("--soundfont")) {
  // piano-quality path via fluidsynth + a General-MIDI soundfont
  const r = spawnSync("fluidsynth", ["-ni", "-F", out, "-r", "44100", sf, mid], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
} else {
  if (!existsSync(VENV_PY)) {
    console.error("✖ venv missing — run: npm run yt2midi:setup");
    process.exit(1);
  }
  const py = `
import sys, numpy as np, pretty_midi
from scipy.io import wavfile
pm = pretty_midi.PrettyMIDI(sys.argv[1])
print(f"notes={sum(len(i.notes) for i in pm.instruments)} duration={pm.get_end_time():.1f}s")
a = pm.synthesize(fs=44100)
a = (a / (np.max(np.abs(a)) or 1) * 0.9 * 32767).astype(np.int16)
wavfile.write(sys.argv[2], 44100, a)
`;
  const r = spawnSync(VENV_PY, ["-c", py, mid, out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`✔ wrote ${out}`);
if (!noOpen) spawnSync("open", [out]);
