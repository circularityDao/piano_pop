// Game screen — transliterated from recovered module `e469d512`. Behaviour is
// unchanged; additions are (a) AudioContext gesture-unlock + iOS resume wiring
// (plan §7 step 7 / D13), and (b) landscape orientation lock + a portrait
// "rotate your device" nudge (plan §7 step 9). Class names / markup match the
// original so the recovered CSS applies verbatim.
import { useCallback, useEffect, useRef, useState } from "react";
import { HUD } from "../../components/HUD";
import { Piano } from "../../components/Piano";
import { GameEngine } from "../../engine/GameEngine";
import type { EndResult, EngineSettings } from "../../engine/GameEngine";
import { pianoAudio } from "../../audio/synth";
import { lockLandscape, unlockOrientation } from "../../platform/orientation";
import { PIANO_KEYS } from "../../songs/keys";
import type { Song } from "../../songs/schema";

export interface GameSettings extends EngineSettings {
  guideKeys: boolean;
}

interface GameProps {
  song: Song;
  settings: GameSettings;
  muted: boolean;
  onToggleMute: () => void;
  onFinish: (res: EndResult) => void;
  onExit: () => void;
}

export function Game({
  song,
  settings,
  muted,
  onToggleMute,
  onFinish,
  onExit,
}: GameProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progress, setProgress] = useState(0);
  const [guideMidi, setGuideMidi] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(3);
  const [paused, setPaused] = useState(false);
  const comboPopRef = useRef<HTMLDivElement>(null);
  // count is read by the pointer handlers; ref it so they always see the latest.
  const countRef = useRef<number | null>(3);
  countRef.current = count;
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const flashKey = useCallback((midi: number, cls: string) => {
    const el =
      keyboardRef.current &&
      keyboardRef.current.querySelector(`[data-key="${midi}"]`);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 160);
  }, []);

  const showCombo = useCallback((c: number) => {
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
      layer: layerRef.current!,
      keyboardEl: keyboardRef.current!,
      song,
      settings,
      on: {
        hit: ({ note, combo }) => {
          setScore(engine.score);
          setCombo(combo);
          flashKey(note.midi, "flash");
          if (combo > 0 && combo % 5 === 0) showCombo(combo);
        },
        miss: () => {
          setCombo(0);
        },
        stats: (s) => {
          setScore(s.score);
        },
        target: (midi) => setGuideMidi(settings.guideKeys ? midi : null),
        progress: (p) => setProgress(p),
        end: (res) => onFinish(res),
      },
    });
    engineRef.current = engine;

    // Landscape-lock gameplay (no-op / nudge fallback on iOS Safari web).
    void lockLandscape();

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
      void unlockOrientation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = (midi: number) => {
    pianoAudio.play(midi);
    if (engineRef.current && !pausedRef.current && countRef.current === null)
      engineRef.current.press(midi);
  };

  const handleRelease = (midi: number) => {
    if (engineRef.current && countRef.current === null)
      engineRef.current.release(midi);
  };

  const togglePause = () => {
    const e = engineRef.current;
    if (!e) return;
    if (paused) {
      e.resume();
      setPaused(false);
    } else {
      e.pause();
      setPaused(true);
    }
  };

  return (
    <div className="screen active">
      <div className="stage">
        <HUD
          songTitle={song.title}
          score={score}
          combo={combo}
          muted={muted}
          onTogglePause={togglePause}
          onToggleMute={onToggleMute}
        />
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: progress * 100 + "%" }}
          />
        </div>

        <div className="field">
          <div className="lanes">
            {PIANO_KEYS.filter((k) => k.type === "white").map((k) => (
              <div key={k.id} className="lane" />
            ))}
          </div>
          <div className="notes-layer" ref={layerRef} />
          <div className="hitline" />
          <div className="combo-pop" ref={comboPopRef} />
        </div>

        <div className="keyboard-wrap">
          <Piano
            ref={keyboardRef}
            keys={PIANO_KEYS}
            guideMidi={guideMidi}
            onPress={handlePress}
            onRelease={handleRelease}
          />
        </div>

        {count !== null && (
          <div className="countdown">
            <div className="count-num" key={count}>
              {count}
            </div>
          </div>
        )}
        {paused && (
          <div className="overlay">
            <div className="overlay-card">
              <h2>Paused</h2>
              <div className="overlay-actions">
                <button className="btn btn-resume" onClick={togglePause}>
                  Resume
                </button>
                <button className="btn btn-secondary" onClick={onExit}>
                  Back to Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NEW (plan §7 step 9): portrait nudge — shown only in portrait via CSS. */}
        <div className="rotate-nudge">
          <div className="rotate-nudge-card">
            <div className="rotate-nudge-icon">↻</div>
            <p>Rotate your device to play</p>
          </div>
        </div>
      </div>
    </div>
  );
}
