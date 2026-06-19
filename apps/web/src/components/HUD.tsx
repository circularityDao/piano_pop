// Game HUD (pause, score, song title, combo, mute) — extracted from the
// recovered Game component (module `e469d512`) into its own component for
// clarity. Markup and class names match the original; the backing-track toggle
// is a new addition (only shown when the song has a backing track).
import { Icon } from "./Icon";

interface HUDProps {
  songTitle: string;
  score: number;
  combo: number;
  muted: boolean;
  /** Whether this song has a backing track (show the toggle only then). */
  hasBacking: boolean;
  backingOn: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onToggleBacking: () => void;
}

export function HUD({
  songTitle,
  score,
  combo,
  muted,
  hasBacking,
  backingOn,
  onTogglePause,
  onToggleMute,
  onToggleBacking,
}: HUDProps) {
  return (
    <div className="hud">
      <button className="hud-btn" onClick={onTogglePause} title="Pause">
        <Icon name="pause" />
      </button>
      <div className="hud-stat">
        <div className="label">Score</div>
        <div className="value">{score}</div>
      </div>
      <div className="hud-song">{songTitle}</div>
      <div className="hud-stat">
        <div className="label">Combo</div>
        <div className="value">{combo > 0 ? combo + "x" : "—"}</div>
      </div>
      {hasBacking && (
        <button
          className={"hud-btn" + (backingOn ? "" : " hud-btn-off")}
          onClick={onToggleBacking}
          title={backingOn ? "Backing track: on" : "Backing track: off"}
          aria-pressed={backingOn}
        >
          <Icon name="note" />
        </button>
      )}
      <button className="hud-btn" onClick={onToggleMute} title="Sound">
        <Icon name={muted ? "mute" : "sound"} />
      </button>
    </div>
  );
}
