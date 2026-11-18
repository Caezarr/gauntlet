/**
 * Lint for the markdown definitions under agents/ and skills/.
 *
 * Each file starts with a small frontmatter block. This module parses it (a
 * deliberately tiny subset of YAML: `key: value` and `key: [a, b]`) and checks
 * it against the protocol, so a renamed agent, a missing field or a message
 * type that does not exist fails CI instead of failing mid-run.
 *
 * Run: npm run lint:definitions
 */
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { ALL_AGENT_ROLES, ALL_MESSAGE_TYPES, type HarnessMode } from "./types.js";
import { PIPELINES } from "./protocol.js";

export type Frontmatter = Record<string, string | string[]>;

export interface Definition {
  file: string; // repo-relative path
  kind: "agent" | "skill";
  frontmatter: Frontmatter | null;
  body: string;
}

const MODES = Object.keys(PIPELINES) as HarnessMode[];

/** Parse a leading `---` block. Returns null when the file has none. */
export function parseFrontmatter(source: string): { frontmatter: Frontmatter | null; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) return { frontmatter: null, body: source };
  const frontmatter: Frontmatter = {};
  for (const raw of match[1]!.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) throw new Error(`malformed frontmatter line: "${raw}"`);
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      continue;
    }
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    frontmatter[key] = value;
  }
  return { frontmatter, body: source.slice(match[0].length) };
}

export function loadDefinitions(root: string): Definition[] {
  const defs: Definition[] = [];
  for (const [dir, kind] of [
    ["agents", "agent"],
    ["skills", "skill"],
  ] as const) {
    const abs = path.join(root, dir);
    for (const name of fs.readdirSync(abs).filter((f) => f.endsWith(".md")).sort()) {
      const { frontmatter, body } = parseFrontmatter(fs.readFileSync(path.join(abs, name), "utf8"));
      defs.push({ file: `${dir}/${name}`, kind, frontmatter, body });
    }
  }
  return defs;
}

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

/** Return human-readable problems; empty means every definition is valid. */
export function lintDefinitions(defs: Definition[]): string[] {
  const errors: string[] = [];
  const agentNames = new Set<string>();

  for (const def of defs) {
    const err = (msg: string) => errors.push(`${def.file}: ${msg}`);
    const fm = def.frontmatter;
    if (!fm) {
      err("missing frontmatter block");
      continue;
    }
    const stem = path.basename(def.file, ".md");
    const required = def.kind === "agent" ? ["name", "kind", "description", "modes", "emits"] : ["name", "kind", "description", "mode"];
    for (const key of required) if (!(key in fm) || asList(fm[key]).length === 0) err(`missing required field "${key}"`);

    if (fm.name !== stem) err(`name "${fm.name}" must match file name "${stem}"`);
    if (!/^[a-z][a-z0-9-]*$/.test(stem)) err("file name must be lowercase kebab-case");
    if (fm.kind !== def.kind) err(`kind must be "${def.kind}"`);
    if (typeof fm.description === "string" && fm.description.length > 200) err("description longer than 200 chars");
    if (!/^#\s+\S/m.test(def.body)) err("body must contain a top-level heading");

    if (def.kind === "agent") {
      agentNames.add(stem);
      if (!(ALL_AGENT_ROLES as string[]).includes(stem)) err(`"${stem}" is not a known AgentRole`);
      for (const mode of asList(fm.modes)) {
        if (!(MODES as string[]).includes(mode)) err(`unknown mode "${mode}"`);
        else if (!PIPELINES[mode as HarnessMode].some((s) => s.agent === stem)) {
          err(`declares mode "${mode}" but the ${mode} pipeline never spawns it`);
        }
      }
      for (const type of asList(fm.emits)) {
        if (!(ALL_MESSAGE_TYPES as string[]).includes(type)) err(`emits unknown message type "${type}"`);
      }
      // Every message type the protocol expects from this agent must be declared.
      for (const mode of MODES) {
        for (const stage of PIPELINES[mode].filter((s) => s.agent === stem)) {
          for (const type of stage.emits) {
            if (!asList(fm.emits).includes(type)) err(`${mode} pipeline expects it to emit ${type}`);
          }
        }
      }
    } else if (!(MODES as string[]).includes(fm.mode as string)) {
      err(`unknown mode "${fm.mode}"`);
    }
  }

  for (const role of ALL_AGENT_ROLES) {
    if (!agentNames.has(role)) errors.push(`agents/${role}.md: missing definition for AgentRole "${role}"`);
  }
  return errors;
}

// CLI: `tsx src/definitions.ts [root]`
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = path.resolve(process.argv[2] ?? ".");
  const defs = loadDefinitions(root);
  const errors = lintDefinitions(defs);
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${defs.length} agent/skill definitions valid`);
}
