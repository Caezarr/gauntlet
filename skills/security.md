# Security Audit Skill

Trigger this skill when the user wants a security audit, wants to find vulnerabilities, or wants to harden a codebase.

Use when asked to: "security audit", "find vulnerabilities", "check for security issues", "harden this", "OWASP check", "pen test the code", "find CVEs".

---

## What this skill does

Runs the harness security mode: an Auditor agent scans for vulnerabilities (injection, auth, XSS, CSRF, exposure, deps, config, crypto) → a Validator confirms each vulnerability is real and the fix is correct → an Implementer applies approved patches → the Auditor re-scans to confirm the risk score dropped.

---

## How to invoke

Ask the user for:
1. **Project path** — the directory to audit (required)
2. **Severity** — minimum severity to address (default: all)

Then run:

```bash
cd /path/to/claude-harness
npm run security -- --project '<project_path>' --severity <level>
```

## Examples

```bash
# Full audit
npm run security -- --project /path/to/project

# Critical only (fastest)
npm run security -- --project /path/to/project --severity critical

# Critical + high
npm run security -- --project /path/to/project --severity high
```

## Severity levels

| Level | Meaning |
|-------|---------|
| `critical` | Exploitable now — data breach, full compromise possible |
| `high` | Significant risk, exploitable with minimal effort |
| `medium` | Real risk but requires specific conditions |
| `low` | Defense in depth, best practice violations |

## Vulnerability categories (OWASP-inspired)

`injection` · `auth` · `exposure` · `xss` · `csrf` · `deps` · `config` · `crypto`

Each vulnerability is reported with: category, severity, CWE reference, file + line, attack scenario, and a specific proposed fix.

## Output

- `workspace/vulnerabilities.md` — full audit with risk score (0–10)
- `workspace/validation.md` — patches approved / rejected
- `workspace/state.md` — vulnerability table with statuses
- **Target:** risk score ≤ 3/10 after patching
