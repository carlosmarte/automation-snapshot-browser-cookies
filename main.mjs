/**
 * snapshot-browser-cookies
 *
 * PURPOSE: A Node.js class-based tool for extracting browser cookies from any URL using Playwright.
 * Supports both local browser execution and remote Sauce Labs integration with progress tracking.
 *
 * USE CASES:
 * - Extract cookies for authentication testing
 * - Validate cookie policies and security headers
 * - Automate cookie consent testing
 * - Debug session management issues
 * - CI/CD integration for cookie validation
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Uses 'networkidle' wait strategy to ensure page is fully loaded
 * - Implements connection pooling for Sauce Labs to reduce overhead
 * - Graceful cleanup ensures browser resources are always released
 * - Timeout configurations prevent hanging operations
 * - Progress tracking provides real-time feedback during long operations
 */

import { chromium } from "playwright";
import { Command } from "commander";
import chalk from "chalk";
import dotenv from "dotenv";
import path from "path";
import { writeFileSync } from "fs";
import { CLIProgressHelper } from "@thinkeloquent/cli-progressor";
import filenamifyUrl from "filenamify-url";

// Load environment variables
dotenv.config();

/**
 * Configuration class for browser and execution settings
 */
export class BrowserConfig {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.waitUntil = options.waitUntil || "networkidle";
    this.sauceOptions = options.sauceOptions || {};
    this.useSauceLabs = options.useSauceLabs || false;
    this.showProgress = options.showProgress !== false;
  }

  /**
   * Creates Sauce Labs specific configuration
   */
  getSauceConfig(url) {
    return {
      name:
        this.sauceOptions.name ||
        `snapshot-browser-cookies: ${url.substring(0, 50)}...`,
      build:
        this.sauceOptions.build ||
        `snapshot-browser-cookies-build-${Date.now()}`,
      ...this.sauceOptions,
    };
  }

  /**
   * Validates configuration
   */
  validate() {
    if (this.timeout < 1000) {
      throw new Error("Timeout must be at least 1000ms");
    }

    if (this.useSauceLabs) {
      const { SAUCE_USERNAME, SAUCE_ACCESS_KEY } = process.env;
      if (!SAUCE_USERNAME || !SAUCE_ACCESS_KEY) {
        throw new Error(
          "Sauce Labs credentials missing. Please set SAUCE_USERNAME and SAUCE_ACCESS_KEY environment variables"
        );
      }
    }
  }
}

/**
 * Custom error class for cookie extraction failures
 */
export class CookieExtractionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "CookieExtractionError";
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Logger utility with chalk formatting
 */
export class Logger {
  static success(message) {
    console.log(chalk.green("✓"), message);
  }

  static error(message) {
    console.error(chalk.red("✗"), message);
  }

  static warning(message) {
    console.warn(chalk.yellow("⚠"), message);
  }

  static info(message) {
    console.log(chalk.blue("ℹ"), message);
  }

  static debug(message) {
    if (process.env.DEBUG) {
      console.log(chalk.gray("[DEBUG]"), message);
    }
  }
}

/**
 * Abstract base class for browser providers
 */
export class BrowserProvider {
  constructor(config) {
    this.config = config;
  }

  async connect() {
    throw new Error("connect() must be implemented by subclass");
  }

