/**
 * Executable form of the orchestration protocol in CLAUDE.md.
 *
 * The Lead Orchestrator is a Claude Code session that follows CLAUDE.md, so
 * the protocol itself is prose. This module states the same rules as data and
 * pure functions — pipeline per mode, stop conditions, the Validator gate and
 * the aggregation invariants — so they can be unit-tested and so
 * `test/protocol-sync.test.ts` can fail CI when CLAUDE.md and the agents drift
 * apart from them.
 *
 * Nothing in here calls Claude, the network or the filesystem.
 */
import type {
  AgentRole,
  BugAggregation,
  DesignScoreMessage,
  EvaluationMessage,
  HarnessMode,
  MessageType,
  ValidationMessage,
} from "./types.js";

// ── Targets ─────────────────────────────────────────────────────

/** `targetScore` written to the config for each mode. */
export const TARGET_SCORES: Record<HarnessMode, number> = {
  design: 32, // out of 40, higher is better
  build: 8, // out of 10, higher is better
  review: 0, // no score — the pipeline ends on RECHECK
  security: 3, // risk score out of 10, LOWER is better
  bugfinder: 8, // quality score out of 10, higher is better
};

/** Fixed iteration caps for modes that do not expose a CLI flag. */
export const MAX_ITERATIONS = { review: 3, security: 3, bugfinder: 1 } as const;

/** CLI defaults for modes whose cap is user-tunable. */
export const DEFAULT_ITERATIONS = { design: "15", build: "5" } as const;

// ── Pipelines ───────────────────────────────────────────────────

export interface Stage {
  /** Teammate role; maps to `agents/<role>.md`. */
  agent: AgentRole;
  /** Message type(s) the stage sends back to the orchestrator. */
  emits: MessageType[];
  /** Optional phase passed to the agent (validator / auditor run twice). */
  phase?: "validate" | "recheck";
  /** Fan-out: one instance per focus area, all spawned at once. */
  parallel?: boolean;
  /** Stage is repeated until a stop condition fires. */
  loop?: boolean;
  /** Stage only runs if the Validator gate opened. */
  gated?: boolean;
}

export const PIPELINES: Record<HarnessMode, Stage[]> = {
  design: [
    { agent: "generator", emits: ["GENERATOR_DONE"], loop: true },
    { agent: "evaluator", emits: ["DESIGN_SCORE"], loop: true },
  ],
  build: [
    { agent: "planner", emits: ["SPEC"] },
    { agent: "generator", emits: ["SPRINT_CONTRACT", "GENERATOR_DONE"], loop: true },
    { agent: "evaluator", emits: ["EVALUATION"], loop: true },
  ],
  review: [
    { agent: "reviewer", emits: ["REVIEW_FINDINGS"] },
    { agent: "validator", emits: ["VALIDATION"], phase: "validate" },
    { agent: "implementer", emits: ["IMPLEMENTATION_DONE"], gated: true },
    { agent: "validator", emits: ["RECHECK"], phase: "recheck", gated: true },
  ],
  security: [
    { agent: "auditor", emits: ["SECURITY_AUDIT"] },
    { agent: "validator", emits: ["VALIDATION"], phase: "validate" },
    { agent: "implementer", emits: ["IMPLEMENTATION_DONE"], gated: true },
    { agent: "auditor", emits: ["RECHECK"], phase: "recheck", gated: true },
  ],
  bugfinder: [
    { agent: "tester", emits: ["BUG_REPORT"], parallel: true },
    { agent: "aggregator", emits: ["BUG_AGGREGATION"] },
  ],
};

/** Every agent definition a mode needs on disk. */
export function agentsForMode(mode: HarnessMode): AgentRole[] {
  return [...new Set(PIPELINES[mode].map((s) => s.agent))];
}

// ── Stop conditions ─────────────────────────────────────────────

export type StopReason = "target" | "plateau" | "max" | null;

/** Design loop: stop at ≥ 32/40, on plateau, or at the iteration cap. */
export function designStopReason(
  msg: Pick<DesignScoreMessage, "scores" | "plateau">,
  iteration: number,
  maxIterations: number,
): StopReason {
  if (msg.scores.total >= TARGET_SCORES.design) return "target";
  if (msg.plateau) return "plateau";
  if (iteration >= maxIterations) return "max";
  return null;
}

/**
 * Plateau rule the Evaluator applies: the last 3 totals are within ±1 of each
 * other AND the latest total is ≥ 28.
 */
