# Bug Finder Skill

Trigger this skill when the user wants to find bugs, run QA, test a web app, or check what's broken.

Use when asked to: "find bugs", "run QA", "test this app", "what's broken", "scan for issues", "bugfinder", "run the tester".

---

## What this skill does

Runs the harness bugfinder mode: spawns up to 6 parallel Claude agents (ui, functional, auth, api, data, perf), each attacking a different area of the app simultaneously, then aggregates findings into a QA report with a quality score.

---

## How to invoke

Ask the user for:
1. **Project path** — the directory to scan (required)
2. **App URL** — the running app's URL (optional, testers will try to start it if missing)
3. **Focus areas** — which areas to test (default: all 6)
4. **Browser** — which engine to use (default: chromium)

Then run:

```bash
cd /path/to/claude-harness
npm run bugfinder -- \
  --project '<project_path>' \
  --url <app_url> \
  --focus <areas> \
  --browser <engine>
```

**Important:** wrap paths that contain spaces in single quotes.

## Examples

```bash
# Full scan
npm run bugfinder -- --project '/Users/me/my project' --url http://localhost:3000

# Auth + API only
npm run bugfinder -- --project /path/to/project --url http://localhost:3000 --focus auth,api

# Cross-browser
npm run bugfinder -- --project /path/to/project --url http://localhost:3000 --browser all
```

## Focus areas

| Area | What gets tested |
|------|-----------------|
| `ui` | Layout, responsive, template artifacts, accessibility |
| `functional` | CRUD flows, edge case inputs, navigation, double-submit |
| `auth` | Unauth access, wrong credentials, session after logout, IDOR |
| `api` | Endpoints, malformed input, empty body, error handling |
| `data` | Persistence, special chars, delete permanence |
| `perf` | Load times, asset sizes, memory leaks, API response times |

## Output

Results go to `workspace/` inside the harness directory:
- `workspace/qa-report.md` — final prioritized report with quality score (0–10)
- `workspace/bugs-{area}.md` — per-agent reports with console + network evidence
- `workspace/screenshots-{area}/` — screenshots taken only on confirmed bugs
