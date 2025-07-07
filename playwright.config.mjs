import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Read from default ".env" file.
dotenv.config();

// The build name for Sauce Labs, incorporating the GitHub Action number if available
const SAUCE_BUILD = `Vitals & Cookies - ${
  process.env.GITHUB_RUN_ID || "Local"
}`;

export default defineConfig({
  // Look for test files in the "tests" directory.
  // Playwright automatically finds .mjs files.
  testDir: "./tests",

  // Timeout per test
  timeout: 120 * 1000,

  reporter: "html",

  projects: [
    // --- LOCAL TESTING PROJECT ---
    {
      name: "chromium-local",
      use: { ...devices["Desktop Chrome"] },
    },

    // --- SAUCE LABS PROJECTS ---
    {
      name: "sauce-labs-chrome",
      use: {
        connectOptions: {
          wsEndpoint: `wss://ondemand.us-west-1.saucelabs.com/playwright?user=${process.env.SAUCE_USERNAME}&key=${process.env.SAUCE_ACCESS_KEY}`,
        },
        browserName: "chromium",
        platform: "Windows 11",
        "sauce:options": {
          name: "Vitals and Cookies Test (Chrome)",
          build: SAUCE_BUILD,
        },
      },
    },
  ],
});
