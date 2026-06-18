// LevelSelect — pick a difficulty before a song starts (new screen; not in the
// recovered bundle). The three levels map 1:1 to the engine's DIFFICULTY tiers
// (easy / normal / challenge), which scale tile speed (beatScale + fallMs).
// Choosing a level is the user gesture that starts the run, so audio is
// unlocked here in App's onSelect handler.
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import type { Difficulty } from "../../state/usePreferences";
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

interface LevelSelectProps {
  song: Song;
  onSelect: (difficulty: Difficulty) => void;
  onBack: () => void;
}

export function LevelSelect({ song, onSelect, onBack }: LevelSelectProps) {
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
