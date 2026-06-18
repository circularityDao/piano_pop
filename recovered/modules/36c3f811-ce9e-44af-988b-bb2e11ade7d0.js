// Piano Pop — root app + Tweaks
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "difficulty": "easy",
  "noteColor": "single",
  "showLetters": true,
  "guideKeys": true,
  "sky": ["#d79bff", "#ff93d2"]
}/*EDITMODE-END*/;

const SKY_OPTIONS = [
  ["#d79bff", "#ff93d2"], // unicorn
  ["#ffc2e8", "#bfa8ff"], // cotton candy
  ["#a8d6ff", "#d6a8ff"], // mermaid
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState("menu");
  const [result, setResult] = React.useState(null);
  const [muted, setMuted] = React.useState(false);
  const [runId, setRunId] = React.useState(0);

  const song = window.PIANO_SONGS.twinkle;

  React.useEffect(() => { window.PianoAudio.setMuted(muted); }, [muted]);

  const settings = {
    difficulty: t.difficulty,
    colorMode: t.noteColor,
    showLetters: t.showLetters,
    guideKeys: t.guideKeys,
  };

  const startGame = () => {
    window.PianoAudio.ensure();
    setRunId((r) => r + 1);
    setScreen("game");
  };
  const finish = (res) => { setResult(res); setScreen("results"); };
  const replay = () => { setRunId((r) => r + 1); setScreen("game"); };
  const toMenu = () => setScreen("menu");

  const appStyle = { "--sky1": t.sky[0], "--sky2": t.sky[1] };

  return (
    <div className="app" style={appStyle}>
      {screen === "menu" && <Menu song={song} onPlay={startGame} />}
      {screen === "game" && (
        <Game
          key={runId}
          song={song}
          settings={settings}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onFinish={finish}
          onExit={toMenu}
        />
      )}
      {screen === "results" && result && (
        <Results result={result} song={song} onReplay={replay} onMenu={toMenu} />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Difficulty" />
        <TweakRadio
          label="Level" value={t.difficulty}
          options={["easy", "normal", "challenge"]}
          onChange={(v) => setTweak("difficulty", v)}
        />
        <TweakSection label="Falling notes" />
        <TweakRadio
          label="Color" value={t.noteColor}
          options={["single", "rainbow"]}
          onChange={(v) => setTweak("noteColor", v)}
        />
        <TweakToggle label="Show note letters" value={t.showLetters} onChange={(v) => setTweak("showLetters", v)} />
        <TweakToggle label="Highlight next key" value={t.guideKeys} onChange={(v) => setTweak("guideKeys", v)} />
        <TweakSection label="Scene" />
        <TweakColor
          label="Sky" value={t.sky}
          options={SKY_OPTIONS}
          onChange={(v) => setTweak("sky", v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
