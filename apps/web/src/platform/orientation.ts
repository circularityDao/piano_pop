// Orientation seam (plan §7 step 9 / D11). Tries the Screen Orientation API to
// landscape-lock gameplay; on iOS Safari web (which does not support
// orientation.lock) it silently no-ops and the CSS `.rotate-nudge` overlay +
// the responsive layout carry the adaptation. A later Capacitor build can route
// this through @capacitor/screen-orientation for a real native lock.

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

export async function lockLandscape(): Promise<void> {
  try {
    const so = window.screen?.orientation as LockableOrientation | undefined;
    if (so && typeof so.lock === "function") {
      await so.lock("landscape");
    }
  } catch {
    // Unsupported (iOS Safari) or rejected (not fullscreen) — fall back to the
    // CSS nudge. Not an error.
  }
}

export async function unlockOrientation(): Promise<void> {
  try {
    const so = window.screen?.orientation as LockableOrientation | undefined;
    if (so && typeof so.unlock === "function") {
      so.unlock();
    }
  } catch {
    /* ignore */
  }
}
