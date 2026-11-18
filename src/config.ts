/**
 * Pure config builders — one per harness mode.
 *
 * Everything here is side-effect free: the CLI layer resolves paths, checks
 * the filesystem and generates the session id, then hands plain values to
 * these functions. That keeps the mode wiring unit-testable without touching
 * the disk or launching Claude.
 */
import type { BrowserEngine, BugFinderFocus, HarnessConfig, HarnessMode } from "./types.js";
import { ALL_FOCUS_AREAS } from "./types.js";
import { MAX_ITERATIONS, TARGET_SCORES } from "./protocol.js";

/** Values every config shares, supplied by the caller (CLI or test). */
export interface SessionContext {
  sessionId: string;
  startedAt: string;
  harnessDir: string;
  workspaceDir: string;
}

function base(ctx: SessionContext, mode: HarnessMode, prompt: string) {
  return {
    sessionId: ctx.sessionId,
    mode,
    prompt,
    startedAt: ctx.startedAt,
    harnessDir: ctx.harnessDir,
    workspaceDir: ctx.workspaceDir,
    targetScore: TARGET_SCORES[mode],
  };
}

/** Parse a CLI integer option, keeping the historical `parseInt(x, 10)` semantics. */
export function parseCount(value: string): number {
  return parseInt(value, 10);
}

export function buildDesignConfig(
  ctx: SessionContext,
  prompt: string,
  opts: { iterations: string; existingFile?: string },
): HarnessConfig {
  return {
    ...base(ctx, "design", prompt),
    maxIterations: parseCount(opts.iterations),
    existingFile: opts.existingFile,
  };
}

export function buildBuildConfig(
  ctx: SessionContext,
  prompt: string,
  opts: { sprints: string; targetDir?: string },
): HarnessConfig {
  return {
    ...base(ctx, "build", prompt),
    maxIterations: parseCount(opts.sprints),
    targetDir: opts.targetDir,
  };
}

export function buildReviewConfig(
  ctx: SessionContext,
  opts: { focus: string; targetDir: string },
): HarnessConfig {
  return {
    ...base(ctx, "review", opts.focus),
    maxIterations: MAX_ITERATIONS.review,
    targetDir: opts.targetDir,
  };
}

export function buildSecurityConfig(
  ctx: SessionContext,
  opts: { severity: string; targetDir: string },
): HarnessConfig {
  return {
    ...base(ctx, "security", opts.severity),
    maxIterations: MAX_ITERATIONS.security,
    targetDir: opts.targetDir,
  };
}

export function buildBugfinderConfig(
  ctx: SessionContext,
  opts: {
    focus: string;
    targetDir: string;
    focusAreas: BugFinderFocus[];
    appUrl?: string;
    browser: string;
  },
): HarnessConfig {
  return {
    ...base(ctx, "bugfinder", opts.focus),
    maxIterations: MAX_ITERATIONS.bugfinder,
    targetDir: opts.targetDir,
    focusAreas: opts.focusAreas,
    appUrl: opts.appUrl,
    browser: opts.browser as BrowserEngine,
  };
}

/**
 * Turn the `--focus` option into a list of bugfinder areas.
 * `"all"` expands to every area; unknown names are dropped silently and the
 * caller rejects an empty result.
 */
export function parseFocusAreas(focus: string): BugFinderFocus[] {
  if (focus === "all") return ALL_FOCUS_AREAS;
  return focus
    .split(",")
    .map((s) => s.trim() as BugFinderFocus)
    .filter((f) => ALL_FOCUS_AREAS.includes(f));
}
