# Piano Pop

A pixel- and behavior-faithful **PWA** port of the standalone Piano-Tiles-style
piano rhythm game (Track A / Phase 0), plus design-now seams for a future
AI piano-teacher (Track B). See `brainstorming/piano-pop-pwa-and-ai-teacher/plan.md`.

## Monorepo layout

```
piano_pop/
  Piano_Pop_(standalone).html   # original bundle (source of truth)
  scripts/
    decode-bundle.mjs           # base64 -> gunzip -> text recovery (run FIRST)
    generate-icons.mjs          # dependency-free PWA PNG icon generator
  recovered/                    # decode output (reference only, not shipped)
  apps/web/                     # the PWA (Vite + React + TS + vite-plugin-pwa)
    src/
      screens/ Menu Game Results Settings
      components/ Piano Ambient HUD Icon Star
      engine/ GameEngine.ts transport.ts
      audio/ synth.ts audioContext.ts
      songs/ schema.ts keys.ts builtin/twinkle.ts
      sources/ SongSource uploadSource catalogSource youtubeSource(gated)
      adapters/ melodyAdapter.ts
      state/ usePreferences.ts
      platform/ orientation.ts storage.ts
      styles/ game.css(verbatim) fonts.css additions.css
    public/ fonts/ icons/ manifest (generated)
    tests/visual/ screens.spec.ts   # Playwright acceptance harness
```

## Commands

```bash
npm install                # install workspace deps
node scripts/decode-bundle.mjs   # recover real source/CSS/fonts -> recovered/
node scripts/generate-icons.mjs  # (re)generate PWA PNG icons
npm run dev                # vite dev server
npm run build              # tsc --noEmit && vite build (generates SW + manifest)
npm run preview            # serve the production build
npm run test:visual --workspace apps/web   # Playwright screenshots
#   first run needs: npx playwright install chromium, then --update-snapshots
```

## Fidelity

`recovered/` holds the decoded original modules, the verbatim inline `<style>`
(`styles-game.css`), and the 3 Fredoka woff2. The port **transliterates** those
files; `src/styles/game.css` is the recovered stylesheet copied verbatim. The
synth (`audio/synth.ts`), the engine constants (`engine/GameEngine.ts`), the
note schema, and the keyboard layout are reproduced exactly per plan §4.

## Intentional additions / deviations from the original (flagged)

- **Settings screen** (`screens/Settings`, `state/usePreferences.ts`): the
  original had no visible settings — its `TweaksPanel` only appeared inside a
  no-code-builder host. Per plan §3-D7 it is now a real, localStorage-persisted
  screen exposing all 5 options. The game still **boots on the original baked
  defaults**, and the `postMessage`/`__edit_mode_*` scaffold is removed.
- **No React `Tile` component.** Tiles are created/animated imperatively by
  `GameEngine` exactly as the original does — there is no `Tile` component in the
  recovered source, so one was deliberately not invented (plan §6 lists it, but
  faithfulness wins).
- **No Track-B backend.** Plan §8 Phase 0 is explicitly "No backend." The
  `services/transcription` FastAPI tree and `sheet/SheetView.tsx` (Phase 2) are
  intentionally **not** built. The `SongSource` abstraction, `melodyAdapter`, and
  `transport` exist as typed design-now stubs; `youtubeSource` is hard-disabled
  pending legal sign-off (plan §9).
- **Responsive/orientation** is an adaptation, not a pixel match (plan §10):
  landscape-locked gameplay + a portrait "rotate your device" nudge; menus and
  settings are portrait-usable.
