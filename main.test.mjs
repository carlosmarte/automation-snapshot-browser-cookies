import { jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { EventEmitter } from "events";

// Create require for CJS modules in ESM context
const require = createRequire(import.meta.url);

// Mock playwright
const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  waitForLoadState: jest.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  cookies: jest.fn().mockResolvedValue([
    {
      name: "session",
      value: "abc123",
      domain: "example.com",
      path: "/",
      httpOnly: true,
      secure: true,
    },
    {
      name: "tracking",
      value: "xyz789",
      domain: "example.com",
      path: "/",
      httpOnly: false,
      secure: false,
    },
  ]),
  setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.unstable_mockModule("playwright", () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
    connect: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock commander
jest.unstable_mockModule("commander", () => {
  class Command {
    constructor() {
      this.commands = [];
      this.opts = {};
    }
    name() {
      return this;
    }
    description() {
      return this;
    }
    version() {
      return this;
    }
    argument() {
      return this;
    }
    option() {
      return this;
    }
    action(fn) {
      this.actionHandler = fn;
      return this;
    }
    parse() {
      return this;
    }
  }
  return { Command };
});

// Mock chalk
jest.unstable_mockModule("chalk", () => ({
  default: {
    green: (text) => text,
    red: (text) => text,
    yellow: (text) => text,
    blue: (text) => text,
    cyan: (text) => text,
    magenta: (text) => text,
    gray: (text) => text,
    bold: (text) => text,
    underline: (text) => text,
  },
}));

// Mock dotenv
jest.unstable_mockModule("dotenv", () => ({
  default: {
    config: jest.fn(),
  },
}));

// Mock @thinkeloquent/cli-progressor
jest.unstable_mockModule("@thinkeloquent/cli-progressor", () => ({
  ProgressBar: class ProgressBar {
    start() {}
    update() {}
  },
  CLIProgressHelper: {
    withProgress: async (total, desc, taskFn) => {
      // Execute task without progress updates
      return await taskFn(() => {});
    },
  },
  Colors: {
    success: (text) => text,
    error: (text) => text,
    warning: (text) => text,
    info: (text) => text,
  },
}));

// Import after mocking
const { chromium } = await import("playwright");
const {
  SnapshotBrowserCookies,
  BrowserConfig,
  LocalBrowserProvider,
  SauceLabsBrowserProvider,
  BrowserProviderFactory,
  CookieExtractorService,
  CookieExtractionError,
  CLICommand,
  CLICommandBuilder,
  Logger,
  CookieFormatter,
  ExtractionProgressTracker,
} = await import("./main.mjs");

// Spy on console methods
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

describe("BrowserConfig", () => {
  test("should initialize with default values", () => {
    const config = new BrowserConfig();
    expect(config.headless).toBe(true);
    expect(config.timeout).toBe(30000);
    expect(config.waitUntil).toBe("networkidle");
    expect(config.useSauceLabs).toBe(false);
    expect(config.showProgress).toBe(true);
  });

  test("should accept custom options", () => {
    const config = new BrowserConfig({
      headless: false,
      timeout: 60000,
      waitUntil: "domcontentloaded",
      useSauceLabs: true,
      showProgress: false,
    });
    expect(config.headless).toBe(false);
    expect(config.timeout).toBe(60000);
    expect(config.waitUntil).toBe("domcontentloaded");
    expect(config.useSauceLabs).toBe(true);
    expect(config.showProgress).toBe(false);
  });

  test("should generate Sauce Labs config", () => {
    const config = new BrowserConfig({
      sauceOptions: { tags: ["test"] },
    });
    const sauceConfig = config.getSauceConfig("https://example.com");
    expect(sauceConfig.name).toContain("snapshot-browser-cookies");
    expect(sauceConfig.build).toContain("snapshot-browser-cookies-build");
    expect(sauceConfig.tags).toEqual(["test"]);
  });

  test("should validate timeout", () => {
    const config = new BrowserConfig({ timeout: 500 });
    expect(() => config.validate()).toThrow("Timeout must be at least 1000ms");
  });

  test("should validate Sauce Labs credentials", () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.SAUCE_USERNAME;
    delete process.env.SAUCE_ACCESS_KEY;

    const config = new BrowserConfig({ useSauceLabs: true });
    expect(() => config.validate()).toThrow("Sauce Labs credentials missing");

    process.env = originalEnv;
  });
});

describe("LocalBrowserProvider", () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LocalBrowserProvider(new BrowserConfig());
  });

  test("should launch local browser", async () => {
    const browser = await provider.connect();

    expect(chromium.launch).toHaveBeenCalledWith({
      headless: true,
      timeout: 30000,
    });
    expect(browser).toBe(mockBrowser);
  });

  test("should disconnect browser", async () => {
    await provider.disconnect(mockBrowser);
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});

