# Spec: Fix WSL Path Detection on Native Windows

**Slug**: 026-fix-wsl-path-detection | **Date**: 2026-03-26

## Summary

The `convertPathIfWSL` method in three AI provider classes incorrectly converts Windows paths to WSL format (`/mnt/c/...`) for all Windows users. It only checks `process.platform === 'win32'` but never verifies the extension is actually running inside a WSL environment. This breaks the extension for native Windows users.

## Requirements

- **R001** (MUST): `convertPathIfWSL` must only convert paths when running inside a WSL environment, detected via `process.env.WSL_DISTRO_NAME` or equivalent WSL indicator.
- **R002** (MUST): Native Windows users must receive unmodified Windows paths (e.g., `C:\Users\...`).
- **R003** (MUST): Fix must be applied consistently across all three providers: `claudeCodeProvider.ts`, `codexCliProvider.ts`, `qwenCliProvider.ts`.
- **R004** (SHOULD): Extract the shared WSL detection logic into a common utility to avoid triple-duplicated code.

## Scenarios

### Native Windows — No Conversion

**When** the extension runs on Windows without WSL (`WSL_DISTRO_NAME` is unset)
**Then** `convertPathIfWSL` returns the original Windows path unchanged.

### WSL Environment — Convert Path

**When** the extension runs inside WSL (`WSL_DISTRO_NAME` is set) and receives a Windows-style path
**Then** the path is converted to WSL format (e.g., `C:\Users\foo` becomes `/mnt/c/Users/foo`).

### Non-Windows Platform — No Conversion

**When** the extension runs on macOS or Linux (not WSL)
**Then** `convertPathIfWSL` returns the path unchanged.

## Out of Scope

- Detecting WSL version (1 vs 2) — not needed for path conversion.
- Supporting non-standard WSL mount points (e.g., custom `/mnt` prefix).
- Refactoring the temp file creation logic in providers.
