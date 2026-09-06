# Security Policy

## Supported versions

Security fixes apply to the latest commit on `main`.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security findings.

Email **gabriel@meetwonka.com** with:
- a short description of the issue
- steps to reproduce (CLI mode, flags, project under test)
- impact assessment
- any suggested fix

You should get an acknowledgement within a few business days. Please give us a reasonable window to patch before any public disclosure.

## Scope

Gauntlet runs parallel AI agents (bugfinder, review, security, design, build) against local projects. High-value reports include:
- agents writing outside the intended project path
- secret or credential leakage in reports / screenshots / logs
- unsafe auto-apply of validator-approved patches
- dependency or Playwright runner issues that expand attack surface
