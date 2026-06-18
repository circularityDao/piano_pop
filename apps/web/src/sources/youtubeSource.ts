// youtubeSource — GATED & DISABLED (plan §9). DESIGN-NOW stub.
//
// Downloading/extracting YouTube audio generally violates YouTube ToS and risks
// infringing both the musical work and the sound recording. This source exists
// ONLY so the architecture stays decoupled from YouTube; it is hard-disabled and
// MUST NOT be invoked. No public YouTube ingestion ships until counsel signs off
// against the legal checklist. `capabilities.enabled` stays false; resolve()
// always throws SongSourceDisabledError.

import type { Song } from "../songs/schema";
import {
  SongSourceDisabledError,
  type SongSource,
  type SongSourceRequest,
} from "./SongSource";

const DISABLED_REASON =
  "Public YouTube ingestion is blocked pending legal sign-off (YouTube ToS + copyright). See plan §9.";

export const youtubeSource: SongSource = {
  kind: "youtube",
  capabilities: {
    enabled: false,
    disabledReason: DISABLED_REASON,
    requiresBackend: true,
  },
  async resolve(_req: SongSourceRequest): Promise<Song> {
    throw new SongSourceDisabledError("youtube", DISABLED_REASON);
  },
};
