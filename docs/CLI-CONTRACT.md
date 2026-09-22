# Gauntlet CLI contract + smoke

Lock the Commander surface before major bumps (see issue #11 and Dependabot commander major).

## Public commands

| Command | Required options | Notes |
|---|---|---|
| `design <prompt>` | — | `--iterations`, `--existing` |
| `build <prompt>` | — | `--sprints`, `--project` |
| `review` | `--project` | `--focus` |
| `security` | `--project` | `--severity` |
| `bugfinder` | `--project` | `--focus`, `--url`, `--browser` |
| `status` | — | reads `workspace/gauntlet-config.json` |

npm scripts mirror these: `design`, `build`, `review`, `security`, `bugfinder`, `status`.

## Smoke (no Claude launch)

These checks only validate argv parsing / help text. They must **not** call `claude`.

```bash
npm run status
npx tsx src/index.ts --help
npx tsx src/index.ts design --help
npx tsx src/index.ts build --help
npx tsx src/index.ts review --help
npx tsx src/index.ts security --help
npx tsx src/index.ts bugfinder --help
```

Expect exit 0 and the command names above in help output.

Missing required `--project` on `review` / `security` / `bugfinder` should exit non-zero.

## Before merging Commander major

1. Run the smoke block on current `main`.
2. Apply the Dependabot major on a branch.
3. Re-run smoke + a dry `status` with a fake config if present.
4. Only then merge — do not blind-merge majors.
