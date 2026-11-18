# Changelog

All notable changes to Gauntlet are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `docs/ARCHITECTURE.md`: roles, pipelines, messages, gates, failure handling.
- `node:test` suite (CLI wiring, protocol rules, Validator gate, aggregation, CLAUDE.md drift guard) and `npm run check`.
- Frontmatter on every agent and skill, validated by `npm run lint:definitions`.
- CI runs typecheck, definition lint, tests and CLI smoke on Node 22 and 24.

### Changed
- CLI split into `cli.ts` / `config.ts` / `protocol.ts` / `runtime.ts`; behaviour unchanged.
- `engines.node` is `>=22.12`, matching the commander 15 requirement.
- README rewritten problem-first.

### Fixed
- Harness directory now resolves correctly when the install path contains spaces.

### Removed
- Duplicate root `CODEOWNERS` and `.github/SUPPORT.md`.

### Added (earlier)
- `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.editorconfig`, and MIT `LICENSE`.
