// Keyboard layout + song data.
(function () {
  // Note name -> semitone offset within octave
  const NAME_TO_SEMI = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

  function midiOf(name) {
    const m = name.match(/^([A-G]#?)(\d)$/);
    const semi = NAME_TO_SEMI[m[1]];
    const oct = parseInt(m[2], 10);
    return (oct + 1) * 12 + semi; // C4 -> 60
  }
  function letterOf(name) {
    return name.replace(/\d/, "");
  }

  // Build two octaves of keys: C4 .. B5
  const WHITE_ORDER = ["C", "D", "E", "F", "G", "A", "B"];
  const BLACK_AFTER = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" }; // black key that follows a white

  const keys = []; // {id(midi), name, letter, type, whiteIndex}
  let whiteIndex = 0;
  [4, 5, 6].forEach((oct) => {
    WHITE_ORDER.forEach((w) => {
      const wname = w + oct;
      keys.push({ id: midiOf(wname), name: wname, letter: w, type: "white", whiteIndex: whiteIndex });
      if (BLACK_AFTER[w]) {
        const bname = BLACK_AFTER[w] + oct;
        keys.push({ id: midiOf(bname), name: bname, letter: BLACK_AFTER[w], type: "black", whiteIndex: whiteIndex });
      }
      whiteIndex++;
    });
  });

  // ---- Songs (melody as [noteName, beats]) ----
  const q = 1, h = 2;
  const twinkleA = [["C4", q], ["C4", q], ["G4", q], ["G4", q], ["A4", q], ["A4", q], ["G4", h]];
  const twinkleB = [["F4", q], ["F4", q], ["E4", q], ["E4", q], ["D4", q], ["D4", q], ["C4", h]];
  const twinkleC = [["G4", q], ["G4", q], ["F4", q], ["F4", q], ["E4", q], ["E4", q], ["D4", h]];
  const twinkleMelody = [].concat(twinkleA, twinkleB, twinkleC, twinkleC, twinkleA, twinkleB);

  function buildSong(meta, melody) {
    const notes = [];
    let beat = 0;
    melody.forEach((m) => {
      const [name, dur] = m;
      notes.push({
        midi: midiOf(name),
        letter: letterOf(name),
        beat: beat,
        beats: dur,
      });
      beat += dur;
    });
    return Object.assign({}, meta, { notes, totalBeats: beat });
  }

  const SONGS = {
    twinkle: buildSong(
      { id: "twinkle", title: "Twinkle Twinkle Little Star", subtitle: "Your first song", difficulty: 1, beatMs: 600 },
      twinkleMelody
    ),
  };

  window.PIANO_KEYS = keys;
  window.PIANO_SONGS = SONGS;
})();
