# Gauntlet Index

A comprehensive listing of all agents and skills in the harness system.

## Agents

Agents are specialized AI teammates spawned by the orchestrator to perform specific roles in the workflow.

| File | Purpose | Path |
|------|---------|------|
| **aggregator.md** | Receives all individual bug reports from parallel testers and produces a single, clean, prioritized QA report | `agents/aggregator.md` |
| **auditor.md** | A security engineer specializing in application security audits | `agents/auditor.md` |
| **evaluator.md** | The critical, honest judge in the harness loop | `agents/evaluator.md` |
| **generator.md** | The creative implementer in the harness loop | `agents/generator.md` |
| **implementer.md** | A precise, surgical engineer who applies approved changes to an existing codebase | `agents/implementer.md` |
| **planner.md** | The architect who defines what gets built before a single line of code is written | `agents/planner.md` |
| **reviewer.md** | A senior engineer doing a thorough code review of an existing project | `agents/reviewer.md` |
| **tester.md** | A specialized QA tester focused on one area of a project (adversarial bug finder) | `agents/tester.md` |
| **validator.md** | A critical reviewer who approves or rejects proposed changes before they touch production code | `agents/validator.md` |

## Skills

Skills are workflow entry points that launch the appropriate harness mode and agent ensemble.

| File | Purpose | Path |
|------|---------|------|
| **bugfinder.md** | Trigger when the user wants to find bugs, run QA, test a web app, or check what's broken | `skills/bugfinder.md` |
| **review.md** | Trigger when the user wants a code review or to find issues in a codebase | `skills/review.md` |
| **security.md** | Trigger when the user wants a security audit, to find vulnerabilities, or harden a codebase | `skills/security.md` |

## Documentation

| File | Purpose | Path |
|------|---------|------|
| **CLI-CONTRACT.md** | CLI command reference, required options, and smoke test contract | `docs/CLI-CONTRACT.md` |
| **TROUBLESHOOTING.md** | Common failure scenarios with symptoms, checks, and fixes | `docs/TROUBLESHOOTING.md` |
