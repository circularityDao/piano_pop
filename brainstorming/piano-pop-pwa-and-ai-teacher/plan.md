# piano-pop-pwa-and-ai-teacher

Status: plan

# Piano Pop — PWA Conversion + AI Piano-Teacher: Design & Implementation Plan

> Status: final brainstorming output. Two coexisting tracks — a faithful installable PWA of the existing rhythm game (build now), and a phased AI piano-teacher capability (designed now, built next). All technical constants below were verified by decoding the actual standalone bundle.

---

## 1. Goal
Deliver a commercial-grade product in two tracks built **alongside** each other:

- **Track A (now):** A pixel- and behavior-faithful, installable **PWA** of the existing Piano-Tiles-style falling-tile **rhythm game** — menu, 3-2-1 countdown, monophonic white-key-lane gameplay, scoring/combos/holds, stars/results, difficulty — rebuilt as a clean Vite + React + TypeScript project that can later be wrapped natively via **Capacitor (iOS + Android)**.
- **Track B (next phases):** An **AI piano-teacher** capability. The user supplies a song (POC: uploads solo-piano audio; later: licensed/public-domain catalog; YouTube only if/when legally cleared). A backend transcribes audio→MIDI, arranges it into playable 1–2 hand piano parts, and the app teaches it via **two distinct render targets**: the existing tile game (simplified single-line) and a **new two-hand sheet-music view** (OpenSheetMusicDisplay + MusicXML) with follow-along highlighting and scoring.

The game and the teacher are **two coexisting modes**, not a replacement. There is explicitly **no single player that serves both** — see §4 (two render targets).

---

## 2. Scope

**In scope — Track A (Phase 0):**
- Decode/recover the true source, fonts, and CSS from the standalone bundle.
- Faithful React+TS port: Menu, Game (falling tiles, hit line at 82%, countdown, HUD, combo pops, particles, key flashes, guide keys, pause overlay), Results (0–3 stars, confetti, score/accuracy/best-combo, replay/menu), GameEngine, Piano keyboard (3 octaves C4–B6: 21 white + 15 black), synth (verbatim constants), Ambient sparkles/clouds.
- **Settings screen** — an **intentional new addition** built from the formerly hidden Tweaks editor (see §3 D7 and §4). Persisted to `localStorage`: difficulty (easy/normal/challenge), note color (single/rainbow), show-letters, guide-keys, sky-gradient theme.
- PWA: installable manifest + icons, Workbox offline precache of app shell + fonts, self-hosted Fredoka, HTTPS deploy, Lighthouse PWA pass on a real phone.
- Responsive: **landscape-locked gameplay** (wide 3-octave keyboard), portrait-usable menus/settings — an explicit **mobile adaptation**, not a pixel match of the desktop layout.
- Capacitor seams preserved (no native build now).

**In scope — Track B (later phases, designed now):**
- Pluggable **SongSource / audio-source abstraction** (upload | licensed catalog | gated YouTube).
- Python + FastAPI transcription backend with a bounded async job API.
- Audio→MIDI transcription, beat/tempo/downbeat estimation, melody extraction, white-key-snap melody adapter (Phase 1).
- LLM-as-arranger for 1–2 hand simplification + the new two-hand sheet view (Phase 2).
- Black-key/full-fidelity (Phase 3).
- Interactive teacher: follow-along highlighting + scoring first; Web MIDI + LLM lessons later (Phase 4).
- A distinct **Legal/IP workstream** gating any public YouTube ingestion.

**Out of scope (now):**
- Native iOS/Android builds (seams only).
- Public YouTube ingestion (blocked behind legal sign-off; may never ship in the "paste any link" form — see §9).
- Web MIDI hardware input, LLM-generated lesson plans, multiplayer, accounts/cloud sync (later roadmap).
- Black-key tile lanes (Phase 3 design decision).

---

## 3. Key decisions & rationale (opinionated)

