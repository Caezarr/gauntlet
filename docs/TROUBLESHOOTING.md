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
npm run bugfinder -- --project /Users/me/project
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

## 3. TypeScript errors in CI ("typecheck" workflow fails)

### Symptoms
GitHub Actions workflow fails with:
```
Run npx tsc --noEmit
src/index.ts:42:7 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.
```

### Cause
TypeScript compilation errors that were not caught locally but fail in CI.

### Check locally
```bash
npx tsc --noEmit
```

This runs the same typecheck that the GitHub workflow uses (see `.github/workflows/typecheck.yml`).

### Fix
- Address type errors in the reported files
- Ensure your Node version matches CI (`node-version: "20"` in typecheck.yml)
- Ensure dependencies are installed: `npm ci`

If types are correct but the error persists, check if you're using a newer TypeScript version locally than in `package.json`:
```bash
npx tsc --version
cat package.json | grep typescript
```

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
