import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBugfinderConfig, buildDesignConfig, parseFocusAreas, type SessionContext } from "../src/config.js";
import { ALL_FOCUS_AREAS } from "../src/types.js";

const ctx: SessionContext = { sessionId: "s", startedAt: "t", harnessDir: "/h", workspaceDir: "/h/w" };

describe("parseFocusAreas", () => {
  it("expands all", () => assert.deepEqual(parseFocusAreas("all"), ALL_FOCUS_AREAS));
  it("trims, keeps order, drops unknowns", () =>
    assert.deepEqual(parseFocusAreas(" perf ,ui,xyz"), ["perf", "ui"]));
  it("is case-sensitive like the original CLI", () => assert.deepEqual(parseFocusAreas("UI"), []));
  it("returns [] for empty input", () => assert.deepEqual(parseFocusAreas(""), []));
});

describe("config builders", () => {
  it("design keeps parseInt semantics for --iterations", () => {
    assert.equal(buildDesignConfig(ctx, "p", { iterations: "7abc" }).maxIterations, 7);
  });
  it("bugfinder carries focus areas, url and browser", () => {
    const cfg = buildBugfinderConfig(ctx, {
      focus: "ui",
      targetDir: "/p",
      focusAreas: ["ui"],
      appUrl: "http://x",
      browser: "webkit",
    });
    assert.equal(cfg.mode, "bugfinder");
    assert.deepEqual(cfg.focusAreas, ["ui"]);
    assert.equal(cfg.browser, "webkit");
    assert.equal(cfg.targetScore, 8);
  });
});
