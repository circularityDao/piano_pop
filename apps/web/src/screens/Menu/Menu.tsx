// Menu screen — transliterated from recovered module `e469d512`. Additions over
// the original: the Settings entry point (gear, plan §3-D7) and a multi-song
// picker (the original shipped a single hard-coded song; we now list the song
// registry; tapping a song goes straight to the level picker — no Play button).
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import { Star } from "../../components/Star";
import type { Song } from "../../songs/schema";

interface MenuProps {
  songs: Song[];
  onSelectSong: (id: string) => void;
  onSettings: () => void;
}

export function Menu({ songs, onSelectSong, onSettings }: MenuProps) {
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

        {/* Song picker — tap a card to choose a song and pick a level. */}
        <div className="song-list">
          {songs.map((song) => (
            <button
              key={song.id}
              className="song-card song-card-pick"
              onClick={() => onSelectSong(song.id)}
            >
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
            </button>
          ))}
        </div>

        <div className="hint-row">Tap a song to choose your level ✦</div>
      </div>
    </div>
  );
}
