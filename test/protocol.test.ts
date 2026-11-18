import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PIPELINES,
  agentsForMode,
  buildStopReason,
  countCanonicalBugs,
  designStopReason,
  detectPlateau,
  qualityScoreBounds,
  securityTargetMet,
  validateAggregation,
  validateValidationMessage,
  validatorGate,
} from "../src/protocol.js";
import type { BugAggregation, ValidationMessage } from "../src/types.js";

const design = (total: number, plateau = false) => ({
  scores: { design_quality: 0, originality: 0, craft: 0, functionality: 0, total },
  plateau,
});

describe("pipeline wiring", () => {
  it("every mode starts with a producer and the Validator gates every write path", () => {
    for (const mode of ["review", "security"] as const) {
      const stages = PIPELINES[mode];
      const gateIdx = stages.findIndex((s) => s.agent === "validator" && s.phase === "validate");
      const implIdx = stages.findIndex((s) => s.agent === "implementer");
      assert.ok(gateIdx >= 0 && gateIdx < implIdx, `${mode}: validator must precede implementer`);
      assert.ok(stages.slice(implIdx).every((s) => s.gated), `${mode}: post-gate stages are gated`);
      assert.equal(stages.at(-1)!.emits[0], "RECHECK");
    }
  });

  it("no mode lets the implementer run in design/build/bugfinder", () => {
    for (const mode of ["design", "build", "bugfinder"] as const) {
      assert.ok(!agentsForMode(mode).includes("implementer"));
    }
  });

  it("bugfinder fans out testers in parallel, then a single aggregator", () => {
    const [testers, aggregator] = PIPELINES.bugfinder;
    assert.equal(testers!.parallel, true);
    assert.equal(aggregator!.agent, "aggregator");
    assert.ok(!aggregator!.parallel);
  });

  it("security re-audits with the auditor, review rechecks with the validator", () => {
    assert.equal(PIPELINES.security.at(-1)!.agent, "auditor");
    assert.equal(PIPELINES.review.at(-1)!.agent, "validator");
  });

  it("agentsForMode deduplicates roles used twice", () => {
    assert.deepEqual(agentsForMode("review"), ["reviewer", "validator", "implementer"]);
  });
});

describe("design stop conditions", () => {
  it("stops on target first", () => assert.equal(designStopReason(design(32, true), 15, 15), "target"));
  it("then on plateau", () => assert.equal(designStopReason(design(29, true), 2, 15), "plateau"));
  it("then on max iterations", () => assert.equal(designStopReason(design(20), 15, 15), "max"));
  it("otherwise continues", () => assert.equal(designStopReason(design(31), 3, 15), null));
});

describe("detectPlateau", () => {
  it("needs three iterations", () => assert.equal(detectPlateau([30, 30]), false));
  it("three totals within ±1 at ≥ 28", () => assert.equal(detectPlateau([20, 29, 30, 29]), true));
  it("spread of 2 is not a plateau", () => assert.equal(detectPlateau([28, 30, 29]), false));
  it("flat but below the floor is not a plateau", () => assert.equal(detectPlateau([27, 27, 27]), false));
});

describe("build stop conditions", () => {
  it("passed wins regardless of score", () => assert.equal(buildStopReason({ passed: true, score: 2 }, 1, 5), "target"));
  it("score ≥ 8 is a pass", () => assert.equal(buildStopReason({ passed: false, score: 8 }, 1, 5), "target"));
  it("max sprints", () => assert.equal(buildStopReason({ passed: false, score: 7 }, 5, 5), "max"));
  it("continues", () => assert.equal(buildStopReason({ passed: false, score: 7 }, 2, 5), null));
});

describe("security target", () => {
  it("risk ≤ 3 meets the target", () => {
    assert.equal(securityTargetMet(3), true);
    assert.equal(securityTargetMet(4), false);
  });
});

