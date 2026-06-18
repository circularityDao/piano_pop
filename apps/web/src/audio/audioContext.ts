// AudioContext gesture-unlock + iOS interruption handling (plan §7 step 7 / D13).
//
// The original synth lazily creates its AudioContext on first note. On iOS
// Safari that is not enough: the context must be created/resumed inside a user
// gesture, "kicked" with a silent buffer, and resumed again when the app returns
// to the foreground (visibilitychange / focus / pageshow). Broken audio on
// iPhone = broken product, so this is an explicit acceptance item.
//
// Routed as a thin module so a Capacitor build can later swap in a native
// audio-session wrapper without touching call sites.

import { pianoAudio } from "./synth";

let unlocked = false;
let handlersInstalled = false;

/**
 * Create/resume the AudioContext inside a user gesture and play a 1-sample
 * silent buffer to satisfy iOS autoplay policy. Idempotent.
 */
export function unlockAudio(): void {
  pianoAudio.ensure();
  const ctx = pianoAudio.ctx;
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (!unlocked) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      unlocked = true;
    } catch {
      /* createBuffer can throw before a gesture on some browsers; retry next tap */
    }
  }
}

/**
 * Resume the context when the page becomes visible/focused again. iOS Safari
 * suspends Web Audio on interruption (calls, lock screen, tab switch).
 */
export function installResumeHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const resume = () => pianoAudio.resume();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
  });
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
}
