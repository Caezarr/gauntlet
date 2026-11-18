/**
 * Side-effecting runtime: workspace on disk and the Claude Code launch.
 * Kept apart from the CLI wiring so tests can swap it for an in-memory fake.
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { HarnessConfig } from "./types.js";

export interface Runtime {
  harnessDir: string;
  workspaceDir: string;
  configPath: string;
  /** Create workspace/ and workspace/iterations/ if missing. */
  ensureWorkspace(): void;
  exists(p: string): boolean;
  copyFile(src: string, dest: string): void;
  readFile(p: string): string;
  writeConfig(config: HarnessConfig): void;
  /** Hand control to the Lead Orchestrator (a Claude Code session). */
  launch(config: HarnessConfig): void;
  log(line: string): void;
  error(line: string): void;
  /** Exit the process; tests replace this with a throwing stub. */
  exit(code: number): never;
}

/** gauntlet/ — resolved from this file so the CLI works from any cwd. */
export const HARNESS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createNodeRuntime(harnessDir: string = HARNESS_DIR): Runtime {
  const workspaceDir = path.join(harnessDir, "workspace");
  const configPath = path.join(workspaceDir, "gauntlet-config.json");
  return {
    harnessDir,
    workspaceDir,
    configPath,
    ensureWorkspace() {
      fs.mkdirSync(path.join(workspaceDir, "iterations"), { recursive: true });
    },
    exists: (p) => fs.existsSync(p),
    copyFile: (src, dest) => fs.copyFileSync(src, dest),
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeConfig(config) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    },
    launch(config) {
      execSync(`claude "${launchInstruction(config, configPath, harnessDir)}"`, {
        env: { ...process.env, CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" },
        stdio: "inherit",
        cwd: harnessDir,
      });
    },
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    exit: (code) => process.exit(code),
  };
}

/** The single instruction the orchestrator session starts from. */
export function launchInstruction(config: HarnessConfig, configPath: string, harnessDir: string): string {
  return (
    `Read ${configPath} then run the ${config.mode} harness ` +
    `as described in ${harnessDir}/CLAUDE.md. Session: ${config.sessionId}.`
  );
}
