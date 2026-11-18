import type { Command } from "commander";
import { createProgram } from "../src/cli.js";
import type { Runtime } from "../src/runtime.js";
import type { HarnessConfig } from "../src/types.js";

export class ExitError extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

/** In-memory Runtime: records everything, never touches disk or Claude. */
export function fakeRuntime(files: Record<string, string> = {}) {
  const state = {
    files: { ...files },
    written: [] as HarnessConfig[],
    launched: [] as HarnessConfig[],
    logs: [] as string[],
    errors: [] as string[],
    copies: [] as Array<[string, string]>,
    ensured: 0,
  };
  const rt: Runtime = {
    harnessDir: "/h",
    workspaceDir: "/h/workspace",
    configPath: "/h/workspace/gauntlet-config.json",
    ensureWorkspace: () => void state.ensured++,
    exists: (p) => p in state.files,
    copyFile: (src, dest) => void state.copies.push([src, dest]),
    readFile: (p) => {
      const v = state.files[p];
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v;
    },
    writeConfig: (c) => {
      state.written.push(c);
      state.files[rt.configPath] = JSON.stringify(c);
    },
    launch: (c) => void state.launched.push(c),
    log: (l) => void state.logs.push(l),
    error: (l) => void state.errors.push(l),
    exit: (code) => {
      throw new ExitError(code);
    },
  };
  return { rt, state };
}

/** Run the real CLI against a fake runtime. Commander errors throw instead of exiting. */
export async function runCli(argv: string[], files: Record<string, string> = {}) {
  const { rt, state } = fakeRuntime(files);
  const program = createProgram({
    runtime: rt,
    newSessionId: () => "sess0001",
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const silence = (cmd: Command) => {
    cmd.exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
    cmd.commands.forEach(silence);
  };
  silence(program);
  let error: unknown;
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (e) {
    error = e;
  }
  return { state, error };
}
