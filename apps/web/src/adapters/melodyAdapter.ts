// melodyAdapter — transcription -> single-line white-key tile schema (plan §6,
// §8 Phase 1, §3-D8). DESIGN-NOW stub.
//
// Phase 1 will take a polyphonic transcription (Basic Pitch MIDI + a
// beat/tempo grid from madmom/librosa), reduce it to a melody line
// (salience/skyline), quantize onsets/durations to the grid, white-key-snap the
// pitches, and emit the SAME canonical {midi,letter,beat,beats} + meta schema
// the tile game already consumes — so the existing GameEngine plays it
// unchanged. None of that runs in Phase 0; this file pins the type contract.

import type { Note, Song } from "../songs/schema";

/** A transcription note as it would arrive from the backend (ms-timed). */
export interface TranscriptionNote {
  midi: number;
  /** Onset time in milliseconds. */
  onsetMs: number;
  /** Duration in milliseconds. */
  durationMs: number;
}

export interface TranscriptionResult {
  notes: TranscriptionNote[];
  /** Estimated milliseconds per beat (global tempo). */
  beatMs: number;
  title?: string;
  subtitle?: string;
}

export interface MelodyAdapterOptions {
  /** Beat subdivision to quantize onsets to (e.g. 1 = quarter, 0.5 = eighth). */
  subdivision?: number;
  /** Snap every pitch to the nearest white key when true. */
  whiteKeySnap?: boolean;
}

/**
 * Phase-1 entry point. Not implemented in Phase 0 — kept as a typed seam so the
 * backend export contract and the frontend tile schema stay in lock-step.
 */
export function adaptMelody(
  _t: TranscriptionResult,
  _opts: MelodyAdapterOptions = {}
): Song {
  throw new Error(
    "melodyAdapter is a Phase-1 stub (Track B not built in Phase 0)."
  );
}

// Re-export the canonical types so Phase-1 code and a future shared package can
// import the contract from one place.
export type { Note, Song };