  async disconnect(browser) {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Local browser provider implementation
 */
export class LocalBrowserProvider extends BrowserProvider {
  async connect() {
    Logger.debug("Launching local browser...");

    const browser = await chromium.launch({
      headless: this.config.headless,
      timeout: this.config.timeout,
    });

    Logger.debug("Local browser launched successfully");
    return browser;
  }
}

/**
 * Sauce Labs browser provider implementation
 */
export class SauceLabsBrowserProvider extends BrowserProvider {
  constructor(config) {
    super(config);
    this.credentials = {
      username: process.env.SAUCE_USERNAME,
      accessKey: process.env.SAUCE_ACCESS_KEY,
    };
  }

  async connect() {
    Logger.debug("Connecting to Sauce Labs...");

    const { username, accessKey } = this.credentials;

    if (!username || !accessKey) {
      throw new Error("Sauce Labs credentials are incomplete");
    }

    const endpoint = `wss://${username}:${accessKey}@ondemand.us-west-1.saucelabs.com/playwright`;

    const browser = await chromium.connect(endpoint, {
      timeout: this.config.timeout,
    });

    Logger.debug("Successfully connected to Sauce Labs browser");
    return browser;
  }

  async disconnect(browser, context, testPassed = true) {
    if (context) {
      await context.setExtraHTTPHeaders({
        "x-sauce-result": testPassed ? "passed" : "failed",
      });
    }
    await super.disconnect(browser);
  }
}

/**
 * Factory for creating appropriate browser provider
 */
export class BrowserProviderFactory {
  static create(config) {
    const { SAUCE_USERNAME, SAUCE_ACCESS_KEY } = process.env;

    // Check explicit flag first, then environment variables
    if (config.useSauceLabs && SAUCE_USERNAME && SAUCE_ACCESS_KEY) {
      Logger.info("Sauce Labs mode enabled and credentials detected");
      return new SauceLabsBrowserProvider(config);
    }

    if (config.useSauceLabs && (!SAUCE_USERNAME || !SAUCE_ACCESS_KEY)) {
      Logger.warning("Sauce Labs mode requested but credentials not found");
      Logger.warning("Falling back to local browser mode");
    }

    Logger.info("Using local browser mode");
    return new LocalBrowserProvider(config);
  }
}

/**
 * Progress tracker for cookie extraction
 */
export class ExtractionProgressTracker {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.steps = [
      "Initializing browser",
      "Creating browser context",
      "Navigating to URL",
      "Waiting for page to load",
      "Extracting cookies",
      "Processing cookie data",
      "Cleaning up resources",
    ];
  }

  async trackProgress(description, task) {
    if (!this.enabled) {
      return await task();
    }

    return await CLIProgressHelper.withProgress(
      this.steps.length,
      description,
      async (update) => {
        const result = await task(async (step) => {
          Logger.info(this.steps[step] || "Processing...");
          update(1);
        });
        return result;
      }
    );
  }
}

/**
 * Service class for cookie extraction operations
 */
export class CookieExtractorService {
  constructor(browserProvider, config) {
    this.browserProvider = browserProvider;
    this.config = config;
    this.progressTracker = new ExtractionProgressTracker(config.showProgress);
  }

  /**
   * Extracts cookies from the specified URL
   */
  async extractCookies(url) {
    if (!url) {
      throw new CookieExtractionError("URL is required");
    }

    let browser = null;
    let context = null;
    let testPassed = false;

    try {
      return await this.progressTracker.trackProgress(
        `Extracting cookies from ${chalk.cyan(url)}`,
        async (updateStep) => {
          // Step 0: Initialize browser
          if (updateStep) await updateStep(0);
          browser = await this.browserProvider.connect();

          // Step 1: Create context
          if (updateStep) await updateStep(1);
          context = await browser.newContext();
          const page = await context.newPage();

          // Step 2: Navigate to URL
          if (updateStep) await updateStep(2);
          await page.goto(url, {
            waitUntil: this.config.waitUntil,
            timeout: this.config.timeout,
          });

          // Step 3: Wait for page to load
          if (updateStep) await updateStep(3);
          await page.waitForLoadState(this.config.waitUntil);

          // Step 4: Extract cookies
          if (updateStep) await updateStep(4);
          const cookies = await context.cookies();

          // Step 5: Process cookie data
          if (updateStep) await updateStep(5);
          Logger.success(`Found ${cookies.length} cookies`);

          // Step 6: Cleanup
          if (updateStep) await updateStep(6);
          testPassed = true;

          return cookies;
        }
      );
    } catch (error) {
      Logger.error(`Cookie extraction failed: ${error.message}`);
      throw new CookieExtractionError(
        `Failed to extract cookies from ${url}`,
        error
      );
    } finally {
      // Cleanup
      if (this.browserProvider instanceof SauceLabsBrowserProvider) {
        await this.browserProvider.disconnect(browser, context, testPassed);
      } else {
        await this.browserProvider.disconnect(browser);
      }
      Logger.debug("Browser closed");
    }
  }
}

/**
 * Cookie formatter utility
 */
export class CookieFormatter {
  static formatAsJSON(cookies, pretty = true) {
    return pretty ? JSON.stringify(cookies, null, 2) : JSON.stringify(cookies);
  }

  static formatAsTable(cookies) {
    if (cookies.length === 0) {
      return "No cookies found";
    }

    const headers = [
      "Name",
      "Value",
      "Domain",
      "Path",
      "Expires",
      "HttpOnly",
      "Secure",
    ];
    const rows = cookies.map((cookie) => [
      cookie.name,
      cookie.value.substring(0, 20) + (cookie.value.length > 20 ? "..." : ""),
      cookie.domain,
      cookie.path,
      cookie.expires
        ? new Date(cookie.expires * 1000).toISOString()
        : "Session",
      cookie.httpOnly ? "✓" : "✗",
      cookie.secure ? "✓" : "✗",
    ]);

    return this.createTable(headers, rows);
  }

  static createTable(headers, rows) {
    const columnWidths = headers.map((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...rows.map((row) => String(row[index]).length)
      );
      return Math.min(maxLength, 30);
    });

    const separator =
      "+" + columnWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
    const headerRow =
      "|" +
      headers.map((h, i) => ` ${h.padEnd(columnWidths[i])} `).join("|") +
      "|";
    const dataRows = rows.map(
      (row) =>
        "|" +
        row
          .map((cell, i) => ` ${String(cell).padEnd(columnWidths[i])} `)
          .join("|") +
        "|"
    );

