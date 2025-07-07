import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Utility to resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line URL
const url = process.argv[2];
if (!url) {
  console.error("❌ Please provide a URL:");
  console.error("Usage: node extract-cookies.mjs <URL>");
  process.exit(1);
}

const outputPath = path.join(__dirname, "cookies.json");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "load" });

  // Get cookies via Playwright API
  const browserCookies = await context.cookies();

  // Get window.document.cookie (may include JS-set cookies not in HTTP headers)
  const windowCookiesString = await page.evaluate(() => document.cookie);
  const windowCookies = windowCookiesString
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name, value: rest.join("=") };
    });

  const result = {
    url,
    timestamp: new Date().toISOString(),
    browserCookies,
    windowCookies,
  };

  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`✅ Cookies saved to ${outputPath}`);

  await browser.close();
})();
