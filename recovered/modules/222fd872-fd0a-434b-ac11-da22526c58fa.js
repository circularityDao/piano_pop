// Imperative game engine: drives falling tiles, hit detection, scoring.
(function () {
  const DIFFICULTY = {
    easy: { beatScale: 1.25, fallMs: 2900 },
    normal: { beatScale: 1.0, fallMs: 2300 },
    challenge: { beatScale: 0.8, fallMs: 1750 },
  };
  const HIT_FRAC = 0.82; // hit line sits this far down the field (a bit above the keys)
  const HOLD_FRAC = 0.85; // fraction of a long note's duration you must hold to complete it

  class GameEngine {
    constructor(opts) {
      this.layer = opts.layer; // notes layer element
      this.keyboardEl = opts.keyboardEl; // keyboard element (for measuring)
      this.song = opts.song;
      this.on = opts.on || {};
      this.settings = Object.assign(
        { difficulty: "easy", colorMode: "single", showLetters: true },
        opts.settings || {}
      );
      this.raf = null;
      this.running = false;
      this.paused = false;
      this.notes = [];
      this.keyCenters = {}; // midi -> centerX (relative to layer)
      this.keyWidth = 60;
      this.hitLineY = 0;
      this._t0 = 0;
      this._pauseAt = 0;
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.hits = 0;
      this.misses = 0;
      this.lastTarget = null;
      this.holds = {}; // midi -> note currently being held
    }

    palette() {
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

    measure() {
      const layerRect = this.layer.getBoundingClientRect();
      this.hitLineY = layerRect.height * HIT_FRAC;
      const keyEls = this.keyboardEl.querySelectorAll('[data-key]');
      let w = 60;
      keyEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        const midi = parseInt(el.getAttribute("data-key"), 10);
        this.keyCenters[midi] = r.left + r.width / 2 - layerRect.left;
        if (el.getAttribute("data-type") === "white") w = r.width;
      });
      this.keyWidth = w;
      // reposition existing tiles' x
      this.notes.forEach((n) => {
        if (n.el) {
          const tw = this.tileW();
          n.el.style.width = tw + "px";
          if (!n.hold) { n.el.style.height = tw + "px"; n.tileH = tw; }
          n.x = this.keyCenters[n.midi] - tw / 2;
        }
      });
    }

    tileW() {
      return Math.max(34, Math.min(this.keyWidth * 0.84, 84));
    }

    beatMs() {
      return this.song.beatMs * DIFFICULTY[this.settings.difficulty].beatScale;
    }
    fallMs() {
      return DIFFICULTY[this.settings.difficulty].fallMs;
    }

    build() {
      this.layer.innerHTML = "";
      const beatMs = this.beatMs();
      const lead = this.fallMs() + 200; // so first tile can fall in fully
      this.notes = this.song.notes.map((nn, i) => ({
        i,
        midi: nn.midi,
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
      }));
      this.endTime = lead + this.song.totalBeats * beatMs + 900;
    }

    start() {
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
      this._loop = this._loop.bind(this);
      this.raf = requestAnimationFrame(this._loop);
    }

    now() {
      return performance.now() - this._t0;
    }

    pause() {
      if (!this.running || this.paused) return;
      this.paused = true;
      this._pauseAt = performance.now();
      cancelAnimationFrame(this.raf);
    }
    resume() {
      if (!this.running || !this.paused) return;
      this.paused = false;
      this._t0 += performance.now() - this._pauseAt;
      this.raf = requestAnimationFrame(this._loop);
    }
    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }

    _makeTile(n) {
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
      n.x = (this.keyCenters[n.midi] || 0) - tw / 2;
      this.layer.appendChild(el);
      n.el = el;
    }

    press(midi) {
      // find best candidate note for this key within hit window
      const t = this.now();
      const win = 360;
      let best = null;
      let bestDelta = Infinity;
      for (const n of this.notes) {
        if (n.hit || n.missed || n.headHit || n.midi !== midi) continue;
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
          this.holds[midi] = best;
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
        return true; // a scheduled note was caught
      }
      return false; // free play (no penalty)
    }

    release(midi) {
      const n = this.holds[midi];
      if (!n) return;
      delete this.holds[midi];
      this._completeHold(n);
    }

    _completeHold(n) {
      if (n.hit) return;
      delete this.holds[n.midi];
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

    _scoreHit(n, delta) {
      this.hits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const quality = delta < 110 ? "perfect" : delta < 240 ? "good" : "ok";
      const base = quality === "perfect" ? 100 : quality === "good" ? 70 : 45;
      const mult = 1 + Math.min(this.combo, 20) * 0.1;
      this.score += Math.round(base * mult);
      if (this.on.hit) this.on.hit({ note: n, quality, score: this.score, combo: this.combo });
      if (this.on.stats) this.on.stats(this._stats());
    }

    _registerMiss(n) {
      n.missed = true;
      this.misses++;
      this.combo = 0;
      if (n.el) n.el.classList.add("tile-miss");
      if (this.on.miss) this.on.miss({ note: n, combo: 0 });
      if (this.on.stats) this.on.stats(this._stats());
    }

    _flash(n) {
      // bright light bloom on the note as it is caught
      const f = document.createElement("div");
      f.className = "note-flash";
      f.style.left = this.keyCenters[n.midi] + "px";
      f.style.top = this.hitLineY + "px";
      this.layer.appendChild(f);
      setTimeout(() => f.remove(), 440);
    }

    _burst(n) {
      const cx = this.keyCenters[n.midi];
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
        s.style.setProperty("--dy", (Math.sin(ang) * dist - 14) + "px");
        s.style.background = colors[i % colors.length];
        burst.appendChild(s);
      }
      this.layer.appendChild(burst);
      setTimeout(() => burst.remove(), 650);
    }

    _stats() {
      return { score: this.score, combo: this.combo, maxCombo: this.maxCombo, hits: this.hits, misses: this.misses };
    }

    _loop() {
      if (!this.running || this.paused) return;
      const t = this.now();
      const fall = this.fallMs();
      const total = this.song.notes.length;

      // determine current guidance target (earliest unresolved note approaching)
      let target = null;

      for (const n of this.notes) {
        if (!n.spawned && t >= n.time - fall) {
          this._makeTile(n);
          n.spawned = true;
        }
        if (n.spawned && n.el && !n.hit) {
          const progress = (t - (n.time - fall)) / fall; // 0..1 at hit line
          if (n.holding && t >= n.time) {
            // pin the pill's head at the line and consume it with light
            n.el.style.transform = `translate(${n.x}px, ${this.hitLineY - n.tileH}px)`;
            const frac = Math.min(1, (t - n.time) / (n.durMs * HOLD_FRAC));
            if (n.fillEl) n.fillEl.style.height = (frac * 100) + "%";
            if (frac >= 1) this._completeHold(n);
          } else {
            const centerY = progress * this.hitLineY; // tile bottom edge crosses line at note.time
            n.el.style.transform = `translate(${n.x}px, ${centerY - n.tileH}px)`;
            if (!n.holding && !n.headHit) {
              if (!n.missed && progress > 1.06) {
                this._registerMiss(n);
                const el = n.el;
                setTimeout(() => { if (el) el.remove(); }, 220);
              }
              // light up the key only as the note actually reaches the line ("press now")
              if (!n.missed && target === null && progress > 0.9 && progress < 1.15) {
                target = n.midi;
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
        const p = Math.max(0, Math.min(1, (t - (fall + 200)) / (this.endTime - (fall + 200))));
        this.on.progress(p);
      }

      if (t >= this.endTime) {
        this.running = false;
        cancelAnimationFrame(this.raf);
        const acc = total ? this.hits / total : 0;
        const stars = acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : acc > 0 ? 1 : 0;
        if (this.on.end) this.on.end({ stats: this._stats(), total, accuracy: acc, stars });
        return;
      }
      this.raf = requestAnimationFrame(this._loop);
    }
  }

  window.GameEngine = GameEngine;
  window.PIANO_DIFFICULTY = DIFFICULTY;
})();
