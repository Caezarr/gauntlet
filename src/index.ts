import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { Command } from "commander";
import type { HarnessConfig, BugFinderFocus } from "./types.js";
import { ALL_FOCUS_AREAS } from "./types.js";

// All paths are absolute — gauntlet works from anywhere
const HARNESS_DIR = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const WORKSPACE = path.join(HARNESS_DIR, "workspace");
const CONFIG_PATH = path.join(WORKSPACE, "gauntlet-config.json");

function ensureWorkspace() {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });
  const iterDir = path.join(WORKSPACE, "iterations");
  if (!fs.existsSync(iterDir)) fs.mkdirSync(iterDir);
}

function launchClaude(config: HarnessConfig) {
  const instruction =
    `Read ${CONFIG_PATH} then run the ${config.mode} harness ` +
    `as described in ${HARNESS_DIR}/CLAUDE.md. Session: ${config.sessionId}.`;
  execSync(`claude "${instruction}"`, {
    env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" },
    stdio: "inherit",
    cwd: HARNESS_DIR,
  });
}

const program = new Command();

program
  .name("gauntlet")
  .description("Multi-agent code quality harness — powered by Claude Code");

program
  .command("design <prompt>")
  .description("Iterative UI generation — loops until score ≥ 32/40")
  .option("--iterations <n>", "Max iterations", "15")
  .option("--existing <path>", "Existing HTML file to refine instead of starting fresh")
  .action((prompt: string, opts) => {
    ensureWorkspace();

    let existingFile: string | undefined;
    if (opts.existing) {
      const src = path.resolve(opts.existing);
      if (!fs.existsSync(src)) {
        console.error(`[gauntlet] File not found: ${src}`);
        process.exit(1);
      }
      const dest = path.join(WORKSPACE, "existing.html");
      fs.copyFileSync(src, dest);
      existingFile = dest;
      console.log(`[gauntlet] Loaded existing file: ${src}`);
    }

    const config: HarnessConfig = {
      sessionId: randomUUID().slice(0, 8),
      mode: "design",
      prompt,
      startedAt: new Date().toISOString(),
      harnessDir: HARNESS_DIR,
      workspaceDir: WORKSPACE,
      maxIterations: parseInt(opts.iterations, 10),
      targetScore: 32,
      existingFile,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n[gauntlet] Design session ${config.sessionId}`);
    console.log(`[gauntlet] Prompt: "${prompt}"`);
    console.log(`[gauntlet] Target: 32/40 across ${config.maxIterations} iterations\n`);
    launchClaude(config);
  });

program
  .command("build <prompt>")
  .description("Full-stack app generation — Planner → Generator → Evaluator sprints")
  .option("--sprints <n>", "Max QA sprints", "5")
  .option("--project <path>", "Existing project to improve instead of building fresh")
  .action((prompt: string, opts) => {
    ensureWorkspace();

    let targetDir: string | undefined;
    if (opts.project) {
      targetDir = path.resolve(opts.project);
      if (!fs.existsSync(targetDir)) {
        console.error(`[gauntlet] Directory not found: ${targetDir}`);
        process.exit(1);
      }
      console.log(`[gauntlet] Targeting existing project: ${targetDir}`);
    }

    const config: HarnessConfig = {
      sessionId: randomUUID().slice(0, 8),
      mode: "build",
      prompt,
      startedAt: new Date().toISOString(),
      harnessDir: HARNESS_DIR,
      workspaceDir: WORKSPACE,
      maxIterations: parseInt(opts.sprints, 10),
      targetScore: 8,
      targetDir,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n[gauntlet] Build session ${config.sessionId}`);
    console.log(`[gauntlet] Prompt: "${prompt}"`);
    console.log(`[gauntlet] App dir: ${targetDir ?? path.join(WORKSPACE, "app")}`);
    console.log(`[gauntlet] Up to ${config.maxIterations} QA sprints\n`);
    launchClaude(config);
  });

program
  .command("status")
  .description("Show current or last session state")
  .action(() => {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.log("No active session found.");
      return;
    }
    const config: HarnessConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    console.log(`\nSession : ${config.sessionId}`);
    console.log(`Mode    : ${config.mode}`);
    console.log(`Prompt  : "${config.prompt}"`);
    console.log(`Started : ${config.startedAt}`);
    if (config.targetDir) console.log(`Project : ${config.targetDir}`);
    if (config.existingFile) console.log(`File    : ${config.existingFile}`);
    console.log();
    const statePath = path.join(WORKSPACE, "state.md");
    if (fs.existsSync(statePath)) {
      console.log(fs.readFileSync(statePath, "utf8"));
    } else {
      console.log("No state file yet.");
    }
  });