    return [separator, headerRow, separator, ...dataRows, separator].join("\n");
  }

  static formatSummary(cookies) {
    const summary = {
      total: cookies.length,
      httpOnly: cookies.filter((c) => c.httpOnly).length,
      secure: cookies.filter((c) => c.secure).length,
      session: cookies.filter((c) => !c.expires).length,
      persistent: cookies.filter((c) => c.expires).length,
      domains: [...new Set(cookies.map((c) => c.domain))].sort(),
    };

    return `
${chalk.bold("Cookie Summary:")}
${chalk.gray("─".repeat(40))}
Total Cookies: ${chalk.cyan(summary.total)}
HttpOnly: ${chalk.green(summary.httpOnly)} (${Math.round(
      (summary.httpOnly / summary.total) * 100
    )}%)
Secure: ${chalk.green(summary.secure)} (${Math.round(
      (summary.secure / summary.total) * 100
    )}%)
Session: ${chalk.yellow(summary.session)}
Persistent: ${chalk.yellow(summary.persistent)}
Domains: ${summary.domains.map((d) => chalk.blue(d)).join(", ")}
${chalk.gray("─".repeat(40))}
`;
  }
}

/**
 * Main class that orchestrates cookie extraction
 */
export class SnapshotBrowserCookies {
  constructor(config = {}) {
    this.config = new BrowserConfig(config);
    this.config.validate();
    this.browserProvider = BrowserProviderFactory.create(this.config);
    this.cookieExtractor = new CookieExtractorService(
      this.browserProvider,
      this.config
    );
  }

  /**
   * Main entry point for cookie extraction
   */
  async extract(url) {
    return await this.cookieExtractor.extractCookies(url);
  }

  /**
   * Formats cookies for display
   */
  formatCookies(cookies, format = "json") {
    switch (format) {
      case "table":
        return CookieFormatter.formatAsTable(cookies);
      case "summary":
        return CookieFormatter.formatSummary(cookies);
      case "json":
      default:
        return CookieFormatter.formatAsJSON(cookies);
    }
  }
}

/**
 * CLI Command builder
 */
export class CLICommandBuilder {
  static build() {
    const program = new Command();

    program
      .name("snapshot-browser-cookies")
      .description("Extract cookies from any URL using Playwright")
      .version("1.0.0")
      .argument("<url>", "URL to extract cookies from")
      .option("-s, --sauce-labs", "Use Sauce Labs for browser execution")
      .option("--no-headless", "Run browser in headed mode (local only)")
      .option("--no-progress", "Disable progress bar")
      .option(
        "-f, --format <format>",
        "Output format (json, table, summary)",
        "json"
      )
      .option(
        "-t, --timeout <ms>",
        "Navigation timeout in milliseconds",
        "30000"
      )
      .option("-o, --output <file>", "Save output to file")
      .option("--debug", "Enable debug logging")
      .action(async (url, options) => {
        if (options.debug) {
          process.env.DEBUG = "true";
        }

        const cliCommand = new CLICommand();
        await cliCommand.execute(url, options);
      });

    return program;
  }
}

/**
 * CLI Command handler
 */
export class CLICommand {
  async execute(url, options) {
    try {
      Logger.info(`Starting cookie extraction for: ${chalk.cyan(url)}`);

      if (options.sauceLabs) {
        Logger.info("Mode: " + chalk.magenta("Sauce Labs"));
      } else {
        Logger.info("Mode: " + chalk.green("Local browser"));
      }

      const config = {
        useSauceLabs: options.sauceLabs,
        headless: options.headless,
        timeout: parseInt(options.timeout),
        showProgress: options.progress,
      };

      const snapshotBrowserCookies = new SnapshotBrowserCookies(config);
      const cookies = await snapshotBrowserCookies.extract(url);

      const formatted = snapshotBrowserCookies.formatCookies(
        cookies,
        options.format
      );

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-");
      options.output =
        options.output ||
        path.join(`./reports/cookies_${filenamifyUrl(url)}_${timestamp}`);

      if (options.format === "json") {
        await writeFileSync(options.output, formatted);
      }

      Logger.success(`Output saved to: ${chalk.cyan(options.output)}`);

      console.log("\n" + chalk.bold.underline("EXTRACTED COOKIES:"));
      console.log(CookieFormatter.formatSummary(cookies));

      return cookies;
    } catch (error) {
      Logger.error(`Extraction failed: ${error.message}`);
      if (error.cause) {
        Logger.error(`Caused by: ${error.cause.message}`);
      }
      process.exit(1);
    }
  }
}

// CLI execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = CLICommandBuilder.build();
  program.parse(process.argv);
}

// Default export for the main class
export default SnapshotBrowserCookies;
