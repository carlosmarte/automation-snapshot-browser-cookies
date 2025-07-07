// node extract-cookies-wdio.mjs https://example.com

import { remote } from "webdriverio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command-line URL
const url = process.argv[2];
if (!url) {
  console.error("❌ Please provide a URL:");
  console.error("Usage: node extract-cookies-wdio.mjs <URL>");
  process.exit(1);
}

const outputPath = path.join(__dirname, "cookies.json");

(async () => {
  const browser = await remote({
    capabilities: {
      browserName: "chrome",
    },
    logLevel: "error", // set to 'info' or 'debug' for verbosity
  });

  console.log(`🌐 Navigating to ${url}...`);
  await browser.url(url);

  // Grab browser-managed cookies
  const browserCookies = await browser.getCookies();

  // Grab window.document.cookie via browser JS context
  const windowCookiesString = await browser.execute(() => document.cookie);
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
  console.log(`✅ Cookies saved to ${outputPath}`, result);

  await browser.deleteSession();
})();
