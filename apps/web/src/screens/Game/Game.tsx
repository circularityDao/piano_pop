// Game screen — transliterated from recovered module `e469d512`. Behaviour is
// unchanged; additions are (a) AudioContext gesture-unlock + iOS resume wiring
// (plan §7 step 7 / D13), (b) landscape orientation lock + a portrait
// "rotate your device" nudge (plan §7 step 9), and (c) a selectable 4-lane
// (Piano-Tiles) mode alongside the original full-keyboard mode. Class names /
// markup for keyboard mode match the original so the recovered CSS applies
// verbatim; the lane UI reuses the same field / tiles / hitline.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { HUD } from "../../components/HUD";
import { Piano } from "../../components/Piano";
import { GameEngine } from "../../engine/GameEngine";
import type { EndResult, EngineSettings } from "../../engine/GameEngine";
import { pianoAudio } from "../../audio/synth";
import { lockLandscape, unlockOrientation } from "../../platform/orientation";
import { PIANO_KEYS } from "../../songs/keys";
import type { Song } from "../../songs/schema";
import type { GameMode } from "../../state/usePreferences";

export interface GameSettings extends EngineSettings {
  guideKeys: boolean;
}

const LANE_COUNT = 4;
const LANES = Array.from({ length: LANE_COUNT }, (_, i) => i);

interface GameProps {
  song: Song;
  settings: GameSettings;
  mode: GameMode;
  muted: boolean;
  onToggleMute: () => void;
  onFinish: (res: EndResult) => void;
  onExit: () => void;
}

export function Game({
  song,
  settings,
  mode,
  muted,
  onToggleMute,
  onFinish,
  onExit,
}: GameProps) {
  const laneMode = mode === "lanes";
  const layerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const lanePadRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [progress, setProgress] = useState(0);
  // Guidance target: a key midi in keyboard mode, a lane index in lane mode.
  const [guideCol, setGuideCol] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(3);
  const [paused, setPaused] = useState(false);
  const [backingOn, setBackingOn] = useState(true);
  const comboPopRef = useRef<HTMLDivElement>(null);
  // count is read by the pointer handlers; ref it so they always see the latest.
  const countRef = useRef<number | null>(3);
  countRef.current = count;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // The engine's accomp callback is created once; read the live toggle via a ref.
  const backingOnRef = useRef(true);
  backingOnRef.current = backingOn;
  const hasBacking = !!song.accompaniment && song.accompaniment.length > 0;

  const flashKey = useCallback((midi: number, cls: string) => {
    const el =
      keyboardRef.current &&
      keyboardRef.current.querySelector(`[data-key="${midi}"]`);
    if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 160);
  }, []);

  const flashLane = useCallback((lane: number, cls: string) => {
    const el =
      lanePadRef.current &&
      lanePadRef.current.querySelector(`[data-lane="${lane}"]`);
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
      keyboardEl: (laneMode ? lanePadRef.current : keyboardRef.current)!,
      song,
      settings,
      laneMode,
      laneCount: LANE_COUNT,
      on: {
        hit: ({ note, combo }) => {
          setScore(engine.score);
          setCombo(combo);
          if (laneMode) flashLane(note.col, "flash");
          else flashKey(note.midi, "flash");
          if (combo > 0 && combo % 5 === 0) showCombo(combo);
        },
        miss: () => {
          setCombo(0);
        },
        stats: (s) => {
          setScore(s.score);
        },
        // `col` is a key midi (keyboard) or lane index (lane mode).
        target: (col) => setGuideCol(settings.guideKeys ? col : null),
        progress: (p) => setProgress(p),
        // Backing track: the song minus the player's melody, played for them.
        // Skipped live when the player toggles it off in the HUD.
        accomp: (midi, vel) => {
          if (backingOnRef.current) pianoAudio.play(midi, vel);
        },
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

  // ----- keyboard-mode input (press a key plays its pitch) -----
  const handlePress = (midi: number) => {
    pianoAudio.play(midi);
    if (engineRef.current && !pausedRef.current && countRef.current === null)
      engineRef.current.press(midi);
  };
  const handleRelease = (midi: number) => {
    if (engineRef.current && countRef.current === null)
      engineRef.current.release(midi);
  };

  // ----- lane-mode input (tap/hold a lane; the matched tile's pitch sounds) -----
  const handleLanePress = (e: ReactPointerEvent<HTMLButtonElement>, lane: number) => {
    e.preventDefault();
    e.currentTarget.classList.add("down");
    if (!engineRef.current || pausedRef.current || countRef.current !== null)
      return;
    const note = engineRef.current.press(lane);
    if (note) pianoAudio.play(note.midi);
  };
  const handleLaneRelease = (
    e: ReactPointerEvent<HTMLButtonElement>,
    lane: number
  ) => {
    e.currentTarget.classList.remove("down");
    if (engineRef.current && countRef.current === null)
      engineRef.current.release(lane);
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
      <div className={"stage" + (laneMode ? " stage-lanes" : "")}>
        <HUD
          songTitle={song.title}
          score={score}
          combo={combo}
          muted={muted}
          hasBacking={hasBacking}
          backingOn={backingOn}
          onTogglePause={togglePause}
          onToggleMute={onToggleMute}
          onToggleBacking={() => setBackingOn((v) => !v)}
        />
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: progress * 100 + "%" }}
          />
        </div>

        <div className={"field" + (laneMode ? " field-lanes" : "")}>
          {laneMode ? (
            // Interactive 4-lane pad — full-height touch columns over the field.
            // Transparent so falling tiles show through; multi-touch works
            // because each lane is its own pointer-capturing button.
            <div className="lane-pad" ref={lanePadRef}>
              {LANES.map((lane) => (
                <button
                  key={lane}
                  className={"lane-btn" + (guideCol === lane ? " guide" : "")}
                  data-lane={lane}
                  aria-label={`Lane ${lane + 1}`}
                  onPointerDown={(e) => handleLanePress(e, lane)}
                  onPointerUp={(e) => handleLaneRelease(e, lane)}
                  onPointerLeave={(e) => handleLaneRelease(e, lane)}
                  onPointerCancel={(e) => handleLaneRelease(e, lane)}
                />
              ))}
            </div>
          ) : (
            // Decorative one-stripe-per-white-key lanes (original look).
            <div className="lanes">
              {PIANO_KEYS.filter((k) => k.type === "white").map((k) => (
                <div key={k.id} className="lane" />
              ))}
            </div>
          )}
          <div className="notes-layer" ref={layerRef} />
          <div className="hitline" />
          <div className="combo-pop" ref={comboPopRef} />
        </div>

        {!laneMode && (
          <div className="keyboard-wrap">
            <Piano
              ref={keyboardRef}
              keys={PIANO_KEYS}
              guideMidi={guideCol}
              onPress={handlePress}
              onRelease={handleRelease}
            />
          </div>
        )}

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
