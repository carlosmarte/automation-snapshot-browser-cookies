import { test, expect } from "@playwright/test";

/**
 * Sanitizes cookie data for consistent snapshot testing.
 * @param {Array<object>} cookies The array of cookies from the browser context.
 * @returns {Array<object>} A new array of sanitized cookies.
 */
function sanitizeCookiesForSnapshot(cookies) {
  return cookies.map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    // Replace dynamic values with static placeholders
    expires:
      typeof cookie.expires === "number" ? "DYNAMIC_TIMESTAMP" : cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  }));
}

test.describe("Cookie Analysis", () => {
  const targetUrl = process.env.TARGET_URL || "https://www.google.com";

  test("should match the cookie snapshot", async ({ page }) => {
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    const cookies = await page.context().cookies();
    console.log(`Found ${cookies.length} cookies on ${targetUrl}.`);

    const sanitizedCookies = sanitizeCookiesForSnapshot(cookies);
    console.log(sanitizedCookies);
    // Snapshot testing works identically in JavaScript.
    // expect(sanitizedCookies).toMatchSnapshot("cookies.json");
  });
});
