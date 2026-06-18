// The single built-in demo song — transliterated VERBATIM from recovered module
// `a1077bf1`. "Twinkle Twinkle Little Star" (beatMs 600, difficulty 1) is the
// default demo level (plan §4).

import type { Note, Song } from "../schema";
import { midiOf, letterOf } from "../keys";

// Melody as [noteName, beats].
type MelodyEntry = [string, number];

const q = 1,
  h = 2;
const twinkleA: MelodyEntry[] = [
  ["C4", q],
  ["C4", q],
  ["G4", q],
  ["G4", q],
  ["A4", q],
  ["A4", q],
  ["G4", h],
];
const twinkleB: MelodyEntry[] = [
  ["F4", q],
  ["F4", q],
  ["E4", q],
  ["E4", q],
  ["D4", q],
  ["D4", q],
  ["C4", h],
];
const twinkleC: MelodyEntry[] = [
  ["G4", q],
  ["G4", q],
  ["F4", q],
  ["F4", q],
  ["E4", q],
  ["E4", q],
  ["D4", h],
];
const twinkleMelody: MelodyEntry[] = ([] as MelodyEntry[]).concat(
  twinkleA,
  twinkleB,
  twinkleC,
  twinkleC,
  twinkleA,
  twinkleB
);

type SongMeta = Omit<Song, "notes" | "totalBeats">;

export function buildSong(meta: SongMeta, melody: MelodyEntry[]): Song {
  const notes: Note[] = [];
  let beat = 0;
  melody.forEach((m) => {
    const [name, dur] = m;
    notes.push({
      midi: midiOf(name),
      letter: letterOf(name),
      beat,
      beats: dur,
    });
    beat += dur;
  });
  return Object.assign({}, meta, { notes, totalBeats: beat });
}

export const twinkle: Song = buildSong(
  {
    id: "twinkle",
    title: "Twinkle Twinkle Little Star",
    subtitle: "Your first song",
    difficulty: 1,
    beatMs: 600,
  },
  twinkleMelody
);

// Mirrors the recovered `window.PIANO_SONGS` map (keyed by id).
export const SONGS: Record<string, Song> = {
  twinkle,
};
