export type HarnessMode = "design" | "build" | "review" | "security" | "bugfinder";
export type AgentName = "orchestrator" | "planner" | "generator" | "evaluator";

export type BugFinderFocus = "ui" | "functional" | "auth" | "api" | "data" | "perf";
export const ALL_FOCUS_AREAS: BugFinderFocus[] = ["ui", "functional", "auth", "api", "data", "perf"];

export interface HarnessConfig {
  sessionId: string;
  mode: HarnessMode;
  prompt: string;
  startedAt: string;
  harnessDir: string;    // absolute path to gauntlet/
  workspaceDir: string;  // absolute path to gauntlet/workspace/
  maxIterations: number;
  targetScore: number;   // 32 for design (out of 40), 8 for build/bugfinder (out of 10), 3 for security (risk floor)
  // Optional: work inside an existing project
  targetDir?: string;    // build/review/security/bugfinder: absolute path to project
  existingFile?: string; // design mode: absolute path to existing HTML file (copied into workspace)
  // Bug finder mode
  focusAreas?: BugFinderFocus[];
  appUrl?: string;
  browser?: "chromium" | "firefox" | "webkit" | "all";
}

// ── Design mode ───────────────────────────────────────────────

export interface DesignScores {
  design_quality: number; // 0-10
  originality: number;    // 0-10
  craft: number;          // 0-10
  functionality: number;  // 0-10
  total: number;          // 0-40
}

export interface DesignScoreMessage {
  type: "DESIGN_SCORE";
  iteration: number;
  scores: DesignScores;
  feedback: string;
  plateau: boolean;
}

// ── Build mode ────────────────────────────────────────────────

export interface SpecMessage {
  type: "SPEC";
  title: string;
  description: string;
  features: string[];
  tech_stack: {
    frontend: string;
    backend: string;
    database: string;
  };
  entry_point: string;
  ai_opportunities: string[];
}

export interface SprintContractMessage {
  type: "SPRINT_CONTRACT";
  sprint: number;
  deliverables: string[];
  success_criteria: string[];
  files_to_create: string[];
}

export interface EvaluationMessage {
  type: "EVALUATION";
  sprint: number;
  passed: boolean;
  bugs: Array<{
    severity: "critical" | "major" | "minor";
    description: string;
    steps_to_reproduce: string;
  }>;
  score: number;
  summary: string;
}

export interface RevisionMessage {
  type: "REVISION";
  sprint: number;
  priority_fixes: string[];
  context_handoff: string;
}

// ── Review mode ───────────────────────────────────────────────

export interface ReviewFindingsMessage {
  type: "REVIEW_FINDINGS";
  issues: Array<{
    severity: "critical" | "major" | "minor";
    category: string;
    description: string;
    file: string;
    line?: number;
    proposed_fix: string;
  }>;
  total: number;
  summary: string;
}

// ── Security mode ─────────────────────────────────────────────

export interface SecurityAuditMessage {
  type: "SECURITY_AUDIT";
  vulnerabilities: Array<{
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    description: string;
    file: string;
    line?: number;
    cwe?: string;
    proposed_fix: string;
  }>;
  risk_score: number; // 0-10
  summary: string;
}

// ── Bug Finder mode ───────────────────────────────────────────

export interface BugReport {
  type: "BUG_REPORT";
  area: BugFinderFocus;
  bugs: Array<{
    id: string;
    severity: "critical" | "major" | "minor";
    title: string;
    description: string;
    steps_to_reproduce: string;
    expected: string;
    actual: string;
    console_logs?: string[];
    network_evidence?: string;
    file?: string;
    line?: number;
  }>;
  total: number;
  coverage_notes: string;
}

export interface BugAggregation {
  type: "BUG_AGGREGATION";
  areas_tested: BugFinderFocus[];
  total_bugs: number;
  critical: number;
  major: number;
  minor: number;
  bugs: Array<{
    id: string;
    severity: "critical" | "major" | "minor";
    area: BugFinderFocus;
    title: string;
    description: string;
    steps_to_reproduce: string;
    expected: string;
    actual: string;
    file?: string;
    line?: number;
    duplicate_of?: string;
  }>;
  quality_score: number; // 0-10
  summary: string;
}

// ── Shared (review + security) ────────────────────────────────

export interface ValidationMessage {
  type: "VALIDATION";
  approved: Array<{ index: number; reason: string }>;
  rejected: Array<{ index: number; reason: string }>;
  ready_to_implement: boolean;
  notes: string;
}

export interface ImplementationDoneMessage {
  type: "IMPLEMENTATION_DONE";
  files_modified: string[];
  changes_applied: number;
  skipped: number;
  summary: string;
}

export interface ReCheckMessage {
  type: "RECHECK";
  passed: boolean;
  remaining_issues: number;
  notes: string;
}
