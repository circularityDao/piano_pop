// Menu screen — transliterated VERBATIM from recovered module `e469d512`.
// The only addition is the small Settings entry point (gear button), an
// intentional new addition per plan §3-D7 (the original standalone app had no
// visible settings). Everything else is unchanged.
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import { Star } from "../../components/Star";
import type { Song } from "../../songs/schema";

interface MenuProps {
  song: Song;
  onPlay: () => void;
  onSettings: () => void;
}

export function Menu({ song, onPlay, onSettings }: MenuProps) {
  return (
    <div className="screen active">
      <Ambient />
      {/* NEW (plan §3-D7): Settings entry point. */}
      <button
        className="menu-settings-btn"
        onClick={onSettings}
        title="Settings"
        aria-label="Settings"
      >
        <Icon name="gear" />
      </button>
      <div className="menu-wrap">
        <div className="logo">
          <div className="logo-badge">
            <Icon name="note" style={{ color: "#fff", width: 46, height: 46 }} />
          </div>
        </div>
        <h1 className="title">
          Piano <span className="pop">Pop</span>
        </h1>
        <p className="tagline">Catch the magic notes and play real songs!</p>

        <div className="song-card">
          <div className="song-thumb">
            <Star className="" style={{ width: 46, height: 46, color: "#fff" }} />
          </div>
          <div className="song-info">
            <h3>{song.title}</h3>
            <p>
              {song.subtitle} · {song.notes.length} notes
            </p>
            <span className="diff-dots">
              {[0, 1, 2].map((i) => (
                <i key={i} className={i < song.difficulty ? "on" : ""} />
              ))}
            </span>
          </div>
        </div>

        <button className="btn btn-play" onClick={onPlay}>
          <Icon name="play" /> Let's Play!
        </button>
        <div className="hint-row">
          Tap the glowing key when a note reaches the bottom ✦
        </div>
      </div>
    </div>
  );
}
