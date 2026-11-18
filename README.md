# Gauntlet

[![ci](https://github.com/Caezarr/gauntlet/actions/workflows/ci.yml/badge.svg)](https://github.com/Caezarr/gauntlet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A multi-agent harness on Claude Code for QA, code review, security audits, design and builds: parallel specialists that report with evidence, and a separate Validator that must approve a fix before anything is written to your code.

## The problem

The common way to use an LLM for quality work is one conversation: "find the bugs", "review this", "fix the security issues". It fails in three predictable ways. It is serial, so one context walks the UI, then the API, then auth, and the later areas get a tired, crowded context. It describes instead of proving: "the form looks broken" is not a bug report, a console error and an HTTP response body are. And it grades its own homework: the context that proposed a fix also decides the fix is good and writes it to disk. Teams that adopt agentic review hit all three as soon as the codebase is bigger than a demo.

## How it solves it

Gauntlet runs a team of Claude Code agents with narrow mandates, a written protocol and hard gates.

- **Parallel specialists.** In `bugfinder` mode up to six testers (ui, functional, auth, api, data, perf) run at the same time, each driving a real browser through Playwright, then an aggregator deduplicates and scores.
- **Evidence over description.** Testers capture console errors, failed network responses and the exact input from the first action; screenshots are taken only for confirmed bugs. Reviewers and auditors must propose specific, implementable fixes (security findings carry CWE references).
- **Validator gate before any write.** In `review` and `security` modes a separate Validator approves or rejects each proposed fix. The Implementer runs only if at least one fix is approved, applies only the approved indices, and a recheck pass re-reads the modified files.
- **Protocol as data, tested.** The orchestrator follows prose in [`CLAUDE.md`](CLAUDE.md). The same rules (agents per mode, thresholds, message types, the gate) are encoded in [`src/protocol.ts`](src/protocol.ts), and a test fails CI if the two drift apart.
- **Everything on disk.** Agents share no memory: they write reports to `workspace/` and send small typed JSON messages ([`src/types.ts`](src/types.ts)). The orchestrator appends every message to `workspace/messages.jsonl`.

```text
bugfinder   tester x N (parallel) -> aggregator -> qa-report.md
review      reviewer -> VALIDATOR GATE -> implementer -> validator recheck
security    auditor  -> VALIDATOR GATE -> implementer -> auditor re-audit (target risk <= 3/10)
design      generator <-> evaluator until 32/40, plateau, or --iterations
build       planner -> (generator <-> evaluator) sprints until 8/10 or --sprints
```

Roles, sequence diagram, gates and failure handling: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Try it

Requires Node.js 22.12+. A real run also needs [Claude Code](https://claude.ai/code) authenticated, with `claude` on your `PATH`.

### Offline, no Claude session (about 1 minute)

Everything here runs without network access to Claude and without launching a session:

```bash
git clone https://github.com/Caezarr/gauntlet && cd gauntlet
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
npm run check     # typecheck + definition lint + tests + CLI smoke (what CI runs)
```

Expected output (excerpt):

```text
✓ 12 agent/skill definitions valid
...
# tests 77
# pass 77
# fail 0
[gauntlet-smoke] review without --project should fail
[gauntlet-smoke] ok
```

The CLI validates inputs and refuses to launch on bad ones:

```bash
npm run status                                    # No active session found.
npm run review -- --project ./does-not-exist      # [gauntlet] Directory not found: .../does-not-exist
npm run bugfinder -- --project . --focus nope     # [gauntlet] No valid focus areas. Choose from: ui, functional, auth, api, data, perf
```

### Real run (launches a Claude Code session and uses your Claude plan)

```bash
npm run install-browsers   # Playwright engines for the bugfinder testers

npm run bugfinder -- --project /path/to/app --url http://localhost:3000 --focus auth,api
npm run review    -- --project /path/to/app --focus bug
npm run security  -- --project /path/to/app --severity high
npm run design    -- "a dark analytics dashboard with collapsible sidebar"
npm run build     -- "task tracker with tags and due dates" --sprints 3
npm run status    # current session state
```

Without `--url`, bugfinder testers try to start the app from the project's own scripts. No API keys or environment variables are needed beyond your Claude Code login. Output lands in `workspace/` (gitignored). Gauntlet does not pass `--dangerously-skip-permissions`: agents ask before modifying files.

The bundled skills can also be installed to start a mode from any Claude Code session: `cp skills/*.md ~/.claude/skills/`, then `/bugfinder`, `/review` or `/security`.

## How it works

1. The TypeScript CLI parses argv, validates paths and focus areas, and builds a `HarnessConfig` with pure per-mode builders (`src/config.ts`).
2. It writes `workspace/gauntlet-config.json` and launches `claude` with agent teams enabled (`src/runtime.ts`, the only module with side effects).
3. That session acts as Lead Orchestrator and follows `CLAUDE.md`: it spawns teammates from `agents/*.md` (one role per file: planner, generator, evaluator, reviewer, auditor, validator, implementer, tester, aggregator).
4. Each teammate writes its report (`bugs-{area}.md`, `findings.md`, `vulnerabilities.md`, `validation.md`, ...) and sends a typed message (`BUG_REPORT`, `REVIEW_FINDINGS`, `VALIDATION`, `RECHECK`, ...).
5. The orchestrator logs each message to `messages.jsonl`, updates `state.md`, and stops on a gate or a threshold: design 32/40, build 8/10, security risk 3/10 or lower, or an iteration cap.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). CLI contract: [docs/CLI-CONTRACT.md](docs/CLI-CONTRACT.md).

## Proof

What you can verify in this repository without trusting a screenshot:

| Check | What it proves |
|---|---|
| `npm test` (77 tests, node:test, no network, no Claude) | CLI to config wiring for every mode with an in-memory runtime; stop conditions and the design plateau rule; Validator gate (closed gate, index bounds, contradictory `ready_to_implement`); aggregation invariants (duplicates excluded, score within the rubric band) |
| `test/protocol-sync.test.ts` | `CLAUDE.md` and `src/protocol.ts` agree on agents per mode, thresholds, message types and the gate; every agent file shows the message contracts it declares |
| `npm run lint:definitions` | every `agents/*.md` and `skills/*.md` has valid frontmatter matching the pipeline table |
| `npm run smoke` | help text and argv contract for every command |
| [CI](.github/workflows/ci.yml) | runs typecheck, definition lint, tests and smoke on Node 22 and 24 for every pull request |

There is no recorded sample run in the repository.

## Limits and status

- Agent judgement (whether a reviewer finds the right bugs, whether a fix is actually correct) is not unit-testable. It is constrained by prompts, the Validator gate and the recheck, not proven by the test suite.
- Depends on Claude Code's experimental agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`); behaviour can change with Claude Code releases.
- No automatic retry of a whole session. Each run gets a new session id and rewrites `gauntlet-config.json`; archive `workspace/` if you want to keep an old run.
- A session can stall on a pending permission prompt. Run unattended by allowing tools at project level rather than bypassing permissions. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
- Real runs consume Claude usage proportional to the number of parallel agents and iterations.

## Development

```bash
npm ci
npm run typecheck          # src + tests under strict
npm run lint:definitions   # agent and skill frontmatter
npm test                   # node:test, no network, no Claude
npm run smoke              # CLI contract
npm run check              # all of the above
```

Layout: `src/` (CLI, config, protocol, runtime, types), `agents/` (one markdown file per role), `skills/` (Claude Code entry points), `scripts/browser.js` (Playwright runner used by testers), `test/`, `docs/`.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SUPPORT.md](SUPPORT.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 Gabriel Rance (Caezarr).
