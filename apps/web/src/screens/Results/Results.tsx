// Results screen — transliterated VERBATIM from recovered module `e469d512`.
// 0–3 stars (accuracy >=0.9 / >=0.6 / >0), confetti, score/accuracy/best-combo.
import { Ambient } from "../../components/Ambient";
import { Icon } from "../../components/Icon";
import { Star } from "../../components/Star";
import type { EndResult } from "../../engine/GameEngine";
import type { Song } from "../../songs/schema";

interface ResultsProps {
  result: EndResult;
  song: Song;
  onReplay: () => void;
  onMenu: () => void;
}

export function Results({ result, song, onReplay, onMenu }: ResultsProps) {
  const { stats, accuracy, stars } = result;
  const confetti = stars >= 1;
  const colors = [
    "#FFD23F",
    "#FF7BAC",
    "#44D7A8",
    "#4F93FF",
    "#FF9F45",
    "#9B7EDE",
  ];
  const praise =
    stars >= 3
      ? "Superstar!"
      : stars === 2
        ? "Great job!"
        : stars === 1
          ? "Nice try!"
          : "Keep practicing!";
  return (
    <div className="screen active">
      <Ambient />
      {confetti && (
        <div className="confetti">
          {Array.from({ length: 60 }).map((_, i) => (
            <i
              key={i}
              style={{
                left: Math.random() * 100 + "%",
                background: colors[i % colors.length],
                animationDuration: 2.4 + Math.random() * 2 + "s",
                animationDelay: Math.random() * 1.5 + "s",
              }}
            />
          ))}
        </div>
      )}
      <div className="result-card">
        <h2>{praise}</h2>
        <p className="result-sub">{song.title}</p>
        <div className="stars">
          {[0, 1, 2].map((i) => (
            <Star
              key={i}
              className={"star-slot" + (i < stars ? " lit" : "")}
            />
          ))}
        </div>
        <div className="result-stats">
          <div className="rstat">
            <div className="v">{stats.score}</div>
            <div className="l">Score</div>
          </div>
          <div className="rstat">
            <div className="v">{Math.round(accuracy * 100)}%</div>
            <div className="l">Accuracy</div>
          </div>
          <div className="rstat">
            <div className="v">{stats.maxCombo}x</div>
            <div className="l">Best Combo</div>
          </div>
        </div>
        <div className="result-actions">
          <button className="btn btn-secondary" onClick={onMenu}>
            <Icon name="home" /> Menu
          </button>
          <button className="btn btn-resume" onClick={onReplay}>
            <Icon name="replay" /> Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
