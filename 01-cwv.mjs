import { chromium } from "playwright";
import { readFile } from "fs/promises";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse URL from CLI
const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error("❌ Please provide a URL.");
  console.error("Usage: node collect-cwv.mjs <URL>");
  process.exit(1);
}

// Output file path
const outputFile = join(__dirname, "cwv-results.json");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Read the web-vitals script
  const webVitalsScript = await readFile(
    resolve("node_modules/web-vitals/dist/web-vitals.iife.js"),
    "utf-8"
  );

  // Setup promises that resolve from page context
  const lcpPromise = page.evaluateHandle(
    () =>
      new Promise((resolve) => {
        window.reportLCP = (metric) => resolve(metric);
      })
  );
  const clsPromise = page.evaluateHandle(
    () =>
      new Promise((resolve) => {
        window.reportCLS = (metric) => resolve(metric);
      })
  );
  const inpPromise = page.evaluateHandle(
    () =>
      new Promise((resolve) => {
        window.reportINP = (metric) => resolve(metric);
      })
  );

  // Inject web-vitals and reporting handlers
  await page.addInitScript({
    content: `
      ${webVitalsScript}
      webVitals.onLCP(window.reportLCP);
      webVitals.onCLS(window.reportCLS);
      webVitals.onINP(window.reportINP);
    `,
  });

  console.log(`🌐 Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: "networkidle" });

  console.log("⏳ Waiting for Core Web Vitals...");
  const [lcpHandle, clsHandle, inpHandle] = await Promise.all([
    lcpPromise,
    clsPromise,
    inpPromise,
  ]);

  const lcp = await lcpHandle.jsonValue();
  const cls = await clsHandle.jsonValue();
  const inp = await inpHandle.jsonValue();

  const results = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    LCP: lcp,
    CLS: cls,
    INP: inp,
  };

  await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
  console.log(`✅ CWV saved to ${outputFile}`);

  await browser.close();
})();
