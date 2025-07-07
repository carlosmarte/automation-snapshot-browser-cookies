# Test info

- Name: Cookie Analysis >> should match the cookie snapshot
- Location: /Users/Shared/carlosmarte/automation-snapshot-browser-cookies/tests/cookies.spec.ts:25:7

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
   3 | /**
   4 |  * Sanitizes cookie data for consistent snapshot testing.
   5 |  * @param {Array<object>} cookies The array of cookies from the browser context.
   6 |  * @returns {Array<object>} A new array of sanitized cookies.
   7 |  */
   8 | function sanitizeCookiesForSnapshot(cookies) {
   9 |   return cookies.map((cookie) => ({
  10 |     name: cookie.name,
  11 |     domain: cookie.domain,
  12 |     path: cookie.path,
  13 |     // Replace dynamic values with static placeholders
  14 |     expires:
  15 |       typeof cookie.expires === "number" ? "DYNAMIC_TIMESTAMP" : cookie.expires,
  16 |     httpOnly: cookie.httpOnly,
  17 |     secure: cookie.secure,
  18 |     sameSite: cookie.sameSite,
  19 |   }));
  20 | }
  21 |
  22 | test.describe("Cookie Analysis", () => {
  23 |   const targetUrl = process.env.TARGET_URL || "https://www.google.com";
  24 |
> 25 |   test("should match the cookie snapshot", async ({ page }) => {
     |       ^ Error: browserType.connect: WebSocket error: wss://ondemand.us-west-1.saucelabs.com/playwright 404 Not Found
  26 |     await page.goto(targetUrl, { waitUntil: "networkidle" });
  27 |
  28 |     const cookies = await page.context().cookies();
  29 |     console.log(`Found ${cookies.length} cookies on ${targetUrl}.`);
  30 |
  31 |     const sanitizedCookies = sanitizeCookiesForSnapshot(cookies);
  32 |     console.log(sanitizedCookies);
  33 |     // Snapshot testing works identically in JavaScript.
  34 |     // expect(sanitizedCookies).toMatchSnapshot("cookies.json");
  35 |   });
  36 | });
  37 |
```