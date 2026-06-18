// catalogSource — licensed / public-domain catalog ingestion (plan §9 path #2).
// DESIGN-NOW stub. Resolves a catalog id into a pre-arranged Song. Not built in
// Phase 0.

import type { Song } from "../songs/schema";
import {
  SongSourceNotImplementedError,
  type SongSource,
  type SongSourceRequest,
} from "./SongSource";

export const catalogSource: SongSource = {
  kind: "catalog",
  capabilities: {
    enabled: true, // permitted (properly-licensed / public-domain), not yet built
    requiresBackend: true,
  },
  async resolve(_req: SongSourceRequest): Promise<Song> {
    throw new SongSourceNotImplementedError("catalog");
  },
};
