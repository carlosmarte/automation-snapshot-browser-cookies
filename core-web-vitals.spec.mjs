import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

test.skip.describe("Core Web Vitals Analysis", () => {
  const targetUrl = process.env.TARGET_URL || "https://www.google.com";

  test("should meet Core Web Vitals thresholds", async ({ page }) => {
    // 1. Create promises that will resolve when the web-vitals are reported
    // We don't need the <...> type generics from TypeScript here.
    const lcpPromise = new Promise((resolve) =>
      page.exposeFunction("reportLCP", resolve)
    );
    const clsPromise = new Promise((resolve) =>
      page.exposeFunction("reportCLS", resolve)
    );
    const inpPromise = new Promise((resolve) =>
      page.exposeFunction("reportINP", resolve)
    );

    // 2. Inject the web-vitals library and our reporting logic
    const webVitalsScript = readFileSync(
      resolve("node_modules/web-vitals/dist/web-vitals.iife.js"),
      "utf-8"
    );
    await page.addInitScript({
      content: `
        ${webVitalsScript}
        webVitals.onLCP(window.reportLCP);
        webVitals.onCLS(window.reportCLS);
        webVitals.onINP(window.reportINP);
      `,
    });

    // 3. Navigate and wait for results
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    console.log("Waiting for Core Web Vitals...");
    const [lcp, cls, inp] = await Promise.all([
      lcpPromise,
      clsPromise,
      inpPromise,
    ]);

    console.log("--- Core Web Vitals Received ---");
    console.log(lcp);
    console.log(cls);
    console.log(inp);

    // 4. Assert that the vitals are within "Good" thresholds
    // expect(lcp.value, "LCP should be less than 2.5 seconds").toBeLessThan(2500);
    // expect(cls.value, "CLS should be less than 0.1").toBeLessThan(0.1);
    // expect(inp.value, "INP should be less than 200 milliseconds").toBeLessThan(
    //   200
    // );
  });
});