describe("Validator gate", () => {
  const msg = (approved: number[], rejected: number[], ready: boolean): ValidationMessage => ({
    type: "VALIDATION",
    approved: approved.map((index) => ({ index, reason: "ok" })),
    rejected: rejected.map((index) => ({ index, reason: "no" })),
    ready_to_implement: ready,
    notes: "",
  });

  it("closed when nothing is approved — implementer must not run", () => {
    assert.deepEqual(validatorGate(msg([], [1, 2], false)), { open: false, approvedIndices: [] });
  });

  it("open with exactly the approved indices", () => {
    assert.deepEqual(validatorGate(msg([1, 3], [2], true)), { open: true, approvedIndices: [1, 3] });
  });

  it("accepts a well-formed message", () => {
    assert.deepEqual(validateValidationMessage(msg([1, 3], [2], true), 3), []);
  });

  it("rejects ready_to_implement that contradicts the decisions", () => {
    assert.match(validateValidationMessage(msg([], [1], true), 1).join(), /ready_to_implement/);
  });

  it("rejects an index both approved and rejected", () => {
    assert.match(validateValidationMessage(msg([1], [1], true), 1).join(), /both approved and rejected/);
  });

  it("rejects indices outside the findings list", () => {
    assert.match(validateValidationMessage(msg([4], [], true), 3).join(), /outside findings/);
  });
});

describe("bugfinder aggregation", () => {
  const bug = (id: string, severity: "critical" | "major" | "minor", duplicate_of?: string) => ({
    id,
    severity,
    area: "api" as const,
    title: id,
    description: "",
    steps_to_reproduce: "",
    expected: "",
    actual: "",
    duplicate_of,
  });

  const report = (over: Partial<BugAggregation> = {}): BugAggregation => ({
    type: "BUG_AGGREGATION",
    areas_tested: ["api", "data"],
    bugs: [bug("api-1", "major"), bug("data-2", "major", "api-1"), bug("api-3", "minor")],
    total_bugs: 2,
    critical: 0,
    major: 1,
    minor: 1,
    quality_score: 7,
    summary: "",
    ...over,
  });

  it("counts canonical bugs only", () => {
    assert.deepEqual(countCanonicalBugs(report().bugs), { critical: 0, major: 1, minor: 1, total: 2 });
  });

  it("a consistent report has no errors", () => assert.deepEqual(validateAggregation(report()), []));

  it("flags duplicates counted in totals", () => {
    const errors = validateAggregation(report({ total_bugs: 3, major: 2 }));
    assert.ok(errors.some((e) => e.startsWith("total_bugs")));
    assert.ok(errors.some((e) => e.startsWith("major")));
  });

  it("flags a duplicate pointing at a non-canonical id", () => {
    const r = report({ bugs: [bug("api-1", "major"), bug("data-2", "major", "ghost")] , total_bugs: 1, minor: 0 });
    assert.ok(validateAggregation(r).some((e) => e.includes('"ghost"')));
  });

  it("flags bugs from areas that were not tested", () => {
    const r = report({ areas_tested: ["data"] });
    assert.ok(validateAggregation(r).some((e) => e.includes('area "api"')));
  });

  it("flags a quality score outside the rubric band", () => {
    assert.ok(validateAggregation(report({ quality_score: 9 })).some((e) => e.startsWith("quality_score")));
  });

  it("rubric bands", () => {
    assert.deepEqual(qualityScoreBounds({ critical: 0, major: 0, minor: 0 }), [10, 10]);
    assert.deepEqual(qualityScoreBounds({ critical: 0, major: 0, minor: 4 }), [8, 9]);
    assert.deepEqual(qualityScoreBounds({ critical: 0, major: 0, minor: 9 }), [8, 8]);
    assert.deepEqual(qualityScoreBounds({ critical: 0, major: 3, minor: 0 }), [6, 7]);
    assert.deepEqual(qualityScoreBounds({ critical: 0, major: 4, minor: 0 }), [4, 5]);
    assert.deepEqual(qualityScoreBounds({ critical: 1, major: 0, minor: 0 }), [0, 5]);
  });
});
