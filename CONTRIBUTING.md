# Contributing to Gauntlet

## Setup

```bash
npm install
npm run install-browsers
```

Requires Node.js ≥ 20 and an authenticated Claude Code CLI.

## Testing your changes

Run the relevant mode against a throwaway project before submitting:

```bash
# Bug finder mode
npm run bugfinder -- --project /path/to/test-project --url http://localhost:3000

# Code review mode
npm run review -- --project /path/to/test-project

# Security audit mode
npm run security -- --project /path/to/test-project

# Design mode
npm run design -- "test prompt"

# Build mode
npm run build -- "test prompt"

# Check session status
npm run status
```

When modifying agent behavior, verify output in `workspace/` for correctness.

**Type checking:** Run `npx tsc --noEmit` locally to catch type errors before pushing.

## Pull request checklist

Before opening a PR:

- [ ] Keep scope focused (one mode, one agent prompt, or one CLI fix)
- [ ] Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- [ ] Test the relevant `npm run` command against a throwaway project
- [ ] Update `CHANGELOG.md` under `## Unreleased` for user-visible changes
- [ ] Remove any test artifacts from `workspace/` before committing
- [ ] Check that no secrets, API keys, or sensitive data are included
- [ ] Use descriptive branch names (e.g., `fix/bugfinder-timeout`, `feat/add-focus-filter`)

**Do not:**
- Commit `workspace/` session output or screenshots with secrets
- Force-push over existing PR branches
- Include unrelated dependency major version bumps
- Break existing modes or commands

## Security

Follow [SECURITY.md](SECURITY.md) for vulnerability reports — no public issues for security findings.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
