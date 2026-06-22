// usePreferences — localStorage-backed preferences (plan §3-D7).
//
// Replaces the recovered no-code-builder `useTweaks` hook. The original
// `useTweaks` was plain useState(defaults) that posted __edit_mode_set_keys to
// a builder host; in the standalone app that host never existed, so the game
// always ran on baked defaults. We keep the SAME default values and the SAME
// call-surface ([values, setPref]) but persist to localStorage (versioned JSON,
// safe defaults on parse failure) and drop the postMessage scaffold entirely.
//
// First-run with no saved prefs reproduces the original default behaviour
// exactly (acceptance §11).

import { useCallback, useState } from "react";
import { storage } from "../platform/storage";

export type Difficulty = "easy" | "normal" | "challenge";
export type NoteColor = "single" | "rainbow";
export type Sky = [string, string];
/** How notes are presented & played: the full 3-octave keyboard, or the
 *  classic 4-lane Piano-Tiles board. */
export type GameMode = "keyboard" | "lanes";

export interface Preferences {
  difficulty: Difficulty;
  noteColor: NoteColor;
  showLetters: boolean;
  guideKeys: boolean;
  sky: Sky;
  /** Selected play style (NEW — not in the original bundle). */
  mode: GameMode;
}

// Baked defaults — IDENTICAL to the recovered TWEAK_DEFAULTS (module `36c3f811`).
// `mode` is a new option; it defaults to the original full-keyboard experience
// so first-run behaviour is unchanged.
export const DEFAULT_PREFERENCES: Preferences = {
  difficulty: "easy",
  noteColor: "single",
  showLetters: true,
  guideKeys: true,
  sky: ["#d79bff", "#ff93d2"], // unicorn
  mode: "keyboard",
};

// The three curated sky palettes (recovered SKY_OPTIONS).
export const SKY_OPTIONS: Sky[] = [
  ["#d79bff", "#ff93d2"], // unicorn
  ["#ffc2e8", "#bfa8ff"], // cotton candy
  ["#a8d6ff", "#d6a8ff"], // mermaid
];

const STORAGE_KEY = "piano-pop:preferences";
const VERSION = 1;

interface PersistShape {
  version: number;
  values: Preferences;
}

// Validate + coerce loaded data so corrupt/partial/legacy JSON can never crash
// the app — anything missing or wrong falls back to the safe default.
function sanitize(raw: unknown): Preferences {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFERENCES };
  const v = raw as Partial<Preferences>;
  const difficulty: Difficulty =
    v.difficulty === "easy" ||
    v.difficulty === "normal" ||
    v.difficulty === "challenge"
      ? v.difficulty
      : DEFAULT_PREFERENCES.difficulty;
  const noteColor: NoteColor =
    v.noteColor === "single" || v.noteColor === "rainbow"
      ? v.noteColor
      : DEFAULT_PREFERENCES.noteColor;
  const sky: Sky =
    Array.isArray(v.sky) &&
    v.sky.length === 2 &&
    typeof v.sky[0] === "string" &&
    typeof v.sky[1] === "string"
      ? [v.sky[0], v.sky[1]]
      : [...DEFAULT_PREFERENCES.sky];
  const mode: GameMode =
    v.mode === "keyboard" || v.mode === "lanes"
      ? v.mode
      : DEFAULT_PREFERENCES.mode;
  return {
    difficulty,
    noteColor,
    showLetters:
      typeof v.showLetters === "boolean"
        ? v.showLetters
        : DEFAULT_PREFERENCES.showLetters,
    guideKeys:
      typeof v.guideKeys === "boolean"
        ? v.guideKeys
        : DEFAULT_PREFERENCES.guideKeys,
    sky,
    mode,
  };
}

function load(): Preferences {
  const text = storage.get(STORAGE_KEY);
  if (!text) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(text) as PersistShape;
    // Unknown future versions: fall back to defaults rather than guessing.
    if (!parsed || parsed.version !== VERSION) return { ...DEFAULT_PREFERENCES };
    return sanitize(parsed.values);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function persist(values: Preferences): void {
  const payload: PersistShape = { version: VERSION, values };
  storage.set(STORAGE_KEY, JSON.stringify(payload));
}

export type SetPref = <K extends keyof Preferences>(
  key: K,
  value: Preferences[K]
) => void;

/**
 * Returns [preferences, setPref]. setPref mirrors the old useTweaks(key, value)
 * surface and persists immediately. (Seam: a future cloud-sync backend can wrap
 * persist() without changing call sites.)
 */
export function usePreferences(): [Preferences, SetPref] {
  const [values, setValues] = useState<Preferences>(load);

  const setPref = useCallback<SetPref>((key, value) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  }, []);

  return [values, setPref];
}