- **D1 — Recover real source before porting.** Write `scripts/decode-bundle.mjs` (~15 lines): read the HTML, extract each module's base64 from the `__bundler/manifest` block, `base64 → gunzip (DecompressionStream('gzip')) → text`, and dump real source (`songs.js`, `audio.js`, `engine.js`, components, the inline `<style>`, the 3 woff2 fonts) into `recovered/`. This converts "port by eyeballing" into "transliterate verified source." **Do this first.** Fallback if a module won't decode: reuse the runtime `DecompressionStream` path the original loader already uses.
- **D2 — Vite + React + TypeScript.** The app is already React; keeping React minimizes semantic drift. TS adds safety around the note schema and engine math. **Reject** reframeworking (needless risk) and **reject** keeping in-browser Babel + CDN fonts (slow, offline-hostile, not installable-grade).
- **D3 — `vite-plugin-pwa` (Workbox).** Generated service worker + precache of app shell/JS/CSS/fonts/icons (game is fully offline-capable — sound is synthesized, no audio samples). Future backend API calls are **network-only, not cached**.
- **D4 — Self-host Fredoka woff2; remove Google Fonts + Babel.** `@font-face` with `font-display: swap`, precached. Fixes offline.
- **D5 — Synth fidelity is non-negotiable; port constants verbatim** (see §4).
- **D6 — Preserve the beat-relative note schema exactly.** Per-note `{midi, letter, beat, beats}`; song meta `{id, title, subtitle, difficulty, beatMs, totalBeats, notes[]}`. Runtime timing (verified): `lead = fallMs + 200`; `time = lead + beat * song.beatMs * beatScale`, where `beatScale`/`fallMs` come from the selected difficulty. The AI melody adapter (Phase 1) must emit this **same** schema so it feeds the tile game unchanged.
- **D7 — Settings is an intentional addition, not faithful reproduction.** Note clearly: the original app has **no visible settings** — `TweaksPanel` only renders when a no-code-builder host posts `__activate_edit_mode`, so the standalone app always runs on baked defaults (difficulty `easy`, single color, letters on, guide on, unicorn sky). Per the product owner's decision we **add** a real in-app Settings screen exposing all five Tweaks options, backed by `localStorage` behind a `usePreferences` hook that mirrors the old `useTweaks` API surface (versioned JSON, safe defaults on parse failure, seam for future cloud sync). The `postMessage`/`__edit_mode_*` scaffold is removed. The game still **boots on the original defaults** so first-run behavior matches the original.
- **D8 — Two render targets, explicitly separate.** (a) **Tile game** fed by a `melodyAdapter` that extracts a melody line, quantizes, and white-key-snaps a transcription into the canonical `{midi,letter,beat,beats}` schema — handles simple songs. (b) **Sheet view** — a NEW module using **OpenSheetMusicDisplay (OSMD)** rendering **MusicXML** for true 1–2 hand teacher mode. They share the **synth**, a shared **transport/clock**, and a **highlight bus**, but are distinct renderers. No forced unification.
- **D9 — Backend is Python + FastAPI, separate from the static PWA.** Music ML lives in Python (Basic Pitch, ByteDance, librosa, madmom, Demucs, music21). Clean HTTP boundary → independent scaling and GPU only on the backend.
- **D10 — Hosting:** **Cloudflare Pages** for the PWA (cheap global CDN, great static+PWA fit, generous bandwidth; Vercel is the fine alternative). Backend POC on **Fly.io** (CPU container, scale-to-low). GPU work (Phase 2+) on **Modal** or **Replicate** (pay-per-inference, no idle GPU cost). Keeps fixed cost near-zero during POC.
- **D11 — Capacitor for native (iOS + Android).** Keep the SPA free of Node/SSR coupling; route device-ish concerns (storage, audio unlock, orientation) through `platform/*` wrappers so Capacitor plugins drop in later. No native build now.
- **D12 — Hybrid paid/OSS.** POC = OSS/CPU (Basic Pitch). Quality phase = ByteDance GPU model + optional commercial APIs. **LLM (Claude) is used only as an arranger/simplifier over symbolic MIDI/notes — never as the audio transcriber.**
- **D13 — AudioContext gesture-unlock + iOS handling.** Create/resume `AudioContext` on first tap (countdown start), unlock with a silent buffer, resume on `visibilitychange`/focus for iOS Safari interruptions. Acceptance item — broken audio on iPhone = broken product.

