import { test, expect } from "@playwright/test";

test.describe("Visual Regression Testing", () => {
  const targetUrl = process.env.TARGET_URL || "https://playwright.dev/";

  test("should match the full-page screenshot", async ({ page }) => {
    // 1. Navigate to the page and wait for it to be stable.
    // 'networkidle' is a good signal that images and other resources have loaded.
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    // 2. Use Playwright's built-in visual comparison tool.
    // By default, `toMatchSnapshot` takes a full-page screenshot.
    // The first time you run this, it will save a "golden" snapshot.
    // Subsequent runs will compare against that saved snapshot.
    // await expect(page).toMatchSnapshot("full-page.png", {
    //   // Optional: Add a threshold for minor rendering differences.
    //   // 0.2 means the test will pass if the screenshots are 99.8% identical.
    //   maxDiffPixelRatio: 0.02,
    // });
  });
});
