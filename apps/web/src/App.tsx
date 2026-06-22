// Piano Pop — root app. Transliterated from recovered module `36c3f811`, with
// the hidden TweaksPanel replaced by a real persisted Settings screen
// (plan §3-D7) and AudioContext unlock wired to the first tap (plan §7 step 7).
import { useEffect, useState, type CSSProperties } from "react";
import { Menu } from "./screens/Menu/Menu";
import { Game } from "./screens/Game/Game";
import { Results } from "./screens/Results/Results";
import { Settings } from "./screens/Settings/Settings";
import { LevelSelect } from "./screens/LevelSelect/LevelSelect";
import { usePreferences, type Difficulty } from "./state/usePreferences";
import { pianoAudio } from "./audio/synth";
import { unlockAudio, installResumeHandlers } from "./audio/audioContext";
import { SONGS, SONG_LIST } from "./songs/registry";
import type { EndResult } from "./engine/GameEngine";

type Screen = "menu" | "levels" | "game" | "results" | "settings";

export function App() {
  const [prefs, setPref] = usePreferences();
  const [screen, setScreen] = useState<Screen>("menu");
  const [result, setResult] = useState<EndResult | null>(null);
  const [muted, setMuted] = useState(false);
  const [runId, setRunId] = useState(0);
  const [selectedSongId, setSelectedSongId] = useState(SONG_LIST[0].id);
  // Difficulty chosen on the level-select screen, overriding the saved pref
  // for this run only. null = fall back to the Settings preference.
  const [runDifficulty, setRunDifficulty] = useState<Difficulty | null>(null);

  const song = SONGS[selectedSongId] ?? SONG_LIST[0];

  // Install iOS resume handlers once, up front.
  useEffect(() => {
    installResumeHandlers();
  }, []);

  useEffect(() => {
    pianoAudio.setMuted(muted);
  }, [muted]);

  // Maps prefs -> engine/game settings, exactly as the original derived them.
  // The per-run level choice (runDifficulty) wins over the saved preference.
  const settings = {
    difficulty: runDifficulty ?? prefs.difficulty,
    colorMode: prefs.noteColor,
    showLetters: prefs.showLetters,
    guideKeys: prefs.guideKeys,
  };

  // Picking a song on the menu goes straight to the level picker.
  const pickSong = (id: string) => {
    setSelectedSongId(id);
    setScreen("levels");
  };

  // Level chosen: this tap is the gesture that starts audio + the run.
  const startGame = (difficulty: Difficulty) => {
    pianoAudio.ensure();
    unlockAudio();
    setRunDifficulty(difficulty);
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
        <Menu songs={SONG_LIST} onSelectSong={pickSong} onSettings={toSettings} />
      )}
      {screen === "levels" && (
        <LevelSelect
          song={song}
          mode={prefs.mode}
          onSetMode={(m) => setPref("mode", m)}
          onSelect={startGame}
          onBack={toMenu}
        />
      )}
      {screen === "game" && (
        <Game
          key={runId}
          song={song}
          settings={settings}
          mode={prefs.mode}
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