---

## 4. Verified app inventory (ground truth to reproduce)

**App type:** Piano-Tiles / Magic-Piano-style **falling-tile rhythm game** (React). Monophonic, white-key-lane-based, beat-quantized, single-letter falling tiles. No chords / two hands / staff in the original.

**Screens:**
- **MENU:** logo, animated ambient sparkles/clouds, song card with difficulty dots, 'Let's Play' CTA, hint row.
- **GAME:** tiles fall down WHITE-KEY lanes; hit line `HIT_FRAC = 0.82`; **3-2-1 countdown** (700ms `setInterval`, 3→2→1); HUD (pause btn, Score, song title, Combo, mute btn); progress bar; combo pop-up every `combo % 5 === 0`; particle bursts + key flashes on hit; guide-key highlighting (gated by the `guideKeys` pref); pause overlay.
- **RESULTS:** 0–3 stars (accuracy thresholds **≥0.9 / ≥0.6 / >0**); confetti; Score / Accuracy (`hits/total`) / Best-Combo; Replay / Menu.

**GameEngine (imperative, requestAnimationFrame) — verified constants:**
- DIFFICULTY: `easy {beatScale 1.25, fallMs 2900}`, `normal {1.0, 2300}`, `challenge {0.8, 1750}`.
- Hit window 360ms with quality thresholds **perfect <110ms / good <240ms / ok ≤360ms**; base scores **100 / 70 / 45**.
- Combo multiplier **×(1 + min(combo, 20) × 0.1)**.
- Miss when tile progress **> 1.06**.
- **Hold/sustain notes have TWO thresholds (port BOTH):** `HOLD_FRAC = 0.85` (visual fill auto-completes the hold) and `0.55` (release bonus **+30**). Holds apply to notes with `beats ≥ 2`.
- Pause/resume.

**Keyboard:** **3 octaves C4–B6** = 21 white + 15 black (code iterates octaves `[4, 5, 6]`; the source comment 'two octaves C4..B5' is wrong — ignore it).

**Synth constants (port verbatim):** per-note voice = partials triangle×1 @0.6, sine×2 @0.28, sine×3 @0.12; per-voice lowpass ramp **4200 → 900 Hz over 1.4s**; master gain **0.9** → master lowpass **6500 Hz**; attack **6ms**; peak `0.5 × velocity`; exponential decay to `now + 1.6s`; oscillator stop at 1.7s, disconnect at 1.9s. **No samples — fully synthesized.**

**Songs:** exactly ONE built-in — **'Twinkle Twinkle Little Star'** (`beatMs 600`, `difficulty 1`), a hardcoded melody. Keep as the default demo level.

**CSS:** the full stylesheet (~153 rules incl. `.keyboard`, `.tile`, `@keyframes drift`/`twinkle`, confetti) lives in the inline `<style>` inside the `__bundler/template` block — that recovered block is the source of truth for pixel-faithful CSS.

**Tweaks panel:** a hidden no-code-builder editor (`open=false` until host posts `__activate_edit_mode`; `useTweaks` is plain `useState(defaults)`; `postMessage`s `__edit_mode_set_keys`/`__edit_mode_available` to `window.parent`). In standalone there is no parent → it never appears; the app runs on baked defaults. We convert it to a persisted in-app Settings screen (D7).

---

## 5. Tech stack

