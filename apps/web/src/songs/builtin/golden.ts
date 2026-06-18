// "Golden" (HUNTR/X — KPop Demon Hunters) — a curated verse + chorus level.
//
// Imported from a piano-solo MIDI (KPOP_Demon_Hunters_-_GOLDEN_-_Solo_-
// _Debra_VanHouten.mid) via scripts/parse-midi.mjs. The arrangement is a
// two-hand solo on a single MIDI track; we dropped everything below C4 (the
// left-hand accompaniment, also below this game's keyboard) and reduced the
// right hand to a monophonic top line. From that we hand-curated a tight
// verse -> chorus -> climax -> verse-outro section rather than ship the full
// ~6-minute reduction, whose instrumental runs play poorly as falling tiles.
//
// Every pitch lands in the C4..B6 keyboard, so no transposition was needed.
// Difficulty (easy/normal/challenge) is applied at play time by the engine's
// beatScale/fallMs — this is one song, selectable at three speeds.

import type { Song } from "../schema";
import { buildSong } from "./twinkle";

// Melody as [noteName, beats], same shape buildSong consumes.
type M = [string, number];

// The instantly recognizable verse hook ("A B B C B A G").
const verse: M[] = [
  ["A4", 0.25], ["B4", 0.75], ["B4", 0.75], ["C5", 0.25],
  ["B4", 0.75], ["A4", 0.25], ["G4", 0.75],
];

// The steady chorus theme — clean quarter-note motion that reads well as tiles.
const chorus: M[] = [
  ["E5", 1], ["E4", 1], ["G4", 1], ["C5", 1], ["B4", 1], ["D4", 1], ["G4", 1], ["E5", 1],
  ["D5", 1], ["F#4", 1], ["A4", 1], ["D5", 1], ["C5", 0.5], ["C5", 0.5], ["B4", 2.5],
];
const chorusB: M[] = [
  ["F#4", 1], ["E4", 1], ["G4", 1], ["C5", 1], ["B4", 1], ["D4", 1], ["F#4", 1], ["E5", 1],
  ["D5", 1], ["B4", 1.5], ["B4", 0.5], ["B4", 1.5],
];

// The high B5 lift that caps the chorus before the verse returns.
const climax: M[] = [["B5", 3]];

// Verse outro, resolving on a held G4.
const outro: M[] = [
  ["A4", 0.25], ["B4", 0.75], ["B4", 0.75], ["C5", 0.25], ["B4", 0.75], ["A4", 0.25], ["G4", 0.75],
  ["A4", 0.25], ["B4", 0.75], ["B4", 0.75], ["C5", 0.25], ["B4", 0.75], ["A4", 0.25], ["G4", 2],
];

const goldenMelody: M[] = ([] as M[]).concat(
  verse,
  verse,
  verse,
  chorus,
  chorusB,
  climax,
  outro
);

export const golden: Song = buildSong(
  {
    id: "golden",
    title: "Golden",
    subtitle: "HUNTR/X · KPop Demon Hunters",
    difficulty: 2,
    beatMs: 560,
  },
  goldenMelody
);
