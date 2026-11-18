# Gauntlet Troubleshooting

Common failure scenarios when running the CLI or agent harness, with concrete symptoms, checks, and fixes.

---

## 1. CLI fails with "Command 'review' requires option '--project'"

### Symptoms
```bash
$ npm run review
error: required option '--project <path>' not specified
```

### Cause
The `review`, `security`, and `bugfinder` commands require a project path but none was provided.

### Fix
Pass the `--project` option with the absolute or relative path to your project:
```bash
npm run review -- --project /path/to/project
npm run security -- --project ./my-app
npm run bugfinder -- --project /path/to/project
```

Note the `--` separator when using npm scripts. For direct CLI usage:
```bash
npx tsx src/index.ts review --project /path/to/project
```

See `docs/CLI-CONTRACT.md` for all required options per command.

---

## 2. Smoke test fails on "review without --project should fail"

### Symptoms
```bash
$ bash scripts/cli-smoke.sh
[gauntlet-smoke] help
[gauntlet-smoke] design --help
[gauntlet-smoke] build --help
[gauntlet-smoke] review --help
[gauntlet-smoke] security --help
[gauntlet-smoke] bugfinder --help
[gauntlet-smoke] status --help
[gauntlet-smoke] review without --project should fail
expected non-zero exit
```

### Cause
The CLI did not exit with a non-zero status when `review` was called without the required `--project` option. This indicates a regression in argument validation.

### Fix
Check `src/index.ts` for the `review` command definition. Ensure the `--project` option is marked as `required` in Commander:
```typescript
.requiredOption('--project <path>', 'Project directory to review')
```

After fixing, re-run the smoke test to confirm:
```bash
bash scripts/cli-smoke.sh
```

---

## 3. CI fails (typecheck, definition lint, tests or smoke)

### Symptoms
The `ci` GitHub Actions workflow fails on one of its steps, for example:
```
src/cli.ts:42:7 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.
✗ agents/tester.md: bugfinder pipeline expects it to emit BUG_REPORT
not ok 3 - review: spawns exactly the agents in its pipeline
```

### Cause
- A type error in `src/` or `test/`
- An agent/skill frontmatter field is missing or no longer matches `src/protocol.ts`
- `CLAUDE.md` or an agent's output contract changed without updating `src/protocol.ts` (caught by `test/protocol-sync.test.ts`)

### Check locally
```bash
npm ci
npm run check   # typecheck + lint:definitions + test + smoke, same as CI
```

### Fix
- Address the reported file and line
- If you changed the protocol on purpose, update `PIPELINES` / `TARGET_SCORES` in `src/protocol.ts` and the agent's frontmatter in the same commit
- Ensure your Node version matches CI (22 or 24; `engines.node` is `>=22.12`)

---

## 4. Playwright installation missing ("Cannot find module 'playwright'")

### Symptoms
Tester agents fail with:
```
Error: Cannot find module 'playwright'
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1048:15)
```

Or when running bugfinder:
```bash
$ npm run bugfinder -- --project ./app --url http://localhost:3000
[tester-ui] Error: Cannot find module 'playwright'
```

### Cause
Playwright is listed in `package.json` dependencies but was never installed, or `node_modules/` was deleted.

### Fix
Install dependencies:
```bash
npm install
```

If Playwright is installed but browsers are missing, install them:
```bash
npm run install-browsers
```

This runs `npx playwright install --with-deps chromium firefox webkit` (see `package.json` scripts).

### Check
Verify Playwright is available:
```bash
node -e "require('playwright')" && echo "OK"
```

Expected output: `OK`

---

## 5. App fails to start in tester agent ("Connection refused" or "ECONNREFUSED")

### Symptoms
Tester agents fail early with:
```
[tester-functional] Error: connect ECONNREFUSED 127.0.0.1:3000
[tester-functional] App is not running at http://localhost:3000
```

### Cause
The `--url` was provided but the app is not actually running at that address, or the tester tried to auto-start the app but failed.

### Fix
**If you provided `--url`:** start the app manually before running bugfinder:
```bash
# In terminal 1
cd /path/to/project
npm run dev  # or python app.py, etc.

# In terminal 2
npm run bugfinder -- --project /path/to/project --url http://localhost:3000
```

**If you did NOT provide `--url`:** the tester will try to auto-start from common commands (`npm run dev`, `npm start`, etc.). Check:
- Does your project have a `package.json` with a `dev` or `start` script?
- Does it start successfully when you run it manually?

See `agents/tester.md` for the full auto-start logic (searches for `npm run dev`, `python app.py`, etc.).

---

## 6. Agent timeout or "Orchestrator did not respond"

### Symptoms
Long silence, then:
```
[generator] Timeout: Orchestrator did not respond after 180 seconds
```

Or the harness hangs with no visible progress for several minutes.

### Cause
- The Claude Code session is waiting for user confirmation (file write, shell command) but is running unattended
- An agent is stuck in an infinite loop or waiting on external input
- Network issues with Claude API
- The orchestrator crashed or exited unexpectedly

### Check
1. Look at `workspace/state.md` to see the last recorded status:
   ```bash
   cat workspace/state.md
   ```

2. Check `workspace/messages.jsonl` for the last message sent/received:
   ```bash
   tail -5 workspace/messages.jsonl
   ```

3. If running in Claude Code, check the chat for pending permission requests

### Fix
- **Permissions**: Set allowed tools at the project level with `/allowed-tools` in Claude Code (see README "Permissions" section)
- **Timeout**: Re-run with more iterations or sprints if the agent legitimately needs more time
- **Stuck agent**: If an agent is clearly looping, kill the process and file a bug report with `workspace/messages.jsonl` attached

---

## Need more help?

- For installation issues, see [SUPPORT.md](../SUPPORT.md)
- For CLI contract details, see [CLI-CONTRACT.md](CLI-CONTRACT.md)
- For agent behavior, read the relevant agent file in `agents/`
- File bugs at https://github.com/Caezarr/gauntlet/issues