**Frontend / PWA:** Vite + React + TypeScript; `vite-plugin-pwa` + Workbox; self-hosted Fredoka (3 recovered woff2); Web Audio API (synth ported verbatim); `localStorage` for preferences (versioned JSON); Capacitor (later) for iOS + Android; OpenSheetMusicDisplay + MusicXML for the Phase-2 two-hand sheet view.

**Backend (Track B):** Python + FastAPI; bounded job API (sync for short POC clips, async job + polling thereafter); **yt-dlp behind an audio-source abstraction** (NOT wired to public YouTube until legal sign-off); **Demucs** (source separation / piano stem isolation); **Basic Pitch** (Spotify) — POC transcriber (CPU, OSS); **ByteDance `piano_transcription_inference`** — high-accuracy piano model (Phase 2, GPU); **librosa / madmom** — beat/tempo/downbeat tracking, onset detection, quantization grid; **music21** — symbolic processing, hand-splitting, MusicXML export; **LLM (Claude)** as arranger over symbolic notes only.

**Hosting:** PWA → Cloudflare Pages; backend POC → Fly.io (CPU); backend GPU → Modal / Replicate (on-demand).

**Tooling:** Node decode script (`DecompressionStream`); Playwright screenshot visual-diff at defined reference viewport(s).

---

## 6. Project structure (monorepo — shares the note-schema types)

```
piano_pop/
  recovered/                      # output of decode script (reference only, not shipped)
    songs.js audio.js engine.js components/* styles.css fonts/*.woff2
  scripts/
    decode-bundle.mjs             # base64 -> gunzip -> text recovery (step 1)
  apps/
    web/                          # the PWA (Cloudflare Pages target)
      index.html
      vite.config.ts              # vite-plugin-pwa config
      public/
        manifest.webmanifest
        icons/                    # generated from the SVG thumbnail (maskable + sizes)
        fonts/ fredoka-*.woff2
      src/
        main.tsx App.tsx
        screens/
          Menu/ Game/ Results/ Settings/   # Settings = persisted former Tweaks
        components/
          Piano.tsx               # 3-octave C4-B6 (21 white + 15 black)
          Ambient.tsx HUD.tsx Icon.tsx Star.tsx Tile.tsx
          sheet/SheetView.tsx     # NEW (Phase 2): OSMD two-hand renderer
        engine/
          GameEngine.ts           # rAF loop, timing windows, combo, holds, miss
          transport.ts            # shared clock for tile + sheet modes
        audio/
          synth.ts                # VERBATIM synth constants
          audioContext.ts         # gesture-unlock + iOS resume handling
        songs/
          schema.ts               # {midi,letter,beat,beats} + meta types
          builtin/twinkle.ts      # ported default demo song
        sources/                  # SongSource / audio-source abstraction
          SongSource.ts uploadSource.ts catalogSource.ts youtubeSource.ts(gated)
        adapters/
          melodyAdapter.ts        # transcription -> white-key single-line tile schema
        state/
          usePreferences.ts       # localStorage-backed (replaces useTweaks)
        platform/
          orientation.ts storage.ts   # Capacitor-ready seams
      tests/visual/               # Playwright Menu/Game/Results screenshot diffs
  services/
    transcription/                # FastAPI backend (Track B)
      app/main.py                 # POST /transcribe (file) -> job; GET /jobs/{id}
      app/pipeline/
        ingest.py separate.py transcribe.py quantize.py arrange.py export.py
      Dockerfile
```
Shared TypeScript note-schema types live in a shared package so the backend export contract and the frontend stay in lock-step.

---

## 7. PWA implementation steps (Phase 0 — ordered)

