# Plan: Sample Spec Pointers in README

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-25

## Approach

Add a "Sample Specs" subsection to README.md between **Getting Started** and **Supported AI Providers**. The section points to in-repo spec directories (no external repo) using GitHub-relative links so the example artifacts ship with the codebase and stay in sync with reality. Pick one full SpecKit-style spec and two minimal SDD-style specs to highlight the contrast between the two flows.

## Files to Change

- `README.md` — insert a `## Sample Specs` section after the **Getting Started** block (around line 116). Section contains:
  - 1–2 sentences of intro
  - Bullet list of 3 in-repo specs with relative links and a one-line annotation each
  - Picks: `specs/008-spec-viewer-ux/` (full SpecKit flow), `specs/065-multi-select-specs/` (minimal SDD flow), `specs/051-explorer-viewer-fixes/` (minimal SDD flow)
