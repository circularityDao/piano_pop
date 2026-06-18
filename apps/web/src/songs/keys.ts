// Keyboard layout — transliterated VERBATIM from the recovered bundle module
// `a1077bf1` (Keyboard layout + song data).
//
// NOTE on the original source comment "Build two octaves of keys: C4 .. B5":
// that comment is WRONG (plan §4). The code iterates octaves [4, 5, 6], so the
// real layout is THREE octaves C4..B6 = 21 white + 15 black. We keep the true
// behavior and drop the misleading comment.

import type { PianoKey } from "./schema";

// Note name -> semitone offset within octave.
const NAME_TO_SEMI: Record<string, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

export function midiOf(name: string): number {
  const m = name.match(/^([A-G]#?)(\d)$/);
  if (!m) throw new Error(`bad note name: ${name}`);
  const semi = NAME_TO_SEMI[m[1]];
  const oct = parseInt(m[2], 10);
  return (oct + 1) * 12 + semi; // C4 -> 60
}

export function letterOf(name: string): string {
  return name.replace(/\d/, "");
}

const WHITE_ORDER = ["C", "D", "E", "F", "G", "A", "B"];
// black key that follows a white
const BLACK_AFTER: Record<string, string> = {
  C: "C#",
  D: "D#",
  F: "F#",
  G: "G#",
  A: "A#",
};

function buildKeys(): PianoKey[] {
  const keys: PianoKey[] = [];
  let whiteIndex = 0;
  [4, 5, 6].forEach((oct) => {
    WHITE_ORDER.forEach((w) => {
      const wname = w + oct;
      keys.push({
        id: midiOf(wname),
        name: wname,
        letter: w,
        type: "white",
        whiteIndex,
      });
      if (BLACK_AFTER[w]) {
        const bname = BLACK_AFTER[w] + oct;
        keys.push({
          id: midiOf(bname),
          name: bname,
          letter: BLACK_AFTER[w],
          type: "black",
          whiteIndex,
        });
      }
      whiteIndex++;
    });
  });
  return keys;
}

// 3 octaves C4..B6 = 21 white + 15 black.
export const PIANO_KEYS: PianoKey[] = buildKeys();