1. **Decode source first.** Run `scripts/decode-bundle.mjs` to dump real modules, the inline `<style>`, and the 3 woff2 fonts into `recovered/`. Fidelity anchor.
2. **Scaffold** `apps/web` with Vite + React + TS + `vite-plugin-pwa`.
3. **Port CSS verbatim** from the recovered `<style>` (~153 rules), preserving class names (`.keyboard`, `.tile`) and keyframes (`drift`, `twinkle`, confetti).
4. **Self-host fonts:** add `@font-face` for the 3 Fredoka woff2 in `public/fonts/`, `font-display: swap`. Remove all Google Fonts links and the in-browser Babel.
5. **Port modules with types:** `songs/schema.ts` (exact `{midi,letter,beat,beats}` + meta), `builtin/twinkle.ts`, `audio/synth.ts` (verbatim constants), `engine/GameEngine.ts` (DIFFICULTY table, timing windows 110/240/360ms, combo formula, BOTH hold thresholds 0.85 & 0.55, miss>1.06, pause/resume), `components/Piano.tsx` (octaves [4,5,6], 21 white + 15 black), screens Menu/Game/Results, Ambient/HUD/Icon/Star.
6. **Settings screen:** reimplement the five Tweaks options behind `usePreferences` (localStorage, versioned, safe defaults); boot on the original defaults; remove the `postMessage`/`__edit_mode_*` scaffold.
7. **AudioContext gesture-unlock:** create/resume on first tap (countdown start), silent-buffer unlock, resume on visibility/focus for iOS.
8. **Input:** pointer events + multi-touch on the keyboard (hold notes + simultaneous taps).
9. **Responsive + orientation:** landscape-lock during gameplay (`screen.orientation.lock` via `platform/orientation.ts`, with a CSS-rotate fallback + 'rotate your device' nudge since iOS Safari web lacks `orientation.lock`); portrait-usable Menu/Settings/Results.
10. **PWA wiring:** `manifest.webmanifest` (name 'Piano Pop', theme `#e08adf`, display `standalone`, orientation hints), icons from the SVG thumbnail (maskable + standard sizes), Workbox precache of shell/JS/CSS/fonts/icons; offline-first for the game.
11. **Deploy** to Cloudflare Pages over HTTPS.
12. **Acceptance — visual + behavioral:** Playwright screenshots of Menu/Game/Results at **defined reference viewport(s)** (state explicitly: a fixed desktop viewport for pixel-faithful diffing of the *original-equivalent* layout, plus designated phone breakpoints validated as an *adaptation*, not a pixel match); manual behavioral parity for countdown, timing windows, combo math, both hold thresholds, star thresholds; Lighthouse PWA pass on a real phone (installable, offline, iOS audio works).

---

## 8. AI transcription / teacher roadmap (phased)

**Feasibility verdict:** Possible today, but it is an **audio→MIDI transcription** problem, not something an LLM solves alone — a general LLM (Claude) cannot reliably transcribe audio to notes. Realistic pipeline: **audio acquisition → (optional) source separation → automatic music transcription (audio→MIDI) → beat/tempo/downbeat tracking + quantization → melody extraction / arrangement / hand-splitting → render (tile schema and/or MusicXML)**. The LLM is valuable **downstream**, on symbolic note data. Accuracy is good for solo piano, moderate for clean small ensembles, poor for dense polyphonic pop mixes — hence the POC restricts to **solo-piano uploads**.

### Phase 0 — PWA game (Track A)
Ship the faithful PWA above. No backend. The PWA launches first; the AI features follow.

### Phase 1 — Upload-file CPU POC (no YouTube)
- User **uploads a solo-piano audio file** in-app (`uploadSource`). **Bounds:** max clip length **90s** for the POC.
- FastAPI pipeline:
  - **Basic Pitch** → polyphonic MIDI.
  - **Tempo/beat/downbeat:** madmom beat + downbeat trackers → estimate a global tempo (set `beatMs`) and assume **4/4** when downbeat confidence is low; librosa as cross-check.
  - **Melody extraction:** reduce polyphony to a single melody line via a salience/skyline heuristic (prefer the highest sustained voice per beat window), since the tile game is monophonic.
  - **Quantization:** snap onsets/durations to the nearest beat subdivision on the estimated grid; map variable-tempo audio onto the app's fixed `beatMs` schema.
  - `melodyAdapter`: **white-key-snap/transpose** the line, emit canonical `{midi,letter,beat,beats}` + meta.
