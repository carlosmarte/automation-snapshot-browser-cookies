// node extract-cookies-wdio-sauce.mjs https://example.com

import { remote } from "webdriverio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse URL argument
const url = process.argv[2];
if (!url) {
  console.error("❌ Please provide a URL:");
  console.error("Usage: node extract-cookies-wdio-sauce.mjs <URL>");
  process.exit(1);
}

const outputPath = path.join(__dirname, "cookies.json");

// === Sauce Labs Credentials ===
const USERNAME = process.env.SAUCE_USERNAME || "oauth-robmarte-6ddbc";
const ACCESS_KEY = process.env.SAUCE_ACCESS_KEY || "*****6fbd";

const capabilities = {
  browserName: "chrome",
  browserVersion: "latest",
  platformName: "Windows 11",
  "sauce:options": {
    build: "cookie-extraction-build-001",
    name: `Extract cookies from ${url}`,
  },
};

(async () => {
  const driver = await remote({
    user: USERNAME,
    key: ACCESS_KEY,
    hostname: "ondemand.us-west-1.saucelabs.com",
    port: 443,
    path: "/wd/hub",
    logLevel: "error",
    capabilities,
  });

  let testPassed = false;

  try {
    console.log(`🌐 Navigating to ${url}...`);
    await driver.navigateTo(url);

    // Retrieve cookies via WebDriver protocol
    const browserCookies = await driver.getCookies();

    // Retrieve JS cookies from `document.cookie`
    const windowCookiesString = await driver.execute(() => document.cookie);
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

    testPassed = true;
  } catch (err) {
    console.error("❌ Error during session:", err.message);
  }

  // Report job result to Sauce Labs
  await driver.execute(`sauce:job-result=${testPassed ? "passed" : "failed"}`);
  await driver.deleteSession();
})();
