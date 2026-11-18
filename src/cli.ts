/**
 * CLI wiring: argv → validated options → HarnessConfig → launch.
 *
 * Each command does exactly three things: check its inputs against the
 * filesystem, build a config with the pure builders in config.ts, and hand it
 * to the runtime. All I/O goes through `Runtime`, so the whole surface can be
 * exercised in tests without spawning Claude.
 */
import * as path from "path";
import { randomUUID } from "crypto";
import { Command } from "commander";
import type { HarnessConfig } from "./types.js";
import { ALL_FOCUS_AREAS } from "./types.js";
import {
  buildBugfinderConfig,
  buildBuildConfig,
  buildDesignConfig,
  buildReviewConfig,
  buildSecurityConfig,
  parseFocusAreas,
  type SessionContext,
} from "./config.js";
import { DEFAULT_ITERATIONS } from "./protocol.js";
import type { Runtime } from "./runtime.js";

export interface CliDeps {
  runtime: Runtime;
  newSessionId?: () => string;
  now?: () => Date;
}

export function createProgram({ runtime: rt, newSessionId, now }: CliDeps): Command {
  const sessionId = newSessionId ?? (() => randomUUID().slice(0, 8));
  const clock = now ?? (() => new Date());

  const context = (): SessionContext => ({
    sessionId: sessionId(),
    startedAt: clock().toISOString(),
    harnessDir: rt.harnessDir,
    workspaceDir: rt.workspaceDir,
  });

  /** Resolve a --project path and exit(1) if it does not exist. */
  const requireDir = (p: string): string => {
    const dir = path.resolve(p);
    if (!rt.exists(dir)) {
      rt.error(`[gauntlet] Directory not found: ${dir}`);
      rt.exit(1);
    }
    return dir;
  };

  const start = (config: HarnessConfig, banner: string[]) => {
    rt.writeConfig(config);
    for (const line of banner) rt.log(line);
    rt.launch(config);
  };

  const program = new Command();
  program.name("gauntlet").description("Multi-agent code quality harness — powered by Claude Code");

  program
    .command("design <prompt>")
    .description("Iterative UI generation — loops until score ≥ 32/40")
    .option("--iterations <n>", "Max iterations", DEFAULT_ITERATIONS.design)
    .option("--existing <path>", "Existing HTML file to refine instead of starting fresh")
    .action((prompt: string, opts) => {
      rt.ensureWorkspace();

      let existingFile: string | undefined;
      if (opts.existing) {
        const src = path.resolve(opts.existing);
        if (!rt.exists(src)) {
          rt.error(`[gauntlet] File not found: ${src}`);
          rt.exit(1);
        }
        const dest = path.join(rt.workspaceDir, "existing.html");
        rt.copyFile(src, dest);
        existingFile = dest;
        rt.log(`[gauntlet] Loaded existing file: ${src}`);
      }

      const config = buildDesignConfig(context(), prompt, { iterations: opts.iterations, existingFile });
      start(config, [
        `\n[gauntlet] Design session ${config.sessionId}`,
        `[gauntlet] Prompt: "${prompt}"`,
        `[gauntlet] Target: 32/40 across ${config.maxIterations} iterations\n`,
      ]);
    });

  program
    .command("build <prompt>")
    .description("Full-stack app generation — Planner → Generator → Evaluator sprints")
    .option("--sprints <n>", "Max QA sprints", DEFAULT_ITERATIONS.build)
    .option("--project <path>", "Existing project to improve instead of building fresh")
    .action((prompt: string, opts) => {
      rt.ensureWorkspace();

      let targetDir: string | undefined;
      if (opts.project) {
        targetDir = requireDir(opts.project);
        rt.log(`[gauntlet] Targeting existing project: ${targetDir}`);
      }

      const config = buildBuildConfig(context(), prompt, { sprints: opts.sprints, targetDir });
      start(config, [
        `\n[gauntlet] Build session ${config.sessionId}`,
        `[gauntlet] Prompt: "${prompt}"`,
        `[gauntlet] App dir: ${targetDir ?? path.join(rt.workspaceDir, "app")}`,
        `[gauntlet] Up to ${config.maxIterations} QA sprints\n`,
      ]);
    });

  program
    .command("status")
    .description("Show current or last session state")
    .action(() => {
      if (!rt.exists(rt.configPath)) {
        rt.log("No active session found.");
        return;
      }
      const config: HarnessConfig = JSON.parse(rt.readFile(rt.configPath));
      rt.log(`\nSession : ${config.sessionId}`);
      rt.log(`Mode    : ${config.mode}`);
      rt.log(`Prompt  : "${config.prompt}"`);
      rt.log(`Started : ${config.startedAt}`);
      if (config.targetDir) rt.log(`Project : ${config.targetDir}`);
      if (config.existingFile) rt.log(`File    : ${config.existingFile}`);
      rt.log("");
      const statePath = path.join(rt.workspaceDir, "state.md");
      rt.log(rt.exists(statePath) ? rt.readFile(statePath) : "No state file yet.");
    });

  program
    .command("review")
    .description("Code review — Reviewer → Validator → Implementer → Re-check")
    .requiredOption("--project <path>", "Path to the project directory (required)")
    .option("--focus <area>", "Focus area: bug, performance, maintainability, style, all", "all")
    .action((opts) => {
      rt.ensureWorkspace();
      const targetDir = requireDir(opts.project);
      const config = buildReviewConfig(context(), { focus: opts.focus, targetDir });
      start(config, [
        `\n[gauntlet] Review session ${config.sessionId}`,
        `[gauntlet] Project: ${targetDir}`,
        `[gauntlet] Focus: ${opts.focus}\n`,
      ]);
    });

  program
    .command("security")
    .description("Security audit — Auditor → Validator → Implementer → Re-audit")
    .requiredOption("--project <path>", "Path to the project directory (required)")
    .option("--severity <level>", "Minimum severity to address: critical, high, all", "all")
    .action((opts) => {
      rt.ensureWorkspace();
      const targetDir = requireDir(opts.project);
      const config = buildSecurityConfig(context(), { severity: opts.severity, targetDir });
      start(config, [
        `\n[gauntlet] Security session ${config.sessionId}`,
        `[gauntlet] Project: ${targetDir}`,
        `[gauntlet] Severity filter: ${opts.severity}`,
        `[gauntlet] Target: risk score ≤ 3/10\n`,
      ]);
    });

  program
    .command("bugfinder")
    .description("Parallel QA — N agents test simultaneously, results aggregated into a scored report")
    .requiredOption("--project <path>", "Path to the project directory (required)")
    .option(
      "--focus <areas>",
      "Areas to test (comma-separated): ui,functional,auth,api,data,perf — default: all",
      "all",
    )
    .option("--url <url>", "App URL if already running (agents will try to start it if omitted)")
    .option("--browser <engine>", "Browser engine: chromium, firefox, webkit, all — default: chromium", "chromium")
    .action((opts) => {
      rt.ensureWorkspace();
      const targetDir = requireDir(opts.project);

      const focusAreas = parseFocusAreas(opts.focus);
      if (focusAreas.length === 0) {
        rt.error(`[gauntlet] No valid focus areas. Choose from: ${ALL_FOCUS_AREAS.join(", ")}`);
        rt.exit(1);
      }

      const config = buildBugfinderConfig(context(), {
        focus: opts.focus,
        targetDir,
        focusAreas,
        appUrl: opts.url,
        browser: opts.browser,
      });
      const browserLabel = opts.browser === "all" ? "chromium + firefox + webkit" : opts.browser;
      start(config, [
        `\n[gauntlet] Bug Finder session ${config.sessionId}`,
        `[gauntlet] Project: ${targetDir}`,
        ...(opts.url ? [`[gauntlet] App URL: ${opts.url}`] : []),
        `[gauntlet] Browser: ${browserLabel}`,
        `[gauntlet] Focus areas (${focusAreas.length} parallel agents): ${focusAreas.join(", ")}`,
        `[gauntlet] Target: quality score ≥ 8/10\n`,
      ]);
    });

  return program;
}