- Feed the **existing tile game**.
- **Acceptance (functional + quality):** (a) an uploaded solo-piano clip plays as a playable tile-game level; (b) **quality bar** — note-onset **F1 ≥ a target (e.g. 0.7)** on a held-out solo-piano test set, **and** a human 'recognizable as the song' rubric pass on a small sample. Functional-only is not sufficient.
- Stack: OSS/CPU on Fly.io. Design the API as a job (`POST /transcribe` → id, `GET /jobs/{id}`) from day one even if short clips run synchronously.

### Phase 2 — Quality + arrangement + sheet view
- Swap transcriber to **ByteDance `piano_transcription_inference`** (GPU on Modal/Replicate); add **Demucs** to isolate piano when the source isn't clean solo.
- **LLM arranger (Claude) — defined contract:**
  - *Input:* symbolic notes as JSON (and/or MusicXML) — never audio.
  - *Output:* validated MusicXML (or the canonical note JSON) with explicit left/right-hand assignment and a chosen difficulty level.
  - *Validation/repair:* schema-validate the returned MusicXML with music21; on parse failure, one repair retry, then **fall back to a deterministic non-LLM pitch-threshold hand-split** (around middle C) so the pipeline always yields a result.
  - *Long songs:* chunk by musical section to stay within context limits; stitch results.
- Build the **new two-hand sheet view** (OSMD + MusicXML via music21). Two render targets now live: tile game (simple/melody) + sheet view (teacher). Shared transport/clock + highlight bus so both can play the same arrangement.

### Phase 3 — Black-key / full fidelity
- Stop white-key-snapping; preserve accidentals. **Open design decision:** tile lanes are white-key-only today — choose a lane/label model for black keys (e.g., narrow interleaved black lanes, or label-on-tile + black-key targets). Affects `Piano.tsx`, lane geometry, and CSS.
- Richer arrangement (pedal, dynamics, voicing) where the model/LLM supports it.

### Phase 4 — Interactive teacher
- **Start:** follow-along highlighting + scoring (reuse GameEngine timing/scoring concepts against the arranged part; highlight upcoming notes on keyboard/sheet).
- **Later:** Web MIDI keyboard input (real piano), then LLM-generated lessons/practice plans. Not POC scope.

### Backend operational envelope (applies Phase 1+)
- Max audio length (POC 90s; raise deliberately later). Per-job **timeout** and **failure** states surfaced to the client. Uploaded audio is **ephemeral**: deleted after the job completes (no long-term retention — copyright/PII hygiene); only the generated chart/arrangement is kept. Bounded **concurrency/queue** limits. Track a rough **cost-per-job** estimate once the GPU model is in (Modal/Replicate per-inference pricing) to inform monetization.

---

## 9. Legal / IP workstream (distinct, gating)

This is a **commercial** product, so legal is a real blocker, not a footnote.
- **The marquee 'paste any YouTube link' vision likely cannot ship legally in that form.** The realistic, defensible teacher feature is **upload-your-own-audio** or a **licensed / public-domain catalog**. This is an accepted product reality, not a deferral of the same risky feature.
- **Architecture decouples from YouTube:** all ingestion goes through the `SongSource` abstraction. `youtubeSource` exists but is **disabled and gated behind explicit legal sign-off**; the pipeline never hard-depends on YouTube scraping.
- **YouTube ToS + copyright:** downloading/extracting YouTube audio generally violates YouTube ToS and risks infringing both the musical work and the sound recording. **No public YouTube ingestion ships until counsel signs off.**
- **Permitted launch paths (priority order):** (1) **user-upload-only** of content the user owns/has rights to (POC default, with in-app rights attestation); (2) **properly-licensed catalogs** (license sheet music / mechanical/sync rights, or partner with a rights-holder/aggregator); (3) public-domain or CC-licensed works.
- **Generated-output copyright:** clarify ownership/licensing of AI-generated arrangements/sheet music for a paid product (derivative-work status is the key risk); restrict generation to licensed/owned/public-domain inputs.
- **In-app notices:** clear terms, content-rights attestation on upload, attribution where licenses require.
- **Deliverable:** a legal sign-off checklist that must be green before enabling `youtubeSource` or any non-upload public ingestion.

