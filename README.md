```
  ██████   █████  ██    ██ ███    ██ ████████ ██      ███████ ████████
 ██       ██   ██ ██    ██ ████   ██    ██    ██      ██         ██
 ██   ███ ███████ ██    ██ ██ ██  ██    ██    ██      █████      ██
 ██    ██ ██   ██ ██    ██ ██  ██ ██    ██    ██      ██         ██
  ██████  ██   ██  ██████  ██   ████    ██    ███████ ███████    ██
```

**Your code runs the gauntlet. Parallel AI agents. Real evidence. No unreviewed writes.**

[![ci](https://github.com/Caezarr/gauntlet/actions/workflows/ci.yml/badge.svg)](https://github.com/Caezarr/gauntlet/actions/workflows/ci.yml)

---

## The problem

Asking one LLM conversation to "find the bugs" or "fix the security issues" fails in predictable ways:

- **It is serial.** One context walks the UI, then the API, then auth. Slow, and later areas get a tired context.
- **It describes instead of proving.** *"The form looks broken"* is not a bug report. A stack trace and an HTTP body are.
- **It grades its own homework.** The same context that proposed a fix decides the fix is fine and writes it to disk.

## What Gauntlet does

Gauntlet runs a **team** of Claude Code agents with narrow mandates, a written protocol, and gates:

- **Parallel specialists.** Up to six bug hunters (ui, functional, auth, api, data, perf) run at the same time; an aggregator deduplicates and scores.
- **Evidence-based reports.** Every bug carries the console error, the HTTP response, the exact input. Example: `POST /api/users → 500: Cannot read property 'id' of undefined at UserService.js:142`.
- **A Validator gate before any write.** In review and security modes a separate Validator approves or rejects each proposed fix. The Implementer applies only approved fixes, then a recheck confirms they landed.

| Mode | Pipeline | Output |
|------|----------|--------|
| `bugfinder` | N parallel testers → Aggregator | Scored QA report (0–10) |
| `review` | Reviewer → **Validator gate** → Implementer → Validator recheck | Issues found, vetted, applied, verified |
| `security` | Auditor → **Validator gate** → Implementer → Auditor re-audit | Vulnerabilities patched, risk ≤ 3/10 |
| `design` | Generator ↔ Evaluator loop | HTML file scoring ≥ 32/40 |
| `build` | Planner → Generator ↔ Evaluator sprints | Working app that passes QA (≥ 8/10) |

**How it works in one paragraph:** the CLI validates your options, writes `workspace/gauntlet-config.json`, and launches Claude Code with agent teams enabled. That session follows [`CLAUDE.md`](CLAUDE.md), spawns the agents in [`agents/`](agents/), routes their typed JSON messages ([`src/types.ts`](src/types.ts)), logs every message to `workspace/messages.jsonl`, and stops on a gate or a score threshold.

**Read next: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (roles, pipeline per mode, messages, gates, failure handling, diagrams).

---

## Quick start

Requirements: [Claude Code](https://claude.ai/code) authenticated with `claude` on your `PATH`, and Node.js ≥ 22.12.

```bash
git clone https://github.com/Caezarr/gauntlet
cd gauntlet
npm install
npm run install-browsers   # Playwright engines for the bugfinder testers

npm run bugfinder -- --project /path/to/project --url http://localhost:3000
npm run review    -- --project /path/to/project
npm run security  -- --project /path/to/project --severity high
npm run status    # current session state
```

No API keys, no config files, no environment variables. Output lands in `workspace/` (gitignored).

---

## How to verify

Everything below runs offline and never launches Claude:

```bash
npm ci
npm run check          # = typecheck + lint:definitions + test + smoke (what CI runs)
```

| Check | What it proves |
|---|---|
| `npm run typecheck` | `src/` and `test/` compile under `strict` |
| `npm run lint:definitions` | every `agents/*.md` / `skills/*.md` has valid frontmatter that matches the pipeline table |
| `npm test` | CLI → config wiring for all modes, stop conditions, plateau rule, Validator gate, aggregation invariants, and a drift guard that pins `CLAUDE.md` to `src/protocol.ts` |
| `npm run smoke` | help text and argv contract ([docs/CLI-CONTRACT.md](docs/CLI-CONTRACT.md)) |

CI runs the same steps on Node 22 and 24 for every pull request.

---

## Bug Finder

Six agents spawn at once. Each owns one area. Results converge into a single prioritized report.

```
                       ┌──────────────┐
                       │ Orchestrator │
                       └──────┬───────┘
          ┌──────────┬────────┼────────┬──────────┬──────────┐
          ▼          ▼        ▼        ▼          ▼          ▼
        [ui]  [functional] [auth]   [api]      [data]     [perf]
          └──────────┴────────┴────────┴──────────┴──────────┘
                                   │
                             [Aggregator]
                                   │
                             qa-report.md
```

Each tester monitors the browser console and network from the first line — errors, exceptions, slow requests, and failed responses are captured automatically. Screenshots happen only when a bug is confirmed.

```bash
# All 6 areas, chromium
npm run bugfinder -- --project /path/to/project --url http://localhost:3000

# Focus on what matters
npm run bugfinder -- --project /path/to/project --url http://localhost:3000 --focus auth,api,data

# Cross-browser (chromium + firefox + webkit)
npm run bugfinder -- --project /path/to/project --url http://localhost:3000 --browser all

# No server running — agents will start it from the project config
npm run bugfinder -- --project /path/to/project
```

> Paths with spaces: use single quotes — `--project '/path/to/my project'`

### Focus areas

| Area | What gets tested |
|------|-----------------|
| `ui` | Layout breaks, responsive overflow, template artifacts (`[object Object]`, `{{var}}`), accessibility |
| `functional` | CRUD flows, edge inputs (XSS, SQLi, unicode, 10k chars), double-submit, navigation |
| `auth` | Unauthenticated access, wrong credentials, session after logout, IDOR via ID enumeration |
| `api` | No-auth endpoints, malformed JSON, empty body, non-existent IDs, response shape |
| `data` | Persistence across reloads, special chars stored/retrieved, soft-delete leaks |
| `perf` | TTFB + load times, asset sizes, memory across 20 navigations, slow API responses |

### Quality score

| Score | Meaning |
|-------|---------|
| 10 | No bugs |
| 9 | Minor bugs only (< 5) |
| 8 | Minor bugs only, any count |
| 6–7 | Up to 3 major, no critical |
| 4–5 | 4+ major or 1 critical |
| 2–3 | Multiple critical |
| 0–1 | App fundamentally broken |

---

## Code Review

```bash
npm run review -- --project /path/to/project
npm run review -- --project /path/to/project --focus performance
npm run review -- --project /path/to/project --focus bug
npm run review -- --project /path/to/project --focus maintainability
```

**Focus:** `bug` · `performance` · `maintainability` · `style` · `all`

The pipeline:

```
Reviewer     finds issues + proposes specific, implementable fixes
    ↓
Validator    checks each fix — correct? safe? in scope?
    ↓
Implementer  applies approved changes surgically (no reformatting, no scope creep)
    ↓
Validator    re-reads modified files to confirm fixes landed correctly
```

Fixes are specific by design: *"Replace the for loop at line 42 with a list comprehension to eliminate the N+1 query"* — not *"optimize your queries."* The Validator rejects anything vague or incorrect before it reaches your files.

---

## Security Audit

```bash
npm run security -- --project /path/to/project
npm run security -- --project /path/to/project --severity critical
npm run security -- --project /path/to/project --severity high
```

**Severity:** `critical` · `high` · `all`

OWASP-inspired categories, CWE references included in every finding:

| Category | Covers |
|----------|--------|
| `injection` | SQL, command, template injection — CWE-89, CWE-77, CWE-94 |
| `auth` | Missing auth on routes, insecure sessions, hardcoded credentials — CWE-287, CWE-798 |
| `exposure` | Secrets in code, data in logs, error messages leaking internals — CWE-200 |
| `xss` | Unsafe `innerHTML`, unescaped user input in templates — CWE-79 |
| `csrf` | Missing tokens on state-changing routes — CWE-352 |
| `deps` | Known CVEs in declared dependency versions |
| `config` | Debug mode in prod, insecure CORS, missing security headers |
| `crypto` | MD5/SHA1 for passwords, hardcoded keys, weak random — CWE-327, CWE-330 |

Risk score: 9–10 (critical / exploitable now) → 0–2 (minor config, solid posture). Target after patching: ≤ 3.

---

## Design

Iterative HTML generation — Generator writes, Evaluator scores on four dimensions, feedback loops until 32/40.

```bash
npm run design -- "a dark analytics dashboard with collapsible sidebar"
npm run design -- "tighten the layout and fix mobile" --existing ./page.html
npm run design -- "SaaS landing page for a dev tool" --iterations 20
```

Scoring (0–10 each, target 32/40):
- **Design quality** — hierarchy, whitespace, deliberate choices
- **Originality** — not Bootstrap, not generic SaaS, something distinctive
- **Craft** — consistent spacing system, smooth interactions, pixel-level attention
- **Functionality** — works in browser, handles edge cases, no JS errors

Loop stops at 32/40, plateau (±1pt across 3 iterations at ≥28), or max iterations.

---

## Build

```bash
npm run build -- "task tracker with tags, due dates, and full-text search"
npm run build -- "add real-time notifications" --project /path/to/project --sprints 3
```

Planner writes a spec → Generator implements → Evaluator tests as a real user → loop until ≥ 8/10 or max sprints.

---

## Claude Code skills

Install the included skills to invoke Gauntlet from any Claude Code session:

```bash
cp skills/*.md ~/.claude/skills/
```

Then `/bugfinder`, `/review` or `/security`.

---

## Repository layout

```
gauntlet/
├── CLAUDE.md              orchestration protocol the Lead Orchestrator follows
├── src/
│   ├── index.ts           CLI entry point
│   ├── cli.ts             command wiring (argv → config → launch)
│   ├── config.ts          pure per-mode config builders
│   ├── protocol.ts        pipelines, targets, stop rules, Validator gate, aggregation rules
│   ├── runtime.ts         filesystem + Claude Code launch (the only side effects)
│   ├── definitions.ts     frontmatter lint for agents/ and skills/
│   └── types.ts           config + inter-agent message contracts
├── agents/                one markdown file per role (frontmatter: modes, emitted messages)
├── skills/                Claude Code skill entry points
├── scripts/
│   ├── browser.js         Playwright runner used by tester agents
│   └── cli-smoke.sh       CLI contract smoke test
├── test/                  node:test suite (no network, no Claude)
└── docs/                  ARCHITECTURE, CLI-CONTRACT, TROUBLESHOOTING, INDEX
```

## Output

All session output lands in `workspace/` (gitignored):

| File | Contents |
|------|----------|
| `qa-report.md` | Final QA report: quality score, all bugs deduplicated and ranked |
| `bugs-{area}.md` | Per-agent reports with console logs, HTTP evidence, stack traces |
| `findings.md` | Review issues with proposed fixes |
| `vulnerabilities.md` | Security audit: CWE refs, attack scenarios, proposed patches |
| `validation.md` | Approved / rejected list with reasons |
| `state.md` | Live session status, summary tables |
| `messages.jsonl` | Append-only log of every agent message |
| `screenshots-{area}/` | Taken only when a bug is confirmed |

---

## Permissions

Gauntlet runs without `--dangerously-skip-permissions`. Agents ask before modifying files. To run unattended, approve tools at the project level in Claude Code (`/allowed-tools`) rather than bypassing permissions globally.

## Contributing, support, security

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, `npm run check`, PR checklist
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): common CLI and agent failures
- [SUPPORT.md](SUPPORT.md): help and bug reports
- [SECURITY.md](SECURITY.md): report vulnerabilities privately, never in public issues
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): Contributor Covenant

## License

[MIT](LICENSE) © 2026 Gabriel Rance (Caezarr).
