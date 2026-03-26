# Code Review Skill

Trigger this skill when the user wants a code review, wants to find issues in a codebase, or wants bugs/performance/maintainability problems identified and fixed.

Use when asked to: "review this code", "review the project", "find issues", "code review", "check the codebase", "what's wrong with this code".

---

## What this skill does

Runs the harness review mode: a Reviewer agent scans the project and proposes fixes → a Validator approves or rejects each one → an Implementer applies approved changes surgically → the Reviewer re-checks to confirm fixes landed correctly.

Nothing touches the codebase without passing the Validator gate.

---

## How to invoke

Ask the user for:
1. **Project path** — the directory to review (required)
2. **Focus** — what to look for (default: all)

Then run:

```bash
cd /path/to/claude-harness
npm run review -- --project '<project_path>' --focus <area>
```

## Examples

```bash
# Full review
npm run review -- --project /path/to/project

# Performance only
npm run review -- --project /path/to/project --focus performance

# Bug hunt only
npm run review -- --project /path/to/project --focus bug
```

## Focus options

| Focus | What gets reviewed |
|-------|--------------------|
| `bug` | Logic errors, unhandled exceptions, wrong conditions, data corruption risk |
| `performance` | N+1 queries, unnecessary loops, missing indexes, blocking calls, memory leaks |
| `maintainability` | Dead code, duplicated logic, missing error handling, overly complex functions |
| `style` | Magic numbers, unclear naming, inconsistent formatting |
| `all` | Everything (default) |

## Output

- `workspace/findings.md` — issues found with proposed fixes
- `workspace/validation.md` — approved / rejected list with reasons
- `workspace/state.md` — full issue table with statuses
