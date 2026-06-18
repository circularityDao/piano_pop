// Piano audio engine — soft mallet/piano tone via Web Audio.
(function () {
  class PianoAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
    }
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      // gentle high shelf cut to soften
      const shelf = this.ctx.createBiquadFilter();
      shelf.type = "lowpass";
      shelf.frequency.value = 6500;
      this.master.connect(shelf);
      shelf.connect(this.ctx.destination);
    }
    static midiToFreq(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }
    setMuted(m) {
      this.muted = m;
    }
    play(midi, velocity = 1) {
      if (this.muted) return;
      this.ensure();
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const freq = PianoAudio.midiToFreq(midi);

      const voice = ctx.createGain();
      voice.gain.value = 0;
      voice.connect(this.master);

      // soft lowpass that closes over time -> mellow decay
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(4200, now);
      lp.frequency.exponentialRampToValueAtTime(900, now + 1.4);
      lp.connect(voice);

      // partials: fundamental + a couple harmonics for a bell/piano blend
      const partials = [
        { type: "triangle", mul: 1, gain: 0.6 },
        { type: "sine", mul: 2, gain: 0.28 },
        { type: "sine", mul: 3, gain: 0.12 },
      ];
      const oscs = partials.map((p) => {
        const o = ctx.createOscillator();
        o.type = p.type;
        o.frequency.value = freq * p.mul;
        const g = ctx.createGain();
        g.gain.value = p.gain;
        o.connect(g);
        g.connect(lp);
        return o;
      });

      const peak = 0.5 * velocity;
      const attack = 0.006;
      const decayTo = peak * 0.0008;
      voice.gain.setValueAtTime(0, now);
      voice.gain.linearRampToValueAtTime(peak, now + attack);
      voice.gain.exponentialRampToValueAtTime(Math.max(decayTo, 0.0001), now + 1.6);

      oscs.forEach((o) => {
        o.start(now);
        o.stop(now + 1.7);
      });
      setTimeout(() => {
        try { voice.disconnect(); } catch (e) {}
      }, 1900);
    }
  }
  window.PianoAudio = new PianoAudio();
})();
