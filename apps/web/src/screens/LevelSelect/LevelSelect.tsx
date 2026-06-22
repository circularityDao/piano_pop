// LevelSelect — pick a difficulty before a song starts (new screen; not in the
// recovered bundle). The three levels map 1:1 to the engine's DIFFICULTY tiers
// (easy / normal / challenge), which scale tile speed (beatScale + fallMs).
// Choosing a level is the user gesture that starts the run, so audio is
// unlocked here in App's onSelect handler.
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import type { Difficulty, GameMode } from "../../state/usePreferences";
import type { Song } from "../../songs/schema";

interface Level {
  id: Difficulty;
  name: string;
  blurb: string;
  dots: number;
}

const LEVELS: Level[] = [
  { id: "easy", name: "Easy", blurb: "Slow, gentle tiles — learn the tune", dots: 1 },
  { id: "normal", name: "Normal", blurb: "A steady, balanced challenge", dots: 2 },
  { id: "challenge", name: "Challenge", blurb: "Fast tiles, full energy", dots: 3 },
];

interface ModeOption {
  id: GameMode;
  name: string;
}

// Two play styles. Keyboard = the original full 3-octave board; Tiles = the
// classic 4-lane Piano-Tiles board.
const MODES: ModeOption[] = [
  { id: "keyboard", name: "🎹 Keyboard" },
  { id: "lanes", name: "🎵 4-Lane Tiles" },
];

interface LevelSelectProps {
  song: Song;
  mode: GameMode;
  onSetMode: (mode: GameMode) => void;
  onSelect: (difficulty: Difficulty) => void;
  onBack: () => void;
}

export function LevelSelect({
  song,
  mode,
  onSetMode,
  onSelect,
  onBack,
}: LevelSelectProps) {
  return (
    <div className="screen active">
      <Ambient />
      <div className="menu-wrap">
        <button className="btn level-back" onClick={onBack} aria-label="Back">
          ‹ Back
        </button>
        <h1 className="title level-title">Choose your level</h1>
        <p className="tagline">
          {song.title} · {song.notes.length} notes
        </p>

        {/* Play-style picker (NEW): full keyboard vs. 4-lane tiles. Persisted. */}
        <div className="mode-picker">
          <span className="mode-picker-label">Play style</span>
          <div className="seg mode-seg">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={"seg-btn" + (mode === m.id ? " on" : "")}
                aria-pressed={mode === m.id}
                onClick={() => onSetMode(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="level-list">
          {LEVELS.map((lvl) => (
            <button
              key={lvl.id}
              className="song-card level-card"
              onClick={() => onSelect(lvl.id)}
            >
              <div className="song-thumb">
                <Icon name="play" style={{ width: 40, height: 40, color: "#fff" }} />
              </div>
              <div className="song-info">
                <h3>{lvl.name}</h3>
                <p>{lvl.blurb}</p>
                <span className="diff-dots">
                  {[0, 1, 2].map((i) => (
                    <i key={i} className={i < lvl.dots ? "on" : ""} />
                  ))}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
