// Piano Pop — UI components (Menu, Piano, Game, Results)
const { useState, useEffect, useRef, useCallback } = React;

/* ---------------- Icons ---------------- */
function Icon({ name, ...p }) {
  const paths = {
    play: <path d="M8 5v14l11-7z" />,
    pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
    note: <path d="M9 17V5l10-2v12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    home: <path d="M3 11l9-8 9 8M5 9.5V21h14V9.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    replay: <path d="M4 12a8 8 0 1 1 2.3 5.6M4 12V6m0 6h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    sound: <path d="M4 9v6h4l5 4V5L8 9H4zM16 9a3 3 0 0 1 0 6M18.5 7a6 6 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
    mute: <path d="M4 9v6h4l5 4V5L8 9H4zM21 9l-5 6M16 9l5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>{paths[name]}</svg>
  );
}

function Star({ className, ...p }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

/* ---------------- Ambient background ---------------- */
function Ambient() {
  const sparkles = [
    ["18%", "40%", 0, 22, "#fff"], ["80%", "55%", 1.2, 18, "#fff7c2"],
    ["30%", "70%", 0.6, 16, "#ffd7f2"], ["70%", "32%", 1.8, 20, "#fff"],
    ["50%", "16%", 0.9, 14, "#e7d4ff"], ["10%", "62%", 1.5, 16, "#fff7c2"],
    ["90%", "24%", 0.3, 18, "#ffd7f2"], ["60%", "72%", 2.1, 14, "#fff"],
    ["42%", "48%", 1.0, 12, "#fff"], ["24%", "22%", 0.5, 16, "#e7d4ff"],
  ];
  return (
    <div className="ambient">
      <div className="cloud" style={{ width: 140, height: 46, left: "8%", top: "14%", animation: "drift 9s ease-in-out infinite alternate" }} />
      <div className="cloud" style={{ width: 100, height: 34, right: "12%", top: "22%", animation: "drift 11s ease-in-out infinite alternate" }} />
      <div className="cloud" style={{ width: 120, height: 40, left: "62%", top: "8%", animation: "drift 13s ease-in-out infinite alternate" }} />
      {sparkles.map((s, i) => (
        <Star key={i} className="star" style={{ left: s[0], top: s[1], width: s[3], height: s[3], color: s[4], animation: `twinkle 3s ease-in-out ${s[2]}s infinite` }} />
      ))}
    </div>
  );
}

/* ---------------- Menu ---------------- */
function Menu({ song, onPlay }) {
  return (
    <div className="screen active">
      <Ambient />
      <div className="menu-wrap">
        <div className="logo">
          <div className="logo-badge"><Icon name="note" style={{ color: "#fff", width: 46, height: 46 }} /></div>
        </div>
        <h1 className="title">Piano <span className="pop">Pop</span></h1>
        <p className="tagline">Catch the magic notes and play real songs!</p>

        <div className="song-card">
          <div className="song-thumb"><Star className="" style={{ width: 46, height: 46, color: "#fff" }} /></div>
          <div className="song-info">
            <h3>{song.title}</h3>
            <p>{song.subtitle} · {song.notes.length} notes</p>
            <span className="diff-dots">
              {[0, 1, 2].map((i) => <i key={i} className={i < song.difficulty ? "on" : ""} />)}
            </span>
          </div>
        </div>

        <button className="btn btn-play" onClick={onPlay}>
          <Icon name="play" /> Let's Play!
        </button>
        <div className="hint-row">Tap the glowing key when a note reaches the bottom ✦</div>
      </div>
    </div>
  );
}

/* ---------------- Piano keyboard ---------------- */
const Piano = React.forwardRef(function Piano({ keys, guideMidi, onPress, onRelease }, ref) {
  const whites = keys.filter((k) => k.type === "white");
  const blacks = keys.filter((k) => k.type === "black");
  const n = whites.length;
  const press = (e, midi) => {
    e.preventDefault();
    e.currentTarget.classList.add("down");
    onPress(midi);
  };
  const release = (e, midi) => {
    e.currentTarget.classList.remove("down");
    if (onRelease) onRelease(midi);
  };
  return (
    <div className="keyboard" ref={ref}>
      {whites.map((k) => (
        <button
          key={k.id}
          className={"wkey" + (guideMidi === k.id ? " guide" : "")}
          data-key={k.id}
          data-type="white"
          onPointerDown={(e) => press(e, k.id)}
          onPointerUp={(e) => release(e, k.id)}
          onPointerLeave={(e) => release(e, k.id)}
          onPointerCancel={(e) => release(e, k.id)}
        >
          <span className="klabel">{k.letter}</span>
        </button>
      ))}
      {blacks.map((k) => (
        <button
          key={k.id}
          className="bkey"
          data-key={k.id}
          data-type="black"
          style={{
            width: `calc((100% - ${(n - 1) * 6}px) / ${n} * 0.6)`,
            left: `calc((100% - ${(n - 1) * 6}px) / ${n} * ${k.whiteIndex + 1} + ${k.whiteIndex * 6}px)`,
          }}
          onPointerDown={(e) => press(e, k.id)}
          onPointerUp={(e) => release(e, k.id)}
          onPointerLeave={(e) => release(e, k.id)}
          onPointerCancel={(e) => release(e, k.id)}
        />
      ))}
    </div>
  );
});

/* ---------------- Game screen ---------------- */
function Game({ song, settings, muted, onToggleMute, onFinish, onExit }) {
  const layerRef = useRef(null);
  const keyboardRef = useRef(null);
  const engineRef = useRef(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progress, setProgress] = useState(0);
  const [guideMidi, setGuideMidi] = useState(null);
  const [count, setCount] = useState(3);
  const [paused, setPaused] = useState(false);
  const comboPopRef = useRef(null);

  const flashKey = useCallback((midi, cls) => {
    const el = keyboardRef.current && keyboardRef.current.querySelector(`[data-key="${midi}"]`);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 160);
  }, []);

  const showCombo = useCallback((c) => {
    const el = comboPopRef.current;
    if (!el) return;
    el.textContent = c + "x COMBO!";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }, []);

  // set up engine + countdown
  useEffect(() => {
    const engine = new GameEngine({
      layer: layerRef.current,
      keyboardEl: keyboardRef.current,
      song,
      settings,
      on: {
        hit: ({ note, combo }) => {
          setScore(engine.score);
          setCombo(combo);
          flashKey(note.midi, "flash");
          if (combo > 0 && combo % 5 === 0) showCombo(combo);
        },
        miss: () => { setCombo(0); },
        stats: (s) => { setScore(s.score); },
        target: (midi) => setGuideMidi(settings.guideKeys ? midi : null),
        progress: (p) => setProgress(p),
        end: (res) => onFinish(res),
      },
    });
    engineRef.current = engine;

    let c = 3;
    setCount(c);
    const tick = setInterval(() => {
      c -= 1;
      if (c <= 0) {
        clearInterval(tick);
        setCount(null);
        engine.start();
      } else {
        setCount(c);
      }
    }, 700);

    const onResize = () => engine.measure();
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(tick);
      window.removeEventListener("resize", onResize);
      engine.stop();
    };
  }, []);

  const handlePress = (midi) => {
    window.PianoAudio.play(midi);
    if (engineRef.current && !paused && count === null) engineRef.current.press(midi);
  };

  const handleRelease = (midi) => {
    if (engineRef.current && count === null) engineRef.current.release(midi);
  };

  const togglePause = () => {
    const e = engineRef.current;
    if (!e) return;
    if (paused) { e.resume(); setPaused(false); }
    else { e.pause(); setPaused(true); }
  };

  return (
    <div className="screen active">
      <div className="stage">
        <div className="hud">
          <button className="hud-btn" onClick={togglePause} title="Pause"><Icon name="pause" /></button>
          <div className="hud-stat">
            <div className="label">Score</div>
            <div className="value">{score}</div>
          </div>
          <div className="hud-song">{song.title}</div>
          <div className="hud-stat">
            <div className="label">Combo</div>
            <div className="value">{combo > 0 ? combo + "x" : "—"}</div>
          </div>
          <button className="hud-btn" onClick={onToggleMute} title="Sound"><Icon name={muted ? "mute" : "sound"} /></button>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: progress * 100 + "%" }} /></div>

        <div className="field">
          <div className="lanes">
            {PIANO_KEYS.filter((k) => k.type === "white").map((k) => <div key={k.id} className="lane" />)}
          </div>
          <div className="notes-layer" ref={layerRef} />
          <div className="hitline" />
          <div className="combo-pop" ref={comboPopRef} />
        </div>

        <div className="keyboard-wrap">
          <Piano ref={keyboardRef} keys={PIANO_KEYS} guideMidi={guideMidi} onPress={handlePress} onRelease={handleRelease} />
        </div>

        {count !== null && (
          <div className="countdown"><div className="count-num" key={count}>{count}</div></div>
        )}
        {paused && (
          <div className="overlay">
            <div className="overlay-card">
              <h2>Paused</h2>
              <div className="overlay-actions">
                <button className="btn btn-resume" onClick={togglePause}>Resume</button>
                <button className="btn btn-secondary" onClick={onExit}>Back to Menu</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Results ---------------- */
function Results({ result, song, onReplay, onMenu }) {
  const { stats, accuracy, stars } = result;
  const confetti = stars >= 1;
  const colors = ["#FFD23F", "#FF7BAC", "#44D7A8", "#4F93FF", "#FF9F45", "#9B7EDE"];
  const praise = stars >= 3 ? "Superstar!" : stars === 2 ? "Great job!" : stars === 1 ? "Nice try!" : "Keep practicing!";
  return (
    <div className="screen active">
      <Ambient />
      {confetti && (
        <div className="confetti">
          {Array.from({ length: 60 }).map((_, i) => (
            <i key={i} style={{
              left: Math.random() * 100 + "%",
              background: colors[i % colors.length],
              animationDuration: 2.4 + Math.random() * 2 + "s",
              animationDelay: Math.random() * 1.5 + "s",
            }} />
          ))}
        </div>
      )}
      <div className="result-card">
        <h2>{praise}</h2>
        <p className="result-sub">{song.title}</p>
        <div className="stars">
          {[0, 1, 2].map((i) => <Star key={i} className={"star-slot" + (i < stars ? " lit" : "")} />)}
        </div>
        <div className="result-stats">
          <div className="rstat"><div className="v">{stats.score}</div><div className="l">Score</div></div>
          <div className="rstat"><div className="v">{Math.round(accuracy * 100)}%</div><div className="l">Accuracy</div></div>
          <div className="rstat"><div className="v">{stats.maxCombo}x</div><div className="l">Best Combo</div></div>
        </div>
        <div className="result-actions">
          <button className="btn btn-secondary" onClick={onMenu}><Icon name="home" /> Menu</button>
          <button className="btn btn-resume" onClick={onReplay}><Icon name="replay" /> Play Again</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Menu, Game, Results, Piano, Icon, Star, Ambient });
