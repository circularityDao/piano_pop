// Imperative game engine: drives falling tiles, hit detection, scoring.
// Transliterated VERBATIM from recovered module `222fd872`. All verified
// constants are reproduced exactly (plan §4):
//   DIFFICULTY easy {1.25, 2900} / normal {1.0, 2300} / challenge {0.8, 1750}
//   HIT_FRAC 0.82, HOLD_FRAC 0.85 (+ the 0.55 release-bonus threshold below)
//   hit window 360ms, perfect<110 / good<240 / ok<=360, base 100/70/45
//   combo mult ×(1 + min(combo,20)×0.1), miss when progress > 1.06
//   stars accuracy >=0.9 / >=0.6 / >0, accuracy = hits/total
//
// Tiles are created and animated imperatively (DOM nodes inside the notes
// layer), exactly as the original — there is no separate React Tile component
// in the source, so we keep it imperative to avoid behavioural drift.

import type { Note, Song } from "../songs/schema";

export interface DifficultyEntry {
  beatScale: number;
  fallMs: number;
}

export const DIFFICULTY: Record<string, DifficultyEntry> = {
  easy: { beatScale: 1.25, fallMs: 2900 },
  normal: { beatScale: 1.0, fallMs: 2300 },
  challenge: { beatScale: 0.8, fallMs: 1750 },
};

const HIT_FRAC = 0.82; // hit line sits this far down the field (a bit above the keys)
const HOLD_FRAC = 0.85; // fraction of a long note's duration you must hold to complete it
const BACKING_VELOCITY = 0.5; // auto-played accompaniment sits under the player's melody
const BACKING_LATE_MS = 250; // after a stall/tab-switch, skip backing notes older than this

export interface EngineSettings {
  difficulty: string;
  colorMode: string;
  showLetters: boolean;
}

export interface EngineStats {
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
}

export interface EndResult {
  stats: EngineStats;
  total: number;
  accuracy: number;
  stars: number;
}

export interface EngineCallbacks {
  hit?: (e: {
    note: RuntimeNote;
    quality: string;
    score: number;
    combo: number;
  }) => void;
  miss?: (e: { note: RuntimeNote; combo: number }) => void;
  stats?: (s: EngineStats) => void;
  target?: (midi: number | null) => void;
  progress?: (p: number) => void;
  /** Play an auto-accompaniment note (the backing track, not a tile). */
  accomp?: (midi: number, velocity: number) => void;
  end?: (r: EndResult) => void;
}

export interface EngineOptions {
  layer: HTMLElement;
  /** Element whose children carry the column markers the engine measures:
   *  `[data-key]` keys in keyboard mode, `[data-lane]` lanes in 4-lane mode. */
  keyboardEl: HTMLElement;
  song: Song;
  settings?: Partial<EngineSettings>;
  on?: EngineCallbacks;
  /** When true, notes fall in `laneCount` lanes (classic Piano-Tiles) instead
   *  of being positioned under their pitch on the keyboard. */
  laneMode?: boolean;
  /** Number of lanes in lane mode (default 4). */
  laneCount?: number;
}

interface RuntimeNote {
  i: number;
  midi: number;
  /** Every MIDI pitch this tile sounds when hit correctly. In keyboard mode
   *  this is always a single note (`[midi]`). In lane mode a tile represents a
   *  GROUP of notes sharing the same onset (a chord → one tile), so all of them
   *  sound together on a correct press. */
  midis: number[];
  /** The column this note lives in. Keyboard mode: === midi. Lane mode: lane
   *  index 0..laneCount-1 (assigned for variety, never equal to the previous
   *  note's lane). All positioning / input matching keys off this. */
  col: number;
  letter: string;
  time: number;
  durMs: number;
  hold: boolean;
  el: HTMLDivElement | null;
  x: number;
  spawned: boolean;
  headHit: boolean;
  holding: boolean;
  hit: boolean;
  missed: boolean;
  tileH?: number;
  fillEl?: HTMLDivElement;
}

export type { RuntimeNote };

