# Contributing to Gauntlet

## Setup

```bash
npm install
npm run install-browsers
```

Requires Node.js ≥ 20 and an authenticated Claude Code CLI.

## Pull requests

- Keep PRs focused (one mode, one agent prompt, or one CLI fix).
- Prefer conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Do not commit `workspace/` session output, screenshots with secrets, or API keys.
- Update `CHANGELOG.md` under `## Unreleased` for user-visible changes.
- Run the relevant `npm run` mode against a throwaway project before opening the PR when you change agent behavior.

## Security

Follow `SECURITY.md` for vulnerability reports — no public issues for security findings.