---

## 10. Risks & open considerations
- **Faithful vs. mobile-adapted tension:** the original has no responsive/orientation logic; phone layout (landscape-lock + portrait menus) is an explicit **adaptation**. Visual-diff acceptance therefore uses a fixed desktop reference viewport for fidelity and treats phone breakpoints as adaptation targets — stated up front to avoid a false 'pixel-match-on-phone' expectation.
- **Port fidelity drift:** mitigated by decode-first + Playwright diffs + verbatim CSS/synth/engine constants; fallback to the runtime `DecompressionStream` path if a module won't decode.
- **iOS Web Audio quirks** (autoplay/unlock, interruption, sample rate): mitigated by `audioContext.ts`; explicit real-iPhone acceptance.
- **Orientation lock unsupported on iOS Safari web:** CSS-rotate fallback + nudge now; Capacitor native lock later.
- **Transcription accuracy** poor on dense pop mixes: POC scoped to solo piano; Demucs + ByteDance + white-key-snap reduce early-phase error; quality gated by an F1 + human-recognizability bar, not just 'it plays.'
- **Melody extraction / variable-tempo→fixed-beat mapping** is the hard part of Phase 1 — specified above (salience/skyline melody, madmom beat+downbeat, 4/4 default, grid snap) and should be treated as the primary POC research risk.
- **LLM arranger** robustness: MusicXML validation + repair retry + deterministic pitch-threshold fallback so the pipeline never dead-ends.
- **GPU cost/latency:** pay-per-inference (Modal/Replicate) + async jobs; no idle GPU.
- **Legal exposure:** the central commercial risk; mitigated by the gating workstream and upload-only/licensed launch.
- **Two-render-target divergence:** mitigated by a shared transport/clock + shared synth and a single canonical arrangement format.
- **Black-key lane model:** UX redesign deferred to Phase 3; flagged as an explicit decision.

**Baked-in defaults (decided, revisit only if needed):** monorepo; keep 'Twinkle' as default demo level; PWA launches first then the upload POC; localStorage-only prefs for v1 (cloud-sync seam preserved); Claude as the arranger LLM (symbolic data only); licensing priority upload-only → licensed/public-domain → gated YouTube; monetization shape (free game + paid teacher / subscription) noted as a later, non-blocking product decision.

---

## 11. Acceptance criteria
- **Faithful game port:** Playwright screenshot diff of Menu / Game / Results at the defined reference viewport within tolerance; behavioral parity verified for countdown (700ms, 3→2→1), timing windows (110/240/360ms), combo multiplier (×(1+min(combo,20)×0.1)), hold notes (both 0.85 auto-complete and 0.55 release-bonus thresholds), star thresholds (0.9/0.6/>0), miss at progress>1.06; synth audibly identical (verbatim constants); game boots on the original defaults.
- **PWA:** installs on Android + iOS; runs fully offline (game + fonts + synth); Lighthouse PWA category passes on a real phone; landscape-locked gameplay, portrait-usable menus; audio unlocks on first tap on iPhone.
- **Settings:** preferences persist across reloads via localStorage; defaults safe on corrupt/missing data; absence of saved prefs reproduces original default behavior.
- **AI POC (Phase 1):** an uploaded solo-piano clip (≤90s) is transcribed by the backend and plays as a playable tile-game level (melody-extracted, quantized, white-key-snapped), meeting both the functional gate and the transcription quality bar (onset F1 target + human recognizability).