export class GameEngine {
  layer: HTMLElement;
  keyboardEl: HTMLElement;
  song: Song;
  on: EngineCallbacks;
  settings: EngineSettings;
  raf: number | null = null;
  running = false;
  paused = false;
  notes: RuntimeNote[] = [];
  laneMode = false;
  laneCount = 4;
  // col -> centerX (relative to layer). In keyboard mode col === midi; in lane
  // mode col is the lane index. Named keyCenters for continuity with the
  // recovered source.
  keyCenters: Record<number, number> = {};
  keyWidth = 60;
  hitLineY = 0;
  _t0 = 0;
  _pauseAt = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  hits = 0;
  misses = 0;
  lastTarget: number | null = null;
  holds: Record<number, RuntimeNote> = {}; // midi -> note currently being held
  endTime = 0;
  // Auto-played backing track (sorted by time); accompIdx is the next note due.
  accomp: { midi: number; time: number; vel: number }[] = [];
  accompIdx = 0;
  _loop: () => void;

  constructor(opts: EngineOptions) {
    this.layer = opts.layer; // notes layer element
    this.keyboardEl = opts.keyboardEl; // keyboard element (for measuring)
    this.song = opts.song;
    this.on = opts.on || {};
    this.laneMode = !!opts.laneMode;
    this.laneCount = opts.laneCount ?? 4;
    this.settings = Object.assign(
      { difficulty: "easy", colorMode: "single", showLetters: true },
      opts.settings || {}
    );
    this._loop = this._loopImpl.bind(this);
  }

