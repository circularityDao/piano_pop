// Game HUD (pause, score, song title, combo, mute) — extracted from the
// recovered Game component (module `e469d512`) into its own component for
// clarity. Markup and class names are unchanged from the original.
import { Icon } from "./Icon";

interface HUDProps {
  songTitle: string;
  score: number;
  combo: number;
  muted: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

export function HUD({
  songTitle,
  score,
  combo,
  muted,
  onTogglePause,
  onToggleMute,
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
      <button className="hud-btn" onClick={onToggleMute} title="Sound">
        <Icon name={muted ? "mute" : "sound"} />
      </button>
    </div>
  );
}
