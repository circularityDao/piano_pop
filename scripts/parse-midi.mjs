// MIDI importer for Piano Pop songs. Minimal SMF parser: reads header
// (division), walks every track, collects note-on/off + tempo. Then splits the
// performance into:
//   - the PLAYER melody: the monophonic top line at/above a pitch floor
//     (default C4, the bottom of the game keyboard), as [noteName, beats]
//   - the ACCOMPANIMENT: everything else (left-hand bass + chord inner voices),
//     as [midi, beat, beats] on the SAME absolute beat grid, played for the
//     player automatically so melody + backing == the original song.
//
// Usage:
//   node scripts/parse-midi.mjs <file.mid> [track|all] [minMidi] [summary|ts]
// Default mode prints a summary + both tracks; `ts` prints a ready golden.ts.
//
// Not shipped — analysis/import tool.

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/parse-midi.mjs <file.mid> [track|all] [minMidi] [summary|ts]");
  process.exit(1);
}
const onlyTrack =
  process.argv[3] && process.argv[3] !== "all" ? parseInt(process.argv[3], 10) : null;
const minMidi = process.argv[4] != null ? parseInt(process.argv[4], 10) : 60;
const mode = process.argv[5] || "summary";
const buf = readFileSync(path);

let pos = 0;
const u32 = () => {
  const v = buf.readUInt32BE(pos);
  pos += 4;
  return v;
};
const u16 = () => {
  const v = buf.readUInt16BE(pos);
  pos += 2;
  return v;
};
const u8 = () => buf[pos++];
const varlen = () => {
  let v = 0,
    b;
  do {
    b = buf[pos++];
    v = (v << 7) | (b & 0x7f);
  } while (b & 0x80);
  return v;
};

// ---- header ----
if (buf.toString("ascii", 0, 4) !== "MThd") throw new Error("not a MIDI file");
pos = 4;
u32(); // header length
const format = u16();
const ntracks = u16();
const division = u16(); // ticks per quarter note (assume not SMPTE)

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteName = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);

let tempoUsPerQuarter = 500000; // default 120bpm
const tempos = [];
const notes = []; // {tick, dur, midi, track}

for (let t = 0; t < ntracks; t++) {
  if (buf.toString("ascii", pos, pos + 4) !== "MTrk") break;
  pos += 4;
  const len = u32();
  const end = pos + len;
  let tick = 0;
  let running = null;
  const on = new Map(); // midi -> startTick (last)
  while (pos < end) {
    tick += varlen();
    let status = buf[pos];
    if (status & 0x80) {
      pos++;
      running = status;
    } else {
      status = running; // running status
    }
    if (status === 0xff) {
      const meta = u8();
      const mlen = varlen();
      if (meta === 0x51) {
        tempoUsPerQuarter = (buf[pos] << 16) | (buf[pos + 1] << 8) | buf[pos + 2];
        tempos.push({ tick, us: tempoUsPerQuarter });
      }
      pos += mlen;
    } else if (status === 0xf0 || status === 0xf7) {
      const slen = varlen();
      pos += slen;
    } else {
      const cmd = status & 0xf0;
      const d1 = u8();
      let d2 = 0;
      if (cmd !== 0xc0 && cmd !== 0xd0) d2 = u8();
      if (cmd === 0x90 && d2 > 0) {
        on.set(d1, tick);
      } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
        const start = on.get(d1);
        if (start != null) {
          notes.push({ tick: start, dur: tick - start, midi: d1, track: t });
          on.delete(d1);
        }
      }
    }
  }
  pos = end;
}

notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);

const q = division; // ticks per beat (quarter)
const round4 = (x) => Math.round(x * 4) / 4; // snap to 1/4 beat
const bpm = Math.round(60000000 / tempoUsPerQuarter);

const trackSel = onlyTrack != null ? notes.filter((n) => n.track === onlyTrack) : notes;
const src = trackSel.filter((n) => n.midi >= minMidi); // melody candidates

// ---- player melody: highest pitch per onset, monophonic ----
const byTick = new Map();
for (const n of src) {
  const g = byTick.get(n.tick) || [];
  g.push(n);
  byTick.set(n.tick, g);
}
const onsets = [...byTick.keys()].sort((a, b) => a - b);
const mono = onsets.map((tk) => {
  const g = byTick.get(tk).slice().sort((a, b) => b.midi - a.midi);
  return { tick: tk, midi: g[0].midi, dur: g[0].dur };
});

const t0 = mono.length ? mono[0].tick : 0; // melody starts at beat 0
const qOnset = (tick) => round4((tick - t0) / q); // quantized absolute beat

// Optional: fold each player-melody pitch into the game keyboard (C4..B6 =
// MIDI 60..95) by octave shifts so every tile lands on a real key. Off by
// default (faithful); youtube-to-midi.mjs turns it on via SONG_FOLD=1 because
// raw audio transcriptions routinely stray above B6.
const foldMelody = process.env.SONG_FOLD === "1";
const foldMidi = (m) => {
  while (m < 60) m += 12;
  while (m > 95) m -= 12;
  return m;
};

