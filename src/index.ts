#!/usr/bin/env node
/**
 * Gauntlet CLI entry point.
 *
 *   cli.ts       command wiring (argv → config → launch)
 *   config.ts    pure per-mode config builders
 *   protocol.ts  pipelines, stop conditions, Validator gate, aggregation rules
 *   runtime.ts   filesystem + Claude Code launch (the only side effects)
 */
import { createProgram } from "./cli.js";
import { createNodeRuntime } from "./runtime.js";

createProgram({ runtime: createNodeRuntime() }).parse();