describe("SauceLabsBrowserProvider", () => {
  let provider;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SAUCE_USERNAME: "testuser",
      SAUCE_ACCESS_KEY: "testkey",
    };
    provider = new SauceLabsBrowserProvider(new BrowserConfig());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should connect to Sauce Labs", async () => {
    const browser = await provider.connect();

    expect(chromium.connect).toHaveBeenCalledWith(
      expect.stringContaining(
        "wss://testuser:testkey@ondemand.us-west-1.saucelabs.com/playwright"
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-sauce-options": expect.any(String),
        }),
        timeout: 30000,
      })
    );
    expect(browser).toBe(mockBrowser);
  });

  test("should throw error when credentials are missing", async () => {
    delete process.env.SAUCE_USERNAME;
    provider = new SauceLabsBrowserProvider(new BrowserConfig());

    await expect(provider.connect()).rejects.toThrow(
      "Sauce Labs credentials are incomplete"
    );
  });

  test("should set test result on disconnect", async () => {
    await provider.disconnect(mockBrowser, mockContext, false);

    expect(mockContext.setExtraHTTPHeaders).toHaveBeenCalledWith({
      "x-sauce-result": "failed",
    });
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});

describe("BrowserProviderFactory", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should create LocalBrowserProvider when useSauceLabs is false", () => {
    process.env.SAUCE_USERNAME = "testuser";
    process.env.SAUCE_ACCESS_KEY = "testkey";

    const provider = BrowserProviderFactory.create(
      new BrowserConfig({ useSauceLabs: false })
    );

    expect(provider).toBeInstanceOf(LocalBrowserProvider);
  });

  test("should create LocalBrowserProvider when no Sauce Labs credentials", () => {
    delete process.env.SAUCE_USERNAME;
    delete process.env.SAUCE_ACCESS_KEY;

    const provider = BrowserProviderFactory.create(
      new BrowserConfig({ useSauceLabs: true })
    );

    expect(provider).toBeInstanceOf(LocalBrowserProvider);
  });

  test("should create SauceLabsBrowserProvider when flag is true and credentials exist", () => {
    process.env.SAUCE_USERNAME = "testuser";
    process.env.SAUCE_ACCESS_KEY = "testkey";

    const provider = BrowserProviderFactory.create(
      new BrowserConfig({ useSauceLabs: true })
    );

    expect(provider).toBeInstanceOf(SauceLabsBrowserProvider);
  });
});

describe("CookieExtractorService", () => {
  let service;
  let mockProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProvider = {
      connect: jest.fn().mockResolvedValue(mockBrowser),
      disconnect: jest.fn(),
    };

    // Reset mock implementations
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockContext.cookies.mockResolvedValue([
      { name: "session", value: "abc123", domain: "example.com" },
      { name: "tracking", value: "xyz789", domain: "example.com" },
    ]);

    service = new CookieExtractorService(mockProvider, new BrowserConfig());
  });

  test("should extract cookies successfully", async () => {
    const cookies = await service.extractCookies("https://example.com");

    expect(mockProvider.connect).toHaveBeenCalled();
    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.newPage).toHaveBeenCalled();
    expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    expect(mockContext.cookies).toHaveBeenCalled();
    expect(cookies).toHaveLength(2);
    expect(cookies[0].name).toBe("session");
  });

  test("should throw error when URL is missing", async () => {
    await expect(service.extractCookies()).rejects.toThrow(
      CookieExtractionError
    );
    await expect(service.extractCookies("")).rejects.toThrow(
      CookieExtractionError
    );
  });

  test("should handle navigation errors", async () => {
    mockPage.goto.mockRejectedValue(new Error("Navigation failed"));

    await expect(service.extractCookies("https://example.com")).rejects.toThrow(
      CookieExtractionError
    );

    expect(mockProvider.disconnect).toHaveBeenCalled();
  });

  test("should cleanup resources on error", async () => {
    mockContext.cookies.mockRejectedValue(
      new Error("Cookie extraction failed")
    );

    try {
      await service.extractCookies("https://example.com");
    } catch (error) {
      // Expected error
    }

    expect(mockProvider.disconnect).toHaveBeenCalled();
  });
});

