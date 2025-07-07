# Test info

- Name: Visual Regression Testing >> should match the full-page screenshot
- Location: /Users/Shared/carlosmarte/automation-snapshot-browser-cookies/tests/screenshot.spec.mjs:6:3

# Error details

```
Error: browserType.connect: WebSocket error: wss://ondemand.us-west-1.saucelabs.com/playwright 404 Not Found
Call log:
  - <ws connecting> wss://ondemand.us-west-1.saucelabs.com/playwright
  - <ws unexpected response> wss://ondemand.us-west-1.saucelabs.com/playwright 404 Not Found
  - <ws error> wss://ondemand.us-west-1.saucelabs.com/playwright error WebSocket was closed before the connection was established
  - <ws connect error> wss://ondemand.us-west-1.saucelabs.com/playwright WebSocket was closed before the connection was established
  - <ws disconnected> wss://ondemand.us-west-1.saucelabs.com/playwright code=1006 reason=

```

# Test source

```ts
   1 | import { test, expect } from "@playwright/test";
   2 |
   3 | test.describe("Visual Regression Testing", () => {
   4 |   const targetUrl = process.env.TARGET_URL || "https://playwright.dev/";
   5 |
>  6 |   test("should match the full-page screenshot", async ({ page }) => {
     |   ^ Error: browserType.connect: WebSocket error: wss://ondemand.us-west-1.saucelabs.com/playwright 404 Not Found
   7 |     // 1. Navigate to the page and wait for it to be stable.
   8 |     // 'networkidle' is a good signal that images and other resources have loaded.
   9 |     await page.goto(targetUrl, { waitUntil: "networkidle" });
  10 |
  11 |     // 2. Use Playwright's built-in visual comparison tool.
  12 |     // By default, `toMatchSnapshot` takes a full-page screenshot.
  13 |     // The first time you run this, it will save a "golden" snapshot.
  14 |     // Subsequent runs will compare against that saved snapshot.
  15 |     // await expect(page).toMatchSnapshot("full-page.png", {
  16 |     //   // Optional: Add a threshold for minor rendering differences.
  17 |     //   // 0.2 means the test will pass if the screenshots are 99.8% identical.
  18 |     //   maxDiffPixelRatio: 0.02,
  19 |     // });
  20 |   });
  21 | });
  22 |
```