program
  .command("review")
  .description("Code review — Reviewer → Validator → Implementer → Re-check")
  .requiredOption("--project <path>", "Path to the project directory (required)")
  .option("--focus <area>", "Focus area: bug, performance, maintainability, style, all", "all")
  .action((opts) => {
    ensureWorkspace();

    const targetDir = path.resolve(opts.project);
    if (!fs.existsSync(targetDir)) {
      console.error(`[gauntlet] Directory not found: ${targetDir}`);
      process.exit(1);
    }

    const config: HarnessConfig = {
      sessionId: randomUUID().slice(0, 8),
      mode: "review",
      prompt: opts.focus,
      startedAt: new Date().toISOString(),
      harnessDir: HARNESS_DIR,
      workspaceDir: WORKSPACE,
      maxIterations: 3,
      targetScore: 0,
      targetDir,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n[gauntlet] Review session ${config.sessionId}`);
    console.log(`[gauntlet] Project: ${targetDir}`);
    console.log(`[gauntlet] Focus: ${opts.focus}\n`);
    launchClaude(config);
  });

program
  .command("security")
  .description("Security audit — Auditor → Validator → Implementer → Re-audit")
  .requiredOption("--project <path>", "Path to the project directory (required)")
  .option("--severity <level>", "Minimum severity to address: critical, high, all", "all")
  .action((opts) => {
    ensureWorkspace();

    const targetDir = path.resolve(opts.project);
    if (!fs.existsSync(targetDir)) {
      console.error(`[gauntlet] Directory not found: ${targetDir}`);
      process.exit(1);
    }

    const config: HarnessConfig = {
      sessionId: randomUUID().slice(0, 8),
      mode: "security",
      prompt: opts.severity,
      startedAt: new Date().toISOString(),
      harnessDir: HARNESS_DIR,
      workspaceDir: WORKSPACE,
      maxIterations: 3,
      targetScore: 3,
      targetDir,
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n[gauntlet] Security session ${config.sessionId}`);
    console.log(`[gauntlet] Project: ${targetDir}`);
    console.log(`[gauntlet] Severity filter: ${opts.severity}`);
    console.log(`[gauntlet] Target: risk score ≤ 3/10\n`);
    launchClaude(config);
  });

program
  .command("bugfinder")
  .description("Parallel QA — N agents test simultaneously, results aggregated into a scored report")
  .requiredOption("--project <path>", "Path to the project directory (required)")
  .option(
    "--focus <areas>",
    "Areas to test (comma-separated): ui,functional,auth,api,data,perf — default: all",
    "all"
  )
  .option("--url <url>", "App URL if already running (agents will try to start it if omitted)")
  .option("--browser <engine>", "Browser engine: chromium, firefox, webkit, all — default: chromium", "chromium")
  .action((opts) => {
    ensureWorkspace();

    const targetDir = path.resolve(opts.project);
    if (!fs.existsSync(targetDir)) {
      console.error(`[gauntlet] Directory not found: ${targetDir}`);
      process.exit(1);
    }

    const focusAreas: BugFinderFocus[] =
      opts.focus === "all"
        ? ALL_FOCUS_AREAS
        : (opts.focus as string)
            .split(",")
            .map((s: string) => s.trim() as BugFinderFocus)
            .filter((f: BugFinderFocus) => ALL_FOCUS_AREAS.includes(f));

    if (focusAreas.length === 0) {
      console.error(`[gauntlet] No valid focus areas. Choose from: ${ALL_FOCUS_AREAS.join(", ")}`);
      process.exit(1);
    }

    const config: HarnessConfig = {
      sessionId: randomUUID().slice(0, 8),
      mode: "bugfinder",
      prompt: opts.focus,
      startedAt: new Date().toISOString(),
      harnessDir: HARNESS_DIR,
      workspaceDir: WORKSPACE,
      maxIterations: 1,
      targetScore: 8,
      targetDir,
      focusAreas,
      appUrl: opts.url,
      browser: opts.browser as "chromium" | "firefox" | "webkit" | "all",
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`\n[gauntlet] Bug Finder session ${config.sessionId}`);
    console.log(`[gauntlet] Project: ${targetDir}`);
    if (opts.url) console.log(`[gauntlet] App URL: ${opts.url}`);
    const browserLabel = opts.browser === "all" ? "chromium + firefox + webkit" : opts.browser;
    console.log(`[gauntlet] Browser: ${browserLabel}`);
    console.log(`[gauntlet] Focus areas (${focusAreas.length} parallel agents): ${focusAreas.join(", ")}`);
    console.log(`[gauntlet] Target: quality score ≥ 8/10\n`);
    launchClaude(config);
  });

program.parse();
