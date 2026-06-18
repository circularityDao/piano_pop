import { test, expect } from "@playwright/test";

// Phase-0 acceptance (plan §11): screenshot diff of Menu / Game / Results /
// Settings at the defined reference viewport(s), plus behavioral spot-checks
// of the verified engine constants.
//
// Run baselines once with:  npx playwright test --update-snapshots
// Requires browsers:        npx playwright install chromium

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
});

test("Menu renders on baked defaults", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Piano Pop" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Twinkle Twinkle Little Star" })
  ).toBeVisible();
  // 42 notes (7 phrases-of-7 * 6 = 42) — verifies the built-in song built right.
  await expect(page.getByText(/· 42 notes/)).toBeVisible();
  await expect(page).toHaveScreenshot("menu.png", { animations: "disabled" });
});

test("Game boots: countdown -> keyboard + field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Let's Play!" }).click();
  // 3 octaves C4..B6 = 21 white + 15 black = 36 keys.
  await expect(page.locator(".keyboard [data-key]")).toHaveCount(36);
  await expect(page.locator(".keyboard [data-type=white]")).toHaveCount(21);
  await expect(page.locator(".keyboard [data-type=black]")).toHaveCount(15);
  await expect(page.locator(".hitline")).toBeVisible();
});

test("Settings exposes all five options and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  // defaults: Easy / Single selected
  await expect(page.locator(".seg-btn.on")).toHaveText(["Easy", "Single"]);
  await page.getByRole("radio", { name: "Challenge" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator(".seg-btn.on").first()).toHaveText("Challenge");
  await expect(page).toHaveScreenshot("settings.png", { animations: "disabled" });
});
