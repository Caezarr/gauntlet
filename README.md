```
  ██████   █████  ██    ██ ███    ██ ████████ ██      ███████ ████████
 ██       ██   ██ ██    ██ ████   ██    ██    ██      ██         ██
 ██   ███ ███████ ██    ██ ██ ██  ██    ██    ██      █████      ██
 ██    ██ ██   ██ ██    ██ ██  ██ ██    ██    ██      ██         ██
  ██████  ██   ██  ██████  ██   ████    ██    ███████ ███████    ██
```

**Your code runs the gauntlet. Parallel AI agents. Real evidence. No mercy.**

---

Gauntlet is a multi-agent orchestration harness built on [Claude Code](https://claude.ai/code). It doesn't review your code in a single conversation — it deploys a coordinated team of specialized agents that run in parallel, each attacking a different area simultaneously, then aggregates their findings into reports with real evidence: console logs, HTTP response bodies, stack traces, timing breakdowns.

---

## Why Gauntlet

Claude in a single conversation is good. Claude as a coordinated team of specialists — each with a narrow mandate, a supervisor that checks their work, and evidence-based reporting — is a different category of tool.

**Parallelism.** Six bug hunters run simultaneously. The auth agent doesn't wait for the UI agent. Total time: one agent's runtime, not six.

**Evidence, not descriptions.** Every bug ships with the console error that triggered it, the HTTP response body, the exact input that caused the failure. Not *"the form is broken"* — `POST /api/users → 500: Cannot read property 'id' of undefined at UserService.js:142`.

**Checked work.** A Validator agent reviews every proposed fix before it touches your codebase. It rejects fixes that are wrong, incomplete, or risky. Nothing lands without passing this gate.

---

## Modes

| Mode | Pipeline | Output |
|------|----------|--------|
| `bugfinder` | 6 parallel testers → Aggregator | Scored QA report (0–10) |
| `review` | Reviewer → Validator → Implementer → Re-check | Issues found, vetted, applied, verified |
| `security` | Auditor → Validator → Implementer → Re-audit | Vulnerabilities patched, risk score confirmed |
| `design` | Generator ↔ Evaluator loop | HTML file scoring ≥ 32/40 |
| `build` | Planner → Generator ↔ Evaluator | Working app that passes QA |

---

## Requirements

- [Claude Code](https://claude.ai/code) — authenticated, `claude` in your PATH
- Node.js ≥ 20

---

## Setup

```bash
git clone https://github.com/your-username/gauntlet
cd gauntlet
npm install
npm run install-browsers
```

No API keys. No config files. No environment variables.

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

> Paths with spaces: use single quotes — `--project '/Users/me/my project'`

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
Reviewer     re-reads modified files to confirm fixes landed correctly
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

## Session status

```bash
npm run status
```

---

## Claude Code skills

Install the included skills to invoke Gauntlet directly from any Claude Code session:

```bash
cp skills/*.md ~/.claude/skills/
```

Then:

```
/bugfinder  →  parallel QA run
/review     →  code review pipeline
/security   →  security audit pipeline
```

---

## How it works

The CLI writes a config to `workspace/gauntlet-config.json`, then launches Claude Code with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Claude reads `CLAUDE.md` (the orchestration protocol) and coordinates everything — spawning agents, routing messages, aggregating results.

```
gauntlet/
├── CLAUDE.md              ← orchestration protocol
├── src/
│   ├── index.ts           ← CLI
│   └── types.ts           ← agent message contracts (TypeScript)
├── agents/
│   ├── tester.md          ← bug finder (up to 6 run in parallel)
│   ├── reviewer.md        ← code reviewer
│   ├── auditor.md         ← security auditor (OWASP, CWE refs)
│   ├── validator.md       ← approves/rejects fixes before they apply
│   ├── implementer.md     ← applies changes surgically, no scope creep
│   ├── aggregator.md      ← merges + deduplicates parallel bug reports
│   ├── generator.md       ← design + build code generator
│   ├── evaluator.md       ← scores output, feeds actionable feedback
│   └── planner.md         ← spec writer for build mode
├── scripts/
│   └── browser.js         ← Playwright runner used by tester agents
└── skills/
    ├── bugfinder.md       ← /bugfinder Claude Code skill
    ├── review.md          ← /review Claude Code skill
    └── security.md        ← /security Claude Code skill
```

---

## Output

All session output lands in `workspace/` (gitignored):

| File | Contents |
|------|----------|
| `qa-report.md` | Final QA report — quality score, all bugs deduplicated and ranked |
| `bugs-{area}.md` | Per-agent reports — bugs with console logs, HTTP evidence, stack traces |
| `findings.md` | Review issues with proposed fixes |
| `vulnerabilities.md` | Security audit — CWE refs, attack scenarios, proposed patches |
| `validation.md` | Approved / rejected list with reasons |
| `state.md` | Live session status, summary tables |
| `messages.jsonl` | Raw agent message log |
| `screenshots-{area}/` | Taken only when a bug is confirmed — never as documentation |

---

## Permissions

Gauntlet runs without `--dangerously-skip-permissions`. Agents ask for confirmation before modifying files. To run unattended, approve tools at the project level in Claude Code (`/allowed-tools`) rather than bypassing permissions globally.

---

## License

MIT