// Melody durations as the difference of quantized onsets, so buildSong's
// cumulative beat telescopes EXACTLY onto qOnset() — the same grid the
// accompaniment uses. Last note keeps its own (quantized) duration.
const melody = mono.map((n, i) => {
  let beats;
  if (i + 1 < mono.length) beats = qOnset(mono[i + 1].tick) - qOnset(n.tick);
  else beats = Math.max(0.25, round4(n.dur / q));
  if (beats <= 0) beats = 0.25; // guard against two onsets snapping together
  return [noteName(foldMelody ? foldMidi(n.midi) : n.midi), beats];
});

// ---- accompaniment: every note that isn't the chosen melody note ----
const melodyKey = new Set(mono.map((n) => n.tick + ":" + n.midi));
const accomp = trackSel
  .filter((n) => !melodyKey.has(n.tick + ":" + n.midi))
  .map((n) => {
    let beat = qOnset(n.tick);
    if (beat < 0) beat = 0; // bass that precedes the first melody note
    const beats = Math.max(0.25, round4(n.dur / q));
    return [n.midi, beat, beats];
  })
  .sort((a, b) => a[1] - b[1] || a[0] - b[0]);

const melodyBeats = melody.reduce((s, m) => s + m[1], 0);
const accompEnd = accomp.reduce((mx, a) => Math.max(mx, a[1] + a[2]), 0);

if (mode === "ts") {
  // Song metadata is env-driven so scripts/youtube-to-midi.mjs (and manual
  // runs) can emit ANY song module; the defaults reproduce golden.ts.
  const id = process.env.SONG_ID || "golden";
  const title = process.env.SONG_TITLE || "Golden";
  const subtitle = process.env.SONG_SUBTITLE || "HUNTR/X · KPop Demon Hunters";
  const difficulty = process.env.SONG_DIFFICULTY
    ? parseInt(process.env.SONG_DIFFICULTY, 10)
    : 2;
  const beatMs = process.env.SONG_BEATMS
    ? parseInt(process.env.SONG_BEATMS, 10)
    : id === "golden"
      ? 560
      : Math.round(60000 / bpm); // derive tempo from the MIDI when not pinned
  // A valid JS identifier derived from the id (used as the var/export prefix).
  const ident = id.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[0-9]/, "_$&");
  const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const fmtMel = melody.map((m) => `["${m[0]}", ${m[1]}]`);
  const fmtAcc = accomp.map((a) => `[${a[0]}, ${a[1]}, ${a[2]}]`);
  const block = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 8) out.push("  " + arr.slice(i, i + 8).join(", ") + ",");
    return out.join("\n");
  };
  process.stdout.write(`// "${esc(title)}" — full song with backing track.
//
// Imported from a MIDI via scripts/parse-midi.mjs. We split the performance
// into:
//   - ${ident}Melody: the monophonic top line at/above C4 — the tiles the
//     player taps.
//   - ${ident}Backing: everything else (bass + chord inner voices), auto-played
//     by the engine so melody + backing == the original song.
// Both tracks share one quantized (1/4-beat) grid, so they stay in sync at any
// difficulty (beatScale/fallMs are applied per play).
//
// Regenerate with:
//   node scripts/parse-midi.mjs <file>.mid all ${minMidi} ts > apps/web/src/songs/builtin/${id}.ts

import type { AccompNote, Song } from "../schema";
import { buildSong } from "./twinkle";

// Player melody as [noteName, beats]; buildSong lays these out sequentially.
type M = [string, number];
const ${ident}Melody: M[] = [
${block(fmtMel)}
];

// Backing track as [midi, beat, beats] on the same absolute beat grid.
const ${ident}Backing: [number, number, number][] = [
${block(fmtAcc)}
];

const base = buildSong(
  {
    id: "${esc(id)}",
    title: "${esc(title)}",
    subtitle: "${esc(subtitle)}",
    difficulty: ${difficulty},
    beatMs: ${beatMs},
  },
  ${ident}Melody
);

const accompaniment: AccompNote[] = ${ident}Backing.map(([midi, beat, beats]) => ({
  midi,
  beat,
  beats,
}));

// Extend totalBeats so playback doesn't end before the backing track does.
const backingEnd = accompaniment.reduce((mx, a) => Math.max(mx, a.beat + a.beats), 0);

export const ${ident}: Song = {
  ...base,
  totalBeats: Math.max(base.totalBeats, backingEnd),
  accompaniment,
};
`);
} else {
  console.log(`format=${format} tracks=${ntracks} division=${division} ticks/quarter`);
  console.log(`tempo=${bpm} BPM (${tempoUsPerQuarter} us/quarter), tempo changes=${tempos.length}`);
  console.log(`total notes parsed=${notes.length}`);
  console.log("\n--- per-track ---");
  for (let t = 0; t < ntracks; t++) {
    const tn = notes.filter((n) => n.track === t);
    if (!tn.length) continue;
    const ms = tn.map((n) => n.midi);
    const avg = Math.round(ms.reduce((s, m) => s + m, 0) / ms.length);
    console.log(
      `track ${t}: ${tn.length} notes, range ${noteName(Math.min(...ms))}..${noteName(Math.max(...ms))}, avg ${noteName(avg)}`
    );
  }
  console.log(
    `\nmelody: ${melody.length} notes, ${melodyBeats} beats | accompaniment: ${accomp.length} notes, ends @${accompEnd} beats`
  );
  console.log(`(melody + accompaniment = ${melody.length + accomp.length} of ${trackSel.length} source notes)`);
}
