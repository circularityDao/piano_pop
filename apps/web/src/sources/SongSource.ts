// SongSource — the pluggable ingestion abstraction (plan §2, §3-D8, §9).
//
// DESIGN-NOW / BUILD-LATER. Track B (the AI piano-teacher) is NOT built in
// Phase 0 — there is no backend yet (plan §8 Phase 0: "No backend"). This
// interface exists so that every future ingestion path (upload | licensed
// catalog | gated YouTube) funnels through ONE contract, and so the pipeline
// never hard-depends on YouTube scraping. The built-in Twinkle song does not go
// through a SongSource; it is shipped directly.
//
// Legal gating (plan §9): `youtubeSource` exists but is DISABLED behind explicit
// legal sign-off. No public YouTube ingestion ships until counsel approves.

import type { Song } from "../songs/schema";

export type SongSourceKind = "builtin" | "upload" | "catalog" | "youtube";

export interface SongSourceCapabilities {
  /** False = the source is gated/disabled and must not be invoked. */
  enabled: boolean;
  /** Human-readable reason when disabled (e.g. legal sign-off pending). */
  disabledReason?: string;
  /** True if this source requires the Track-B backend (transcription). */
  requiresBackend: boolean;
}

export interface SongSourceRequest {
  /** Upload sources: the user-provided audio file. */
  file?: File;
  /** Catalog/YouTube sources: an identifier or URL. */
  ref?: string;
}

export interface SongSource {
  readonly kind: SongSourceKind;
  readonly capabilities: SongSourceCapabilities;
  /**
   * Resolve a request into a playable Song (canonical {midi,letter,beat,beats}
   * schema). Phase-0 stubs reject — the real implementations land in Track B.
   */
  resolve(req: SongSourceRequest): Promise<Song>;
}

export class SongSourceDisabledError extends Error {
  constructor(public readonly kind: SongSourceKind, reason: string) {
    super(`SongSource "${kind}" is disabled: ${reason}`);
    this.name = "SongSourceDisabledError";
  }
}

export class SongSourceNotImplementedError extends Error {
  constructor(public readonly kind: SongSourceKind) {
    super(
      `SongSource "${kind}" is not implemented in Phase 0 (Track B / backend not built yet).`
    );
    this.name = "SongSourceNotImplementedError";
  }
}
