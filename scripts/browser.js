/**
 * Gauntlet — Browser Test Runner
 *
 * Usage (from bash):
 *   node /path/to/gauntlet/scripts/browser.js \
 *     --url http://localhost:3000 \
 *     --browser chromium \
 *     --script /tmp/my-test.js \
 *     --screenshots /tmp/screenshots \
 *     --output /tmp/results.json
 *
 * The --script file must export an async function:
 *   module.exports = async function(page, context, helpers) { ... }
 *
 * helpers = { screenshot, bug, pass, error, checkStatus }
 *
 * Screenshots are only taken when helpers.screenshot() is explicitly called —
 * never automatically. Call it only when you've confirmed a bug.
 *
 * Results written to --output as JSON:
 *   { bugs: [...], passed: [...], screenshots: [...], errors: [...] }
 */

import { chromium, firefox, webkit } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { createRequire } from "module";
import path from "path";

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const url = get("--url") || "http://localhost:3000";
const browserName = get("--browser") || "chromium";
const scriptPath = get("--script");
const screenshotsDir = get("--screenshots") || "/tmp/gauntlet-screenshots";
const outputPath = get("--output") || "/tmp/gauntlet-results.json";

if (!scriptPath) {
  console.error("ERROR: --script is required");
  process.exit(1);
}

const browserMap = { chromium, firefox, webkit };
const browserFactory = browserMap[browserName] || chromium;

const results = { bugs: [], passed: [], screenshots: [], errors: [] };
let screenshotIndex = 0;

if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

async function run() {
  const browser = await browserFactory.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Capture console errors automatically
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.bugs.push({
        severity: "major",
        title: `Console error: ${msg.text().slice(0, 100)}`,
        description: msg.text(),
        steps_to_reproduce: `Open browser console on ${page.url()}`,
        expected: "No console errors",
        actual: msg.text(),
      });
    }
  });

  // Capture uncaught JS exceptions
  page.on("pageerror", (err) => {
    results.bugs.push({
      severity: "critical",
      title: `Uncaught JS exception: ${err.message.slice(0, 80)}`,
      description: err.message,
      steps_to_reproduce: `Navigate to ${page.url()}`,
      expected: "No JS exceptions",
      actual: `${err.message}\n${err.stack || ""}`,
    });
  });

  const helpers = {
    /**
     * Take a screenshot — call only when you've confirmed a bug.
     * Never take screenshots just to document normal state.
     */
    screenshot: async (label) => {
      const filename = `${screenshotIndex++}-${label.replace(/\s+/g, "-")}.png`;
      const filepath = path.join(screenshotsDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      results.screenshots.push({ label, path: filepath });
      return filepath;
    },

    /**
     * Report a confirmed bug with full evidence.
     * @param {string} severity - "critical" | "major" | "minor"
     * @param {string} title - Short description
     * @param {string} description - Full evidence: console logs, response body, stack trace
     * @param {string} steps - Numbered reproduction steps
     * @param {string} expected - Expected behavior
     * @param {string} actual - Actual behavior with exact values
     */
    bug: (severity, title, description, steps, expected, actual) => {
      results.bugs.push({
        severity,
        title,
        description,
        steps_to_reproduce: steps || "",
        expected: expected || "",
        actual: actual || description,
        url: page.url(),
      });
    },

    /** Log a passing check */
    pass: (label) => {
      results.passed.push(label);
    },

    /** Log a test infrastructure error (not a bug in the app) */
    error: (msg) => {
      results.errors.push(msg);
    },

    /** Check HTTP status of a URL */
    checkStatus: async (targetUrl, expectedStatus = 200) => {
      const response = await page.request.get(targetUrl).catch(() => null);
      const status = response?.status() ?? 0;
      if (status !== expectedStatus) {
        const body = await response?.text().catch(() => "") ?? "";
        results.bugs.push({
          severity: status >= 500 ? "critical" : "major",
          title: `${targetUrl} returned ${status}, expected ${expectedStatus}`,
          description: `HTTP ${status} on GET ${targetUrl}\nBody: ${body.slice(0, 500)}`,
          steps_to_reproduce: `GET ${targetUrl}`,
          expected: `HTTP ${expectedStatus}`,
          actual: `HTTP ${status}: ${body.slice(0, 200)}`,
        });
      } else {
        results.passed.push(`${targetUrl} → ${status} ✓`);
      }
      return status;
    },
  };

  // Navigate to base URL
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (e) {
    results.errors.push(`Failed to load ${url}: ${e.message}`);
    await browser.close();
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    return;
  }

  // Load and run the test script
  const require = createRequire(import.meta.url);
  try {
    const testFn = require(path.resolve(scriptPath));
    const fn = typeof testFn === "function" ? testFn : testFn.default;
    await fn(page, context, helpers);
  } catch (e) {
    results.errors.push(`Test script error: ${e.message}\n${e.stack}`);
  }

  await browser.close();
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  results.errors.push(`Runner crashed: ${e.message}`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  process.exit(1);
});
