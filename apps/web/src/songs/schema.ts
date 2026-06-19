// Canonical note + song schema — preserved EXACTLY from the recovered bundle
// (plan §3-D6). The Phase-1 AI melody adapter MUST emit this same shape so a
// transcription feeds the tile game unchanged.

export interface Note {
  /** MIDI number (C4 = 60). */
  midi: number;
  /** Single note letter shown on the tile/key, e.g. "C", "F#". */
  letter: string;
  /** Onset position in beats from the start of the song. */
  beat: number;
  /** Duration in beats. Notes with beats >= 2 become hold/sustain tiles. */
  beats: number;
}

export interface Song {
  id: string;
  title: string;
  subtitle: string;
  /** 1..3 difficulty dots shown on the menu song card. */
  difficulty: number;
  /** Milliseconds per beat at the song's notated tempo. */
  beatMs: number;
  /** Total length in beats (sum of note durations as built). */
  totalBeats: number;
  notes: Note[];
  /** Optional auto-played backing track (everything that isn't the player's part). */
  accompaniment?: AccompNote[];
}

/**
 * A backing-track note the game plays automatically — it is NOT a tile and the
 * player never presses it. Together the player's melody (`notes`) and the
 * accompaniment reconstruct the original song. Absolute beat positions sit on
 * the SAME grid as Note.beat so the two stay in sync.
 */
export interface AccompNote {
  midi: number;
  /** Onset position in beats from the start of the song. */
  beat: number;
  /** Duration in beats. */
  beats: number;
}

/** A single physical key on the rendered keyboard. */
export interface PianoKey {
  /** MIDI number, used as the React key and the data-key attribute. */
  id: number;
  /** Note name with octave, e.g. "C4", "F#5". */
  name: string;
  /** Note letter without octave, e.g. "C", "F#". */
  letter: string;
  type: "white" | "black";
  /** Index of the white key this key belongs to / sits after (for layout). */
  whiteIndex: number;
}
