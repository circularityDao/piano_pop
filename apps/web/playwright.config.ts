import { defineConfig, devices } from "@playwright/test";

// Visual + behavioral acceptance harness (plan §7 step 12, §11).
//
// Reference viewports (stated explicitly per plan §10 to avoid a false
// "pixel-match-on-phone" expectation):
//   - "desktop-ref" 1280x720  -> FIXED reference viewport for pixel-faithful
//      diffing of the original-equivalent layout (fidelity gate).
//   - "phone-landscape" / "phone-portrait" -> designated phone breakpoints
//      validated as an ADAPTATION, not a pixel match.
//
// The dev/preview server is started automatically. First run records baseline
// screenshots; subsequent runs diff against them within tolerance.
export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__screenshots__",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4318",
    trace: "on-first-retry",
  },
  expect: {
    // tolerance for anti-aliasing / minor sub-pixel differences
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: "desktop-ref",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "phone-landscape",
      use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "phone-portrait",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4318 --strictPort",
    url: "http://localhost:4318",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
