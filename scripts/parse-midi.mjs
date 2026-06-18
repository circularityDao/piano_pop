// One-off MIDI inspector for importing a song sheet. Minimal SMF parser:
// reads header (division), walks every track, collects note-on/off + tempo.
// Prints a summary plus the monophonic melody as [noteName, beats] entries
// suitable for songs/builtin. Not shipped — analysis tool.

import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/parse-midi.mjs <file.mid>");
  process.exit(1);
}
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
const onlyTrack =
  process.argv[3] && process.argv[3] !== "all" ? parseInt(process.argv[3], 10) : null;

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

const bpm = Math.round(60000000 / tempoUsPerQuarter);
console.log(`format=${format} tracks=${ntracks} division=${division} ticks/quarter`);
console.log(`tempo=${bpm} BPM (${tempoUsPerQuarter} us/quarter), tempo changes=${tempos.length}`);
console.log(`total notes parsed=${notes.length}`);
const lo = Math.min(...notes.map((n) => n.midi));
const hi = Math.max(...notes.map((n) => n.midi));
console.log(`pitch range: ${noteName(lo)}(${lo}) .. ${noteName(hi)}(${hi})`);

// Per-track breakdown so we can pick the melody (right) hand vs bass (left).
console.log("\n--- per-track ---");
for (let t = 0; t < ntracks; t++) {
  const tn = notes.filter((n) => n.track === t);
  if (!tn.length) continue;
  const ms = tn.map((n) => n.midi);
  const avg = Math.round(ms.reduce((s, m) => s + m, 0) / ms.length);
  const tlo = Math.min(...ms);
  const thi = Math.max(...ms);
  console.log(
    `track ${t}: ${tn.length} notes, range ${noteName(tlo)}..${noteName(thi)}, avg ${noteName(avg)}(${avg})`
  );
}

// Drop the left-hand accompaniment: notes below this MIDI floor (default C4=60,
// the bottom of the game keyboard). Pass arg4 to override.
const minMidi = process.argv[4] != null ? parseInt(process.argv[4], 10) : 60;
const trackSel = onlyTrack != null ? notes.filter((n) => n.track === onlyTrack) : notes;
const src = trackSel.filter((n) => n.midi >= minMidi);
console.log(
  `\n>> melody source: ${onlyTrack != null ? `track ${onlyTrack}` : "all tracks"}, ` +
    `pitch >= ${noteName(minMidi)}(${minMidi}) -> ${src.length} of ${trackSel.length} notes`
);

// ---- reduce to a monophonic top-line melody ----
// Group notes by onset tick; keep the highest pitch in each chord.
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

// Duration of each melody note = gap to next onset (so the sheet is gapless,
// matching how buildSong lays notes sequentially). Round to nearest 1/4 beat.
const q = division; // ticks per beat (quarter)
const round4 = (x) => Math.max(0.25, Math.round(x * 4) / 4);
const melody = mono.map((n, i) => {
  const nextTick = i + 1 < mono.length ? mono[i + 1].tick : n.tick + n.dur;
  const beats = round4((nextTick - n.tick) / q);
  return [noteName(n.midi), beats];
});

console.log(`\nmonophonic melody entries=${melody.length}, total beats=${melody.reduce((s, m) => s + m[1], 0)}`);
console.log("\n--- melody (paste-ready) ---");
const fmt = melody.map((m) => `["${m[0]}", ${m[1]}]`);
for (let i = 0; i < fmt.length; i += 8) {
  console.log("  " + fmt.slice(i, i + 8).join(", ") + ",");
}
