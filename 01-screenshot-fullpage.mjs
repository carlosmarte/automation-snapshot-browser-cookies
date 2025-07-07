// node screenshot-fullpage.mjs https://example.com

import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get URL from CLI
const url = process.argv[2];
if (!url) {
  console.error("❌ Please provide a URL:");
  console.error("Usage: node screenshot-fullpage.mjs <URL>");
  process.exit(1);
}

// Output path
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const fileName = `screenshot-${timestamp}.png`;
const outputPath = path.join(__dirname, fileName);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "load" });

  console.log("📸 Taking full-page screenshot...");
  await page.screenshot({ path: outputPath, fullPage: true });

  console.log(`✅ Screenshot saved to ${outputPath}`);
  await browser.close();
})();