export const PLATEAU_FLOOR = 28;
export function detectPlateau(totals: number[]): boolean {
  if (totals.length < 3) return false;
  const last3 = totals.slice(-3);
  const spread = Math.max(...last3) - Math.min(...last3);
  return spread <= 1 && last3[2]! >= PLATEAU_FLOOR;
}

/** Build sprints: stop when QA passes or scores ≥ 8, or at the sprint cap. */
export function buildStopReason(
  msg: Pick<EvaluationMessage, "passed" | "score">,
  sprint: number,
  maxSprints: number,
): StopReason {
  if (msg.passed || msg.score >= TARGET_SCORES.build) return "target";
  if (sprint >= maxSprints) return "max";
  return null;
}

/** Security mode succeeds when the post-patch risk score is ≤ 3/10. */
export function securityTargetMet(riskScore: number): boolean {
  return riskScore <= TARGET_SCORES.security;
}

// ── Validator gate ──────────────────────────────────────────────

/**
 * The gate between proposal and implementation (review + security modes).
 * The Implementer may only run when at least one fix was approved, and it may
 * only touch the approved indices.
 */
export function validatorGate(msg: Pick<ValidationMessage, "approved" | "rejected">): {
  open: boolean;
  approvedIndices: number[];
} {
  const approvedIndices = msg.approved.map((a) => a.index);
  return { open: approvedIndices.length > 0, approvedIndices };
}

/** Structural checks on a VALIDATION message before the orchestrator trusts it. */
export function validateValidationMessage(
  msg: ValidationMessage,
  findingsCount: number,
): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const { index } of [...msg.approved, ...msg.rejected]) {
    if (!Number.isInteger(index) || index < 1 || index > findingsCount) {
      errors.push(`index ${index} is outside findings 1..${findingsCount}`);
    }
    if (seen.has(index)) errors.push(`index ${index} is both approved and rejected (or listed twice)`);
    seen.add(index);
  }
  if (msg.ready_to_implement !== validatorGate(msg).open) {
    errors.push("ready_to_implement must be true iff at least one fix is approved");
  }
  return errors;
}

// ── Bugfinder aggregation ───────────────────────────────────────

export type Severity = "critical" | "major" | "minor";

export interface SeverityCounts {
  critical: number;
  major: number;
  minor: number;
  total: number;
}

/** Count canonical bugs only — entries with `duplicate_of` are excluded. */
export function countCanonicalBugs(bugs: BugAggregation["bugs"]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, major: 0, minor: 0, total: 0 };
  for (const bug of bugs) {
    if (bug.duplicate_of) continue;
    counts[bug.severity] += 1;
    counts.total += 1;
  }
  return counts;
}

/**
 * Allowed quality-score range for a set of counts, per the rubric in
 * agents/aggregator.md. The rubric leaves judgment inside each band; this
 * returns the band so the hard edges can be enforced.
 */
export function qualityScoreBounds(c: Omit<SeverityCounts, "total">): [number, number] {
  if (c.critical === 0 && c.major === 0 && c.minor === 0) return [10, 10];
  if (c.critical === 0 && c.major === 0) return c.minor < 5 ? [8, 9] : [8, 8];
  if (c.critical === 0) return c.major <= 3 ? [6, 7] : [4, 5];
  return [0, 5];
}

/** Invariants the orchestrator checks on a BUG_AGGREGATION message. */
export function validateAggregation(msg: BugAggregation): string[] {
  const errors: string[] = [];
  const counts = countCanonicalBugs(msg.bugs);
  for (const key of ["critical", "major", "minor"] as const) {
    if (msg[key] !== counts[key]) errors.push(`${key}: reported ${msg[key]}, counted ${counts[key]}`);
  }
  if (msg.total_bugs !== counts.total) {
    errors.push(`total_bugs: reported ${msg.total_bugs}, counted ${counts.total}`);
  }

  const canonicalIds = new Set(msg.bugs.filter((b) => !b.duplicate_of).map((b) => b.id));
  for (const bug of msg.bugs) {
    if (bug.duplicate_of && !canonicalIds.has(bug.duplicate_of)) {
      errors.push(`${bug.id}: duplicate_of "${bug.duplicate_of}" is not a canonical bug`);
    }
    if (!msg.areas_tested.includes(bug.area)) {
      errors.push(`${bug.id}: area "${bug.area}" was not tested`);
    }
  }

  const [lo, hi] = qualityScoreBounds(counts);
  if (msg.quality_score < lo || msg.quality_score > hi) {
    errors.push(`quality_score ${msg.quality_score} outside rubric band [${lo}, ${hi}]`);
  }
  return errors;
}
