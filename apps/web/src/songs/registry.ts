// Song registry — the single place that aggregates all playable songs.
// Mirrors the recovered `window.PIANO_SONGS` map but adds an ordered list for
// the menu. New songs are added here (and as a builtin/* module).

import type { Song } from "./schema";
import { twinkle } from "./builtin/twinkle";
import { golden } from "./builtin/golden";

/** Keyed by id (lookup). */
export const SONGS: Record<string, Song> = { twinkle, golden };

/** Menu display order. */
export const SONG_LIST: Song[] = [twinkle, golden];
