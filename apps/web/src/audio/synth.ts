// Piano audio engine — soft mallet/piano tone via Web Audio.
// Transliterated VERBATIM from recovered module `04744ceb`. Every constant is
// reproduced exactly (plan §3-D5 / §4): synth fidelity is non-negotiable.
//
//   voice = triangle×1 @0.6 + sine×2 @0.28 + sine×3 @0.12
//   per-voice lowpass 4200 -> 900 Hz over 1.4s
//   master gain 0.9 -> master lowpass 6500 Hz
//   attack 6ms, peak 0.5×velocity, exponential decay to now+1.6s
//   oscillator stop 1.7s, voice disconnect 1.9s
//   fully synthesized — no samples.

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

interface Partial {
  type: OscillatorType;
  mul: number;
  gain: number;
}

class PianoAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    this.ctx = new AC!();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    // gentle high shelf cut to soften
    const shelf = this.ctx.createBiquadFilter();
    shelf.type = "lowpass";
    shelf.frequency.value = 6500;
    this.master.connect(shelf);
    shelf.connect(this.ctx.destination);
  }

  /** Capacitor/iOS seam: ask the context to resume (after interruption). */
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  static midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  setMuted(m: boolean): void {
    this.muted = m;
  }

  play(midi: number, velocity = 1): void {
    if (this.muted) return;
    this.ensure();
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const freq = PianoAudio.midiToFreq(midi);

    const voice = ctx.createGain();
    voice.gain.value = 0;
    voice.connect(this.master!);

    // soft lowpass that closes over time -> mellow decay
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4200, now);
    lp.frequency.exponentialRampToValueAtTime(900, now + 1.4);
    lp.connect(voice);

    // partials: fundamental + a couple harmonics for a bell/piano blend
    const partials: Partial[] = [
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
      try {
        voice.disconnect();
      } catch {
        /* already disconnected */
      }
    }, 1900);
  }
}

// Singleton, mirroring the recovered `window.PianoAudio`.
export const pianoAudio = new PianoAudio();
export type { PianoAudio };
