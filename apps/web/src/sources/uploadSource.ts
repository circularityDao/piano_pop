// uploadSource — Phase-1 POC ingestion path (plan §8 Phase 1). DESIGN-NOW stub.
//
// In Phase 1 this will POST a user-uploaded solo-piano clip (<=90s) to the
// FastAPI transcription backend (POST /transcribe -> job; GET /jobs/{id}),
// then run the result through melodyAdapter to produce the canonical tile-game
// schema. The backend does not exist in Phase 0, so resolve() rejects.
//
// Permitted launch path #1 (plan §9): user-upload-only of content the user
// owns/has rights to, with an in-app rights attestation.

import type { Song } from "../songs/schema";
import {
  SongSourceNotImplementedError,
  type SongSource,
  type SongSourceRequest,
} from "./SongSource";

export const uploadSource: SongSource = {
  kind: "upload",
  capabilities: {
    enabled: true, // permitted launch path, but backend not built yet
    requiresBackend: true,
  },
  async resolve(_req: SongSourceRequest): Promise<Song> {
    throw new SongSourceNotImplementedError("upload");
  },
};
