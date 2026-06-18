// Menu screen — transliterated from recovered module `e469d512`. Additions over
// the original: the Settings entry point (gear, plan §3-D7) and a multi-song
// picker (the original shipped a single hard-coded song; we now list the song
// registry and let the player choose before hitting Play -> level select).
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import { Star } from "../../components/Star";
import type { Song } from "../../songs/schema";

interface MenuProps {
  songs: Song[];
  selectedId: string;
  onSelectSong: (id: string) => void;
  onPlay: () => void;
  onSettings: () => void;
}

export function Menu({
  songs,
  selectedId,
  onSelectSong,
  onPlay,
  onSettings,
}: MenuProps) {
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

        {/* Song picker — tap a card to choose, then Play. */}
        <div className="song-list">
          {songs.map((song) => (
            <button
              key={song.id}
              className={
                "song-card song-card-pick" +
                (song.id === selectedId ? " selected" : "")
              }
              onClick={() => onSelectSong(song.id)}
              aria-pressed={song.id === selectedId}
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