  /** Pick a lane for a tile: any lane that is not `prev` (the previous tile's
   *  lane — pure variety, never the same lane twice in a row) and not already
   *  `used` by a sibling tile in the SAME moment (two simultaneous hard-mode
   *  tiles must sit in two different lanes). Falls back gracefully if every
   *  lane is excluded. */
  _pickLane(prev: number, used: number[] = []): number {
    const k = this.laneCount;
    let avail: number[] = [];
    for (let l = 0; l < k; l++)
      if (l !== prev && used.indexOf(l) < 0) avail.push(l);
    if (!avail.length)
      for (let l = 0; l < k; l++) if (used.indexOf(l) < 0) avail.push(l);
    if (!avail.length) return 0;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  palette(): Record<string, [string, string]> {
    // friendly per-letter hues for rainbow mode
    return {
      C: ["#FF7BAC", "#E85C92"],
      D: ["#FF9F45", "#F0852A"],
      E: ["#FFD23F", "#F0BE1E"],
      F: ["#44D7A8", "#27BC8E"],
      G: ["#4C8DFF", "#2E6FE0"],
      A: ["#9B7EDE", "#7E5FD0"],
      B: ["#46C8E8", "#2BACCE"],
    };
  }

  measure(): void {
    const layerRect = this.layer.getBoundingClientRect();
    this.hitLineY = layerRect.height * HIT_FRAC;
    this.keyCenters = {};
    if (this.laneMode) {
      // Lane mode: measure the 4 lane columns (same width by flexbox).
      const laneEls =
        this.keyboardEl.querySelectorAll<HTMLElement>("[data-lane]");
      let w = 80;
      laneEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        const lane = parseInt(el.getAttribute("data-lane")!, 10);
        this.keyCenters[lane] = r.left + r.width / 2 - layerRect.left;
        w = r.width;
      });
      this.keyWidth = w;
    } else {
      const keyEls = this.keyboardEl.querySelectorAll<HTMLElement>("[data-key]");
      let w = 60;
      keyEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        const midi = parseInt(el.getAttribute("data-key")!, 10);
        this.keyCenters[midi] = r.left + r.width / 2 - layerRect.left;
        if (el.getAttribute("data-type") === "white") w = r.width;
      });
      this.keyWidth = w;
    }
    // reposition existing tiles' x (keyed off the note's column)
    this.notes.forEach((n) => {
      if (n.el) {
        const tw = this.tileW();
        n.el.style.width = tw + "px";
        if (!n.hold) {
          // Keyboard taps are square; lane taps are fixed-height rectangles.
          const th = this.laneMode ? this.laneTapH() : tw;
          n.el.style.height = th + "px";
          n.tileH = th;
        }
        n.x = (this.keyCenters[n.col] || 0) - tw / 2;
      }
    });
  }

  tileW(): number {
    // Lane mode tiles are full-width rectangles that fill their lane (a small
    // gutter keeps neighbouring lanes visually separated).
    if (this.laneMode) return Math.max(40, this.keyWidth - 8);
    return Math.max(34, Math.min(this.keyWidth * 0.84, 84));
  }

  /** Height of a quick-tap rectangle in lane mode (long-press tiles are taller,
   *  sized from their duration in _makeTile). */
  laneTapH(): number {
    return Math.max(54, Math.min(this.hitLineY * 0.24, 130));
  }

  beatMs(): number {
    return this.song.beatMs * DIFFICULTY[this.settings.difficulty].beatScale;
  }
  fallMs(): number {
    return DIFFICULTY[this.settings.difficulty].fallMs;
  }

  /**
   * Build the 4-lane chart from the song's (player-melody) notes. A TILE is a
   * GROUP of notes that share the same onset beat — a chord collapses into one
   * tile whose every pitch sounds on a correct press; a monophonic passage
   * yields one single-note tile per beat. Difficulty shapes the chart:
   *   • easy      — one tile at a time, taps ONLY (a long source note is shown
   *                 as a single tap; no long-press tiles, never two at once).
   *   • normal    — one tile at a time, taps + long-press tiles (held notes).
   *   • challenge — taps + long-press tiles AND up to TWO simultaneous tiles
   *                 (a chord splits across two different lanes, capped at two).
   *                 A monophonic song has no real chords, so it plays like
   *                 normal — we never manufacture fake concurrency.
   * Lane variety is preserved: a new tile never reuses the previous tile's
   * lane; two simultaneous tiles always land in two different lanes.
   */
  _buildLaneTiles(beatMs: number, lead: number): RuntimeNote[] {
    const diff = this.settings.difficulty;
    const allowHold = diff !== "easy"; // easy renders long notes as taps
    const allowTwo = diff === "challenge"; // only hard allows two-at-once

    // Group consecutive notes that share an onset beat into chords.
    const groups: { beat: number; notes: Note[] }[] = [];
    for (const nn of this.song.notes) {
      const last = groups[groups.length - 1];
      if (last && last.beat === nn.beat) last.notes.push(nn);
      else groups.push({ beat: nn.beat, notes: [nn] });
    }

    const out: RuntimeNote[] = [];
    let prevLane = -1;
    let i = 0;
    for (const g of groups) {
      const time = lead + g.beat * beatMs;
      // Decide how many tiles this group becomes. With two-at-once allowed and a
      // real chord present, split into two tiles (first pitch + the rest) so the
      // chord is two lanes; otherwise the whole group is one tile.
      const buckets =
        allowTwo && g.notes.length >= 2
          ? [[g.notes[0]], g.notes.slice(1)]
          : [g.notes];
      const lanes: number[] = [];
      for (let b = 0; b < buckets.length; b++)
        lanes.push(this._pickLane(prevLane, lanes));
      for (let b = 0; b < buckets.length; b++) {
        const bnotes = buckets[b];
        const midis = bnotes.map((n) => n.midi);
        const maxBeats = bnotes.reduce((m, n) => Math.max(m, n.beats), 0);
        out.push({
          i: i++,
          midi: midis[0],
          midis,
          col: lanes[b],
          letter: bnotes[0].letter,
          time,
          durMs: maxBeats * beatMs,
          hold: allowHold && maxBeats >= 2, // long-press tile only off easy
          el: null,
          x: 0,
          spawned: false,
          headHit: false,
          holding: false,
          hit: false,
          missed: false,
        });
      }
      prevLane = lanes[lanes.length - 1];
    }
    return out;
  }

  build(): void {
    this.layer.innerHTML = "";
    const beatMs = this.beatMs();
    const lead = this.fallMs() + 200; // so first tile can fall in fully
    if (this.laneMode) {
      this.notes = this._buildLaneTiles(beatMs, lead);
    } else {
      // KEYBOARD MODE — one tile per song note, positioned under its pitch.
      // Preserved exactly: col === midi, holds when beats >= 2.
      this.notes = this.song.notes.map((nn, i) => {
        return {
          i,
          midi: nn.midi,
          midis: [nn.midi],
          col: nn.midi,
          letter: nn.letter,
          time: lead + nn.beat * beatMs, // when it should be hit (ms)
          durMs: nn.beats * beatMs,
          hold: nn.beats >= 2, // long notes must be held
          el: null,
          x: 0,
          spawned: false,
          headHit: false,
          holding: false,
          hit: false,
          missed: false,
        };
      });
    }
    // Schedule the auto-played backing track on the SAME clock as the tiles.
    const backing = this.song.accompaniment || [];
    this.accomp = backing
      .map((a) => ({ midi: a.midi, time: lead + a.beat * beatMs, vel: BACKING_VELOCITY }))
      .sort((x, y) => x.time - y.time);
    this.accompIdx = 0;
    let backingEndBeats = 0;
    for (const a of backing) backingEndBeats = Math.max(backingEndBeats, a.beat + a.beats);
    const endBeats = Math.max(this.song.totalBeats, backingEndBeats);
    this.endTime = lead + endBeats * beatMs + 900;
  }

  start(): void {
    this.build();
    this.measure();
    this.running = true;
    this.paused = false;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.holds = {};
    this._t0 = performance.now();
    this.raf = requestAnimationFrame(this._loop);
  }

  now(): number {
    return performance.now() - this._t0;
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this._pauseAt = performance.now();
    if (this.raf !== null) cancelAnimationFrame(this.raf);
  }
  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this._t0 += performance.now() - this._pauseAt;
    this.raf = requestAnimationFrame(this._loop);
  }
  stop(): void {
    this.running = false;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
  }

  /** Lane-mode tile: a plain full-width rectangle (no pitch label). Long-press
   *  tiles are taller rectangles proportional to their duration and carry the
   *  rising hold-fill light. */
  _makeLaneTile(n: RuntimeNote): void {
    const el = document.createElement("div");
    const tw = this.tileW();
    el.style.width = tw + "px";
    let h: number;
    if (n.hold) {
      el.className = "tile lane-tile lane-tile-hold";
      h = Math.max(this.laneTapH() * 1.25, (n.durMs / this.fallMs()) * this.hitLineY * 0.9);
      const fill = document.createElement("div");
      fill.className = "tile-fill";
      el.appendChild(fill);
      n.fillEl = fill;
    } else {
      el.className = "tile lane-tile";
      h = this.laneTapH();
    }
    el.style.height = h + "px";
    n.tileH = h;
    if (this.settings.colorMode === "rainbow") {
      const c = this.palette()[n.letter] || ["#4C8DFF", "#2E6FE0"];
      el.style.setProperty("--c1", c[0]);
      el.style.setProperty("--c2", c[1]);
    }
    n.x = (this.keyCenters[n.col] || 0) - tw / 2;
    this.layer.appendChild(el);
    n.el = el as HTMLDivElement;
  }

  _makeTile(n: RuntimeNote): void {
    if (this.laneMode) {
      this._makeLaneTile(n);
      return;
    }
    const el = document.createElement("div");
    const tw = this.tileW();
    el.style.width = tw + "px";
    if (n.hold) {
      el.className = "tile tile-hold";
      // height proportional to duration
      const h = Math.max(64, (n.durMs / this.fallMs()) * this.hitLineY * 0.9);
      el.style.height = h + "px";
      n.tileH = h;
      // light that rises through the pill while it is held
      const fill = document.createElement("div");
      fill.className = "tile-fill";
      el.appendChild(fill);
      n.fillEl = fill;
    } else {
      // quick-tap note -> circle
      el.className = "tile tile-tap";
      el.style.height = tw + "px";
      n.tileH = tw;
    }
    if (this.settings.colorMode === "rainbow") {
      const c = this.palette()[n.letter] || ["#4C8DFF", "#2E6FE0"];
      el.style.setProperty("--c1", c[0]);
      el.style.setProperty("--c2", c[1]);
    }
    const span = document.createElement("span");
    span.className = "tile-letter";
    if (!n.hold) span.style.fontSize = Math.round(tw * 0.5) + "px";
    span.textContent = this.settings.showLetters ? n.letter : "";
    el.appendChild(span);
    n.x = (this.keyCenters[n.col] || 0) - tw / 2;
    this.layer.appendChild(el);
    n.el = el as HTMLDivElement;
  }

  /**
   * Register a press on a column (a key midi in keyboard mode, a lane index in
   * lane mode). Returns the matched note (so the caller can sound its pitch) or
   * null for free play / a miss-window press.
   */
  press(col: number): RuntimeNote | null {
    // find best candidate note for this column within the hit window
    const t = this.now();
    const win = 360;
    let best: RuntimeNote | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.hit || n.missed || n.headHit || n.col !== col) continue;
      const d = Math.abs(n.time - t);
      if (d <= win && d < bestDelta) {
        best = n;
        bestDelta = d;
      }
    }
    if (best) {
      this._scoreHit(best, bestDelta);
      best.headHit = true;
      if (best.hold) {
        // long note: keep the tile, wait for the player to hold
        best.holding = true;
        this.holds[col] = best;
        if (best.el) best.el.classList.add("tile-holding");
      } else {
        // quick tap: pop the tile right away
        best.hit = true;
        if (best.el) {
          const el = best.el;
          el.classList.add("tile-hit");
          setTimeout(() => el.remove(), 260);
        }
      }
      this._burst(best);
      this._flash(best);
      return best; // a scheduled note was caught
    }
    return null; // free play (no penalty)
  }

  release(col: number): void {
    const n = this.holds[col];
    if (!n) return;
    delete this.holds[col];
    this._completeHold(n);
  }

  _completeHold(n: RuntimeNote): void {
    if (n.hit) return;
    delete this.holds[n.col];
    n.holding = false;
    n.hit = true;
    const frac = (this.now() - n.time) / n.durMs;
    if (frac >= 0.55) {
      // held long enough -> sustain bonus + extra sparkle
      this.score += 30;
      this._burst(n);
      this._flash(n);
      if (this.on.stats) this.on.stats(this._stats());
    }
    if (n.el) {
      const el = n.el;
      el.classList.remove("tile-holding");
      el.classList.add("tile-hit");
      setTimeout(() => el.remove(), 260);
    }
  }

  _scoreHit(n: RuntimeNote, delta: number): void {
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const quality = delta < 110 ? "perfect" : delta < 240 ? "good" : "ok";
    const base = quality === "perfect" ? 100 : quality === "good" ? 70 : 45;
    const mult = 1 + Math.min(this.combo, 20) * 0.1;
    this.score += Math.round(base * mult);
    if (this.on.hit)
      this.on.hit({ note: n, quality, score: this.score, combo: this.combo });
    if (this.on.stats) this.on.stats(this._stats());
  }

  _registerMiss(n: RuntimeNote): void {
    n.missed = true;
    this.misses++;
    this.combo = 0;
    if (n.el) n.el.classList.add("tile-miss");
    if (this.on.miss) this.on.miss({ note: n, combo: 0 });
    if (this.on.stats) this.on.stats(this._stats());
  }

  _flash(n: RuntimeNote): void {
    // bright light bloom on the note as it is caught
    const f = document.createElement("div");
    f.className = "note-flash";
    f.style.left = this.keyCenters[n.col] + "px";
    f.style.top = this.hitLineY + "px";
    this.layer.appendChild(f);
    setTimeout(() => f.remove(), 440);
  }

  _burst(n: RuntimeNote): void {
    const cx = this.keyCenters[n.col];
    const cy = this.hitLineY;
    const burst = document.createElement("div");
    burst.className = "burst";
    burst.style.left = cx + "px";
    burst.style.top = cy + "px";
    const colors = ["#ffd23f", "#ff7bc4", "#b06ef0", "#7fd8ff", "#ff9fd6"];
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("i");
      const ang = (Math.PI * 2 * i) / 7 + Math.random();
      const dist = 26 + Math.random() * 30;
      s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      s.style.setProperty("--dy", Math.sin(ang) * dist - 14 + "px");
      s.style.background = colors[i % colors.length];
      burst.appendChild(s);
    }
    this.layer.appendChild(burst);
    setTimeout(() => burst.remove(), 650);
  }

  _stats(): EngineStats {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      hits: this.hits,
      misses: this.misses,
    };
  }

  _loopImpl(): void {
    if (!this.running || this.paused) return;
    const t = this.now();
    const fall = this.fallMs();
    // Accuracy denominator = number of tiles. In keyboard mode that is the note
    // count (unchanged); in lane mode grouping/splitting can change the count.
    const total = this.laneMode ? this.notes.length : this.song.notes.length;

    // Play any due backing-track notes. After a stall (pause edge / tab switch)
    // the clock can jump, so skip notes that are already well past due rather
    // than dumping them all at once as a chord.
    if (this.on.accomp) {
      while (this.accompIdx < this.accomp.length && t >= this.accomp[this.accompIdx].time) {
        const a = this.accomp[this.accompIdx++];
        if (t - a.time <= BACKING_LATE_MS) this.on.accomp(a.midi, a.vel);
      }
    }

    // determine current guidance target (earliest unresolved note approaching)
    let target: number | null = null;

    for (const n of this.notes) {
      if (!n.spawned && t >= n.time - fall) {
        this._makeTile(n);
        n.spawned = true;
      }
      if (n.spawned && n.el && !n.hit) {
        const progress = (t - (n.time - fall)) / fall; // 0..1 at hit line
        if (n.holding && t >= n.time) {
          // pin the pill's head at the line and consume it with light
          n.el.style.transform = `translate(${n.x}px, ${this.hitLineY - (n.tileH || 0)}px)`;
          const frac = Math.min(1, (t - n.time) / (n.durMs * HOLD_FRAC));
          if (n.fillEl) n.fillEl.style.height = frac * 100 + "%";
          if (frac >= 1) this._completeHold(n);
        } else {
          const centerY = progress * this.hitLineY; // tile bottom edge crosses line at note.time
          n.el.style.transform = `translate(${n.x}px, ${centerY - (n.tileH || 0)}px)`;
          if (!n.holding && !n.headHit) {
            if (!n.missed && progress > 1.06) {
              this._registerMiss(n);
              const el = n.el;
              setTimeout(() => {
                if (el) el.remove();
              }, 220);
            }
            // light up the key only as the note actually reaches the line ("press now")
            if (
              !n.missed &&
              target === null &&
              progress > 0.9 &&
              progress < 1.15
            ) {
              // The guidance target is a column: a key midi (keyboard) or a
              // lane index (lane mode). The Game screen highlights accordingly.
              target = n.col;
            }
          }
        }
      }
    }

    if (target !== this.lastTarget) {
      this.lastTarget = target;
      if (this.on.target) this.on.target(target);
    }

    // progress %
    if (this.on.progress) {
      const p = Math.max(
        0,
        Math.min(1, (t - (fall + 200)) / (this.endTime - (fall + 200)))
      );
      this.on.progress(p);
    }

    if (t >= this.endTime) {
      this.running = false;
      if (this.raf !== null) cancelAnimationFrame(this.raf);
      const acc = total ? this.hits / total : 0;
      const stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : acc > 0 ? 1 : 0;
      if (this.on.end)
        this.on.end({ stats: this._stats(), total, accuracy: acc, stars });
      return;
    }
    this.raf = requestAnimationFrame(this._loop);
  }
}