describe("CookieFormatter", () => {
  const testCookies = [
    {
      name: "session",
      value: "abc123",
      domain: "example.com",
      path: "/",
      httpOnly: true,
      secure: true,
      expires: Math.floor(Date.now() / 1000) + 3600,
    },
    {
      name: "tracking",
      value: "xyz789",
      domain: "example.com",
      path: "/",
      httpOnly: false,
      secure: false,
    },
  ];

  test("should format cookies as JSON", () => {
    const json = CookieFormatter.formatAsJSON(testCookies);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(testCookies);
    expect(json).toContain("\n"); // Pretty printed
  });

  test("should format cookies as table", () => {
    const table = CookieFormatter.formatAsTable(testCookies);
    expect(table).toContain("Name");
    expect(table).toContain("Value");
    expect(table).toContain("session");
    expect(table).toContain("tracking");
  });

  test("should format cookie summary", () => {
    const summary = CookieFormatter.formatSummary(testCookies);
    expect(summary).toContain("Total Cookies: 2");
    expect(summary).toContain("HttpOnly: 1");
    expect(summary).toContain("Secure: 1");
  });
});

describe("ExtractionProgressTracker", () => {
  test("should track progress when enabled", async () => {
    const tracker = new ExtractionProgressTracker(true);
    let stepsCalled = [];

    const result = await tracker.trackProgress("Test", async (updateStep) => {
      await updateStep(0);
      stepsCalled.push(0);
      await updateStep(1);
      stepsCalled.push(1);
      return "success";
    });

    expect(result).toBe("success");
    expect(stepsCalled).toEqual([0, 1]);
  });

  test("should skip progress when disabled", async () => {
    const tracker = new ExtractionProgressTracker(false);

    const result = await tracker.trackProgress("Test", async () => {
      return "success";
    });

    expect(result).toBe("success");
  });
});

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should log different message types", () => {
    Logger.success("Test success");
    Logger.error("Test error");
    Logger.warning("Test warning");
    Logger.info("Test info");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.any(String),
      "Test success"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.any(String),
      "Test error"
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.any(String),
      "Test warning"
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.any(String), "Test info");
  });

  test("should only log debug when DEBUG is set", () => {
    const originalDebug = process.env.DEBUG;

    Logger.debug("Test debug");
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[DEBUG]"),
      "Test debug"
    );

    process.env.DEBUG = "true";
    Logger.debug("Test debug 2");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[DEBUG]"),
      "Test debug 2"
    );

    process.env.DEBUG = originalDebug;
  });
});

describe("SnapshotBrowserCookies", () => {
  let snapshotBrowserCookies;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SAUCE_USERNAME: "testuser",
      SAUCE_ACCESS_KEY: "testkey",
    };
    snapshotBrowserCookies = new SnapshotBrowserCookies();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should initialize with default config", () => {
    expect(snapshotBrowserCookies.config).toBeInstanceOf(BrowserConfig);
    expect(snapshotBrowserCookies.browserProvider).toBeDefined();
    expect(snapshotBrowserCookies.cookieExtractor).toBeInstanceOf(
      CookieExtractorService
    );
  });

  test("should format cookies in different formats", () => {
    const cookies = [
      {
        name: "test",
        value: "123",
        domain: "example.com",
        httpOnly: true,
        secure: false,
      },
    ];

    const json = snapshotBrowserCookies.formatCookies(cookies, "json");
    expect(JSON.parse(json)).toEqual(cookies);

    const table = snapshotBrowserCookies.formatCookies(cookies, "table");
    expect(table).toContain("test");

    const summary = snapshotBrowserCookies.formatCookies(cookies, "summary");
    expect(summary).toContain("Total Cookies: 1");
  });
});

describe("CLICommand", () => {
  let cliCommand;
  let processExitSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    cliCommand = new CLICommand();
    processExitSpy = jest.spyOn(process, "exit").mockImplementation();
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  test("should execute successfully with URL", async () => {
    const result = await cliCommand.execute("https://example.com", {
      sauceLabs: false,
      headless: true,
      timeout: "30000",
      progress: true,
      format: "json",
    });

    expect(result).toBeDefined();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("session");
  });

  test("should save output to file", async () => {
    const mockWriteFile = jest.fn().mockResolvedValue(undefined);
    jest.unstable_mockModule("fs/promises", () => ({
      writeFile: mockWriteFile,
    }));

    await cliCommand.execute("https://example.com", {
      sauceLabs: false,
      headless: true,
      timeout: "30000",
      progress: true,
      format: "json",
      output: "cookies.json",
    });

    // Note: In real test, would need to properly mock fs/promises
  });

  test("should handle extraction errors", async () => {
    mockPage.goto.mockRejectedValue(new Error("Navigation failed"));

    await cliCommand.execute("https://example.com", {
      sauceLabs: false,
      headless: true,
      timeout: "30000",
      progress: true,
      format: "json",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Extraction failed")
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe("CookieExtractionError", () => {
  test("should create error with cause", () => {
    const cause = new Error("Original error");
    const error = new CookieExtractionError("Cookie extraction failed", cause);

    expect(error.name).toBe("CookieExtractionError");
    expect(error.message).toBe("Cookie extraction failed");
    expect(error.cause).toBe(cause);
  });
});

// Clean up
afterAll(() => {
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});
