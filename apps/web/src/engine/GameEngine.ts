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

import type { Song } from "../songs/schema";

export interface DifficultyEntry {
  beatScale: number;
  fallMs: number;
}

export const DIFFICULTY: Record<string, DifficultyEntry> = {
  easy: { beatScale: 1.25, fallMs: 2900 },
  normal: { beatScale: 1.0, fallMs: 2300 },
  challenge: { beatScale: 0.8, fallMs: 1750 },
};

// 4-LANE mode difficulty = how many CONSECUTIVE melody notes are bundled into a
// single tile (one tap). Fewer notes/tile = more tiles = harder. This is the
// WHOLE lane difficulty mechanic; lane mode does NOT tempo-scale the music
// (see build()), so the song always plays at its original timing regardless of
// difficulty — only the tap density changes.
export const LANE_GROUP_N: Record<string, number> = {
  easy: 10,
  normal: 8,
  challenge: 5,
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
  /** Play a melody note from a correctly-tapped lane tile's group. Fired on the
   *  engine clock so the chunk replays in the song's original rhythm. */
  note?: (midi: number) => void;
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
  /** Every MIDI pitch this tile sounds when hit correctly (keyboard mode: just
   *  `[midi]`). */
  midis: number[];
  /** Lane mode only: the chunk of consecutive melody notes this tile triggers.
   *  Each carries its pitch plus `off` = ms after the tile's first note onset
   *  at which it should sound, so a correct tap replays the chunk in the song's
   *  ORIGINAL rhythm (not all at once). Keyboard tiles leave this empty. */
  group: { midi: number; off: number }[];
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
  // Lane mode: melody notes queued by correctly-tapped tiles, played out on the
  // engine clock at their original-rhythm times (engine-clock ms).
  _melody: { midi: number; time: number }[] = [];
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
        if (this.laneMode) {
          // Lane tiles span their chunk duration.
          const th = this.laneTileH(n);
          n.el.style.height = th + "px";
          n.tileH = th;
        } else if (!n.hold) {
          // Keyboard taps are square.
          n.el.style.height = tw + "px";
          n.tileH = tw;
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

  /** Minimum lane-tile rectangle height (a short chunk still gets a tappable
   *  rectangle). */
  laneTapH(): number {
    return Math.max(54, Math.min(this.hitLineY * 0.24, 130));
  }

  /** Lane-tile rectangle height: spans the chunk's time-duration (its head
   *  reaches the hit line exactly when the first note is due), with a floor so
   *  short chunks stay tappable and a cap so a long trailing note can't make it
   *  absurdly tall. */
  laneTileH(n: RuntimeNote): number {
    const span = (n.durMs / this.fallMs()) * this.hitLineY;
    return Math.max(this.laneTapH(), Math.min(span, this.hitLineY * 1.6));
  }

  beatMs(): number {
    return this.song.beatMs * DIFFICULTY[this.settings.difficulty].beatScale;
  }
  fallMs(): number {
    return DIFFICULTY[this.settings.difficulty].fallMs;
  }

  /**
   * Build the 4-lane chart. A TILE is a CHUNK of N CONSECUTIVE melody notes
   * (N = LANE_GROUP_N[difficulty]: easy 10 / normal 8 / challenge 5). The player
   * makes ONE tap per tile, when the chunk's FIRST note is due; a correct tap
   * then replays the whole chunk in the song's ORIGINAL rhythm (scheduled in
   * press()). Tiles tile the field back-to-back: tile k+1 becomes due exactly
   * when tile k's chunk ends, so overall song timing is unchanged — just fewer
   * presses. The last tile may hold the remainder (< N notes).
   *
   * `beatMs` here is the song's UNSCALED ms/beat (build() passes the original
   * tempo in lane mode), so the music plays at original speed at every
   * difficulty. Lane variety preserved: each tile uses a different lane than the
   * one before it.
   */
  _buildLaneTiles(beatMs: number, lead: number): RuntimeNote[] {
    const N = LANE_GROUP_N[this.settings.difficulty] ?? 8;
    const src = this.song.notes;
    const out: RuntimeNote[] = [];
    let prevLane = -1;
    let i = 0;
    for (let s = 0; s < src.length; s += N) {
      const chunk = src.slice(s, s + N);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const time = lead + first.beat * beatMs;
      // Each note's pitch + ms offset from the chunk's first onset (original
      // rhythm). Span = first onset .. end of last note.
      const group = chunk.map((nn) => ({
        midi: nn.midi,
        off: (nn.beat - first.beat) * beatMs,
      }));
      const spanMs = (last.beat + last.beats - first.beat) * beatMs;
      const lane = this._pickLane(prevLane);
      prevLane = lane;
      out.push({
        i: i++,
        midi: first.midi,
        midis: chunk.map((c) => c.midi),
        group,
        col: lane,
        letter: first.letter,
        time, // hit moment = first note's onset
        durMs: spanMs, // tile rectangle spans the chunk's duration
        hold: false, // lane tiles are tap-once now (no long-press)
        el: null,
        x: 0,
        spawned: false,
        headHit: false,
        holding: false,
        hit: false,
        missed: false,
      });
    }
    return out;
  }

  build(): void {
    this.layer.innerHTML = "";
    // Lane mode plays at the song's ORIGINAL tempo (no beatScale) so the music
    // timing is identical at every difficulty — difficulty is purely the tile
    // chunk size N. Keyboard mode keeps its difficulty-scaled tempo. Both the
    // melody tiles and the backing track below share this `beatMs`, so they stay
    // in sync.
    const beatMs = this.laneMode ? this.song.beatMs : this.beatMs();
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
          group: [],
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
    this._melody = [];
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

  /** Lane-mode tile: a plain full-width rectangle (no pitch label) sized to span
   *  its note-chunk's duration. Tapped once; no long-press. */
  _makeLaneTile(n: RuntimeNote): void {
    const el = document.createElement("div");
    const tw = this.tileW();
    el.style.width = tw + "px";
    el.className = "tile lane-tile";
    const h = this.laneTileH(n);
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
      // Lane tile: replay its note-chunk in the song's original rhythm. A
      // correct tap is the only trigger, but the notes are scheduled at ABSOLUTE
      // SONG TIME (the tile's own onset + each note's offset), NOT the tap time —
      // so an early/late tap just "catches up" and the melody stays locked to the
      // auto-played accompaniment. Any note already past at tap moment plays
      // immediately on the next drain (it isn't dropped). Times are engine-clock
      // ms, so this still survives pause/resume.
      if (best.group.length) {
        for (const gn of best.group)
          this._melody.push({ midi: gn.midi, time: best.time + gn.off });
      }
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

    // Play any due melody notes queued by correctly-tapped lane tiles — this is
    // what voices the player's part, in the chunk's original rhythm.
    if (this.on.note && this._melody.length) {
      const due: number[] = [];
      this._melody = this._melody.filter((m) => {
        if (m.time <= t) {
          due.push(m.midi);
          return false;
        }
        return true;
      });
      for (const midi of due) this.on.note(midi);
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

    // Don't end while a tapped final phrase still has queued melody notes — keep
    // looping so the drain above can voice them in rhythm. Otherwise a late tap
    // on the last tile would be truncated. (Keyboard mode has no `_melody`, so it
    // ends exactly as before — unchanged behaviour.)
    const melodyPending =
      this.laneMode && !!this.on.note && this._melody.length > 0;
    if (t >= this.endTime && !melodyPending) {
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
