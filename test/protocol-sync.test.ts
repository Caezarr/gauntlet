/**
 * Drift guard: the orchestration protocol is prose (CLAUDE.md + agents/*.md)
 * executed by Claude. These tests pin it to src/protocol.ts so a renamed agent,
 * a changed threshold or a dropped message type fails CI.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { PIPELINES, agentsForMode } from "../src/protocol.js";
import { ALL_MESSAGE_TYPES, type HarnessMode } from "../src/types.js";
import { lintDefinitions, loadDefinitions, parseFrontmatter } from "../src/definitions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const protocol = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");

/** Split CLAUDE.md into its "## <MODE> MODE" sections. */
function modeSections(): Record<HarnessMode, string> {
  const out = {} as Record<HarnessMode, string>;
  const parts = protocol.split(/^## ([A-Z]+) MODE\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    out[parts[i]!.toLowerCase() as HarnessMode] = parts[i + 1]!;
  }
  return out;
}
const sections = modeSections();

describe("CLAUDE.md ↔ protocol.ts", () => {
  it("documents every mode", () => {
    assert.deepEqual(Object.keys(sections).sort(), Object.keys(PIPELINES).sort());
  });

  for (const mode of Object.keys(PIPELINES) as HarnessMode[]) {
    it(`${mode}: spawns exactly the agents in its pipeline`, () => {
      const referenced = [...sections[mode].matchAll(/agents\/([a-z-]+)\.md/g)].map((m) => m[1]);
      assert.deepEqual([...new Set(referenced)].sort(), [...agentsForMode(mode)].sort());
    });

    it(`${mode}: mentions every message type its pipeline emits`, () => {
      for (const stage of PIPELINES[mode]) {
        for (const type of stage.emits) assert.ok(sections[mode].includes(type), `${type} missing`);
      }
    });
  }

  it("stop thresholds match TARGET_SCORES", () => {
    assert.match(sections.design, /total >= 32/);
    assert.match(sections.build, /score >= 8/);
    assert.match(sections.security, /risk score ≤ 3\/10/);
  });

  it("the gate is enforced in review and security: no approval → no implementer", () => {
    for (const mode of ["review", "security"] as const) {
      assert.match(sections[mode], /ready_to_implement == false.*DONE/);
    }
  });

  it("bugfinder spawns all testers before waiting", () => {
    assert.match(sections.bugfinder, /SPAWN ALL SIMULTANEOUSLY/);
    assert.match(sections.bugfinder, /Wait until ALL expected testers have reported/);
  });

  it("every agent file referenced in CLAUDE.md exists", () => {
    for (const [, name] of protocol.matchAll(/agents\/([a-z-]+)\.md/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, "agents", `${name}.md`)), `agents/${name}.md`);
    }
  });
});

describe("agents/*.md ↔ message contracts", () => {
  it("each agent's output contract shows every message type it declares", () => {
    for (const def of loadDefinitions(ROOT).filter((d) => d.kind === "agent")) {
      for (const type of def.frontmatter!.emits as string[]) {
        assert.ok(def.body.includes(`"${type}"`), `${def.file} never shows "type": "${type}"`);
      }
    }
  });

  it("types.ts declares every message type the protocol uses", () => {
    const used = new Set(Object.values(PIPELINES).flatMap((s) => s.flatMap((x) => x.emits)));
    for (const t of used) assert.ok(ALL_MESSAGE_TYPES.includes(t));
  });
});

describe("definition lint", () => {
  it("the repo's agents and skills are valid", () => {
    assert.deepEqual(lintDefinitions(loadDefinitions(ROOT)), []);
  });

  it("reports missing fields, wrong name and unknown types", () => {
    const bad = parseFrontmatter("---\nname: other\nkind: agent\nmodes: [review]\nemits: [NOPE]\n---\n# X\n");
    const errors = lintDefinitions([{ file: "agents/reviewer.md", kind: "agent", ...bad }]);
    const joined = errors.join("\n");
    assert.match(joined, /missing required field "description"/);
    assert.match(joined, /name "other" must match/);
    assert.match(joined, /unknown message type "NOPE"/);
    assert.match(joined, /expects it to emit REVIEW_FINDINGS/);
  });

  it("reports a file without frontmatter", () => {
    const errors = lintDefinitions([{ file: "skills/x.md", kind: "skill", ...parseFrontmatter("# X\n") }]);
    assert.ok(errors.some((e) => e.includes("missing frontmatter")));
  });

  it("parses quoted strings and inline lists", () => {
    const { frontmatter } = parseFrontmatter('---\ndescription: "a: b"\nmodes: [x, y]\n---\nbody');
    assert.deepEqual(frontmatter, { description: "a: b", modes: ["x", "y"] });
  });
});
