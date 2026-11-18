import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CommanderError } from "commander";
import { ExitError, runCli } from "./helpers.js";
import { ALL_FOCUS_AREAS } from "../src/types.js";
import { launchInstruction } from "../src/runtime.js";

const PROJECT = { "/proj": "" };

describe("CLI → config wiring (no Claude launch)", () => {
  it("design: defaults, target 32/40, launches once", async () => {
    const { state, error } = await runCli(["design", "a dashboard"]);
    assert.equal(error, undefined);
    assert.equal(state.ensured, 1);
    assert.equal(state.launched.length, 1);
    const cfg = state.launched[0]!;
    assert.deepEqual(cfg, {
      sessionId: "sess0001",
      mode: "design",
      prompt: "a dashboard",
      startedAt: "2026-01-01T00:00:00.000Z",
      harnessDir: "/h",
      workspaceDir: "/h/workspace",
      targetScore: 32,
      maxIterations: 15,
      existingFile: undefined,
    });
    assert.deepEqual(state.written, state.launched, "config is written before launch and is the same object");
  });

  it("design --existing copies the file into the workspace", async () => {
    const { state } = await runCli(["design", "x", "--existing", "/in/page.html", "--iterations", "4"], {
      "/in/page.html": "<html>",
    });
    assert.deepEqual(state.copies, [["/in/page.html", "/h/workspace/existing.html"]]);
    assert.equal(state.launched[0]!.existingFile, "/h/workspace/existing.html");
    assert.equal(state.launched[0]!.maxIterations, 4);
  });

  it("design --existing with a missing file exits 1 and never launches", async () => {
    const { state, error } = await runCli(["design", "x", "--existing", "/nope.html"]);
    assert.ok(error instanceof ExitError && error.code === 1);
    assert.equal(state.launched.length, 0);
    assert.match(state.errors[0]!, /File not found: \/nope\.html/);
  });

  it("build: sprints and optional project", async () => {
    const { state } = await runCli(["build", "todo app", "--sprints", "3", "--project", "/proj"], PROJECT);
    const cfg = state.launched[0]!;
    assert.equal(cfg.mode, "build");
    assert.equal(cfg.maxIterations, 3);
    assert.equal(cfg.targetScore, 8);
    assert.equal(cfg.targetDir, "/proj");
  });

  it("build without --project targets workspace/app", async () => {
    const { state } = await runCli(["build", "todo app"]);
    assert.equal(state.launched[0]!.targetDir, undefined);
    assert.ok(state.logs.some((l) => l.includes("App dir: /h/workspace/app")));
  });

  it("review: fixed 3 iterations, focus becomes the prompt", async () => {
    const { state } = await runCli(["review", "--project", "/proj", "--focus", "performance"], PROJECT);
    const cfg = state.launched[0]!;
    assert.equal(cfg.mode, "review");
    assert.equal(cfg.prompt, "performance");
    assert.equal(cfg.maxIterations, 3);
    assert.equal(cfg.targetScore, 0);
  });

  it("security: severity becomes the prompt, risk target 3", async () => {
    const { state } = await runCli(["security", "--project", "/proj", "--severity", "critical"], PROJECT);
    const cfg = state.launched[0]!;
    assert.equal(cfg.mode, "security");
    assert.equal(cfg.prompt, "critical");
    assert.equal(cfg.targetScore, 3);
  });

  for (const mode of ["review", "security", "bugfinder"]) {
    it(`${mode}: --project is required`, async () => {
      const { state, error } = await runCli([mode]);
      assert.ok(error instanceof CommanderError);
      assert.equal(error.code, "commander.missingMandatoryOptionValue");
      assert.equal(state.launched.length, 0);
    });

    it(`${mode}: missing project directory exits 1`, async () => {
      const { state, error } = await runCli([mode, "--project", "/missing"]);
      assert.ok(error instanceof ExitError && error.code === 1);
      assert.match(state.errors[0]!, /Directory not found: \/missing/);
      assert.equal(state.launched.length, 0);
    });
  }

  it("bugfinder: all areas by default, chromium, one parallel agent per area", async () => {
    const { state } = await runCli(["bugfinder", "--project", "/proj"], PROJECT);
    const cfg = state.launched[0]!;
    assert.deepEqual(cfg.focusAreas, ALL_FOCUS_AREAS);
    assert.equal(cfg.browser, "chromium");
    assert.equal(cfg.maxIterations, 1);
    assert.equal(cfg.appUrl, undefined);
    assert.ok(state.logs.some((l) => l.includes("(6 parallel agents)")));
  });

  it("bugfinder: focus subset, url and browser=all", async () => {
    const { state } = await runCli(
      ["bugfinder", "--project", "/proj", "--focus", "auth, api,bogus", "--url", "http://localhost:3000", "--browser", "all"],
      PROJECT,
    );
    const cfg = state.launched[0]!;
    assert.deepEqual(cfg.focusAreas, ["auth", "api"]);
    assert.equal(cfg.prompt, "auth, api,bogus", "raw --focus is kept as the prompt");
    assert.equal(cfg.appUrl, "http://localhost:3000");
    assert.ok(state.logs.some((l) => l.includes("chromium + firefox + webkit")));
  });

  it("bugfinder: no valid focus area exits 1", async () => {
    const { state, error } = await runCli(["bugfinder", "--project", "/proj", "--focus", "nope"], PROJECT);
    assert.ok(error instanceof ExitError && error.code === 1);
    assert.equal(state.launched.length, 0);
  });

  it("status: no session", async () => {
    const { state } = await runCli(["status"]);
    assert.deepEqual(state.logs, ["No active session found."]);
  });

  it("status: prints config and state.md without launching", async () => {
    const { state: first } = await runCli(["review", "--project", "/proj"], PROJECT);
    const cfgJson = first.files["/h/workspace/gauntlet-config.json"]!;
    const { state } = await runCli(["status"], {
      "/h/workspace/gauntlet-config.json": cfgJson,
      "/h/workspace/state.md": "# Harness State",
    });
    assert.equal(state.launched.length, 0);
    assert.ok(state.logs.includes("Mode    : review"));
    assert.ok(state.logs.includes("Project : /proj"));
    assert.equal(state.logs.at(-1), "# Harness State");
  });
});

describe("launch instruction", () => {
  it("points the orchestrator at the config and CLAUDE.md", () => {
    const text = launchInstruction(
      { sessionId: "abc", mode: "security" } as never,
      "/h/workspace/gauntlet-config.json",
      "/h",
    );
    assert.equal(
      text,
      "Read /h/workspace/gauntlet-config.json then run the security harness as described in /h/CLAUDE.md. Session: abc.",
    );
  });
});
