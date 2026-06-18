import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Piano Pop PWA (Track A). Workbox generateSW precaches the app shell, JS, CSS,
// self-hosted Fredoka woff2, and icons so the game runs fully offline (sound is
// synthesized — there are no audio samples to fetch). Future Track-B backend
// calls under /api/* are intentionally NOT precached (network-only seam).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon.svg",
        "fonts/fredoka-1.woff2",
        "fonts/fredoka-2.woff2",
        "fonts/fredoka-3.woff2",
      ],
      manifest: {
        name: "Piano Pop",
        short_name: "Piano Pop",
        description:
          "Catch the magic notes and play real songs — a falling-tile piano rhythm game.",
        theme_color: "#e08adf",
        background_color: "#e08adf",
        display: "standalone",
        orientation: "landscape",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Track-B API stays online-only: never serve the SPA shell or a cached
        // response for backend transcription endpoints.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
            options: { cacheName: "api-network-only" },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
