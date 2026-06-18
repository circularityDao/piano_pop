// Piano Pop — root app. Transliterated from recovered module `36c3f811`, with
// the hidden TweaksPanel replaced by a real persisted Settings screen
// (plan §3-D7) and AudioContext unlock wired to the first tap (plan §7 step 7).
import { useEffect, useState, type CSSProperties } from "react";
import { Menu } from "./screens/Menu/Menu";
import { Game } from "./screens/Game/Game";
import { Results } from "./screens/Results/Results";
import { Settings } from "./screens/Settings/Settings";
import { usePreferences } from "./state/usePreferences";
import { pianoAudio } from "./audio/synth";
import { unlockAudio, installResumeHandlers } from "./audio/audioContext";
import { SONGS } from "./songs/builtin/twinkle";
import type { EndResult } from "./engine/GameEngine";

type Screen = "menu" | "game" | "results" | "settings";

export function App() {
  const [prefs, setPref] = usePreferences();
  const [screen, setScreen] = useState<Screen>("menu");
  const [result, setResult] = useState<EndResult | null>(null);
  const [muted, setMuted] = useState(false);
  const [runId, setRunId] = useState(0);

  const song = SONGS.twinkle;

  // Install iOS resume handlers once, up front.
  useEffect(() => {
    installResumeHandlers();
  }, []);

  useEffect(() => {
    pianoAudio.setMuted(muted);
  }, [muted]);

  // Maps prefs -> engine/game settings, exactly as the original derived them.
  const settings = {
    difficulty: prefs.difficulty,
    colorMode: prefs.noteColor,
    showLetters: prefs.showLetters,
    guideKeys: prefs.guideKeys,
  };

  const startGame = () => {
    // First-tap gesture: create/resume + silent-buffer unlock the AudioContext.
    pianoAudio.ensure();
    unlockAudio();
    setRunId((r) => r + 1);
    setScreen("game");
  };
  const finish = (res: EndResult) => {
    setResult(res);
    setScreen("results");
  };
  const replay = () => {
    setRunId((r) => r + 1);
    setScreen("game");
  };
  const toMenu = () => setScreen("menu");
  const toSettings = () => setScreen("settings");

  const appStyle = {
    "--sky1": prefs.sky[0],
    "--sky2": prefs.sky[1],
  } as CSSProperties;

  return (
    <div className="app" style={appStyle}>
      {screen === "menu" && (
        <Menu song={song} onPlay={startGame} onSettings={toSettings} />
      )}
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
        <Results
          result={result}
          song={song}
          onReplay={replay}
          onMenu={toMenu}
        />
      )}
      {screen === "settings" && (
        <Settings prefs={prefs} setPref={setPref} onBack={toMenu} />
      )}
    </div>
  );
}
