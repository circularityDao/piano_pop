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
let silentEl: HTMLAudioElement | null = null;

// A tiny silent looping WAV (44 bytes of header + a few silent samples) as a
// data URI — no asset to ship or precache. Playing a real <audio> element on
// the first gesture promotes the iOS audio session from "ambient" (silenced by
// the ring/silent switch) to "playback", so the pure-Web-Audio synth sounds
// even with the hardware mute switch on. This is what makes an *installed*
// standalone PWA audible on iPhone; a Safari tab usually gets promoted already.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/**
 * Play a silent looping <audio> element to switch the iOS audio session to the
 * "playback" category so Web Audio is not muted by the ring/silent switch.
 * Must run inside a user gesture. Idempotent; safe (and a no-op) off iOS.
 */
function promoteToPlaybackCategory(): void {
  if (silentEl) {
    void silentEl.play().catch(() => {});
    return;
  }
  const el = document.createElement("audio");
  el.src = SILENT_WAV;
  el.loop = true;
  el.setAttribute("playsinline", "");
  el.muted = false; // must NOT be muted, or iOS won't switch the session category
  el.volume = 1;
  void el.play().catch(() => {
    /* rejected if not yet in a gesture; retried on the next tap */
  });
  silentEl = el;
}

/**
 * Create/resume the AudioContext inside a user gesture and play a 1-sample
 * silent buffer to satisfy iOS autoplay policy. Also promotes the iOS audio
 * session to "playback" so sound survives the hardware mute switch in a
 * standalone PWA. Idempotent.
 */
export function unlockAudio(): void {
  pianoAudio.ensure();
  const ctx = pianoAudio.ctx;
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  promoteToPlaybackCategory();
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
  const resume = () => {
    pianoAudio.resume();
    // iOS pauses the silent element on interruption, which can drop the audio
    // session back to "ambient" — replay it to keep playing through mute.
    if (silentEl) void silentEl.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
  });
  window.addEventListener("focus", resume);
  window.addEventListener("pageshow", resume);
}
