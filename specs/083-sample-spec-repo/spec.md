# Spec: Sample Spec Pointers in README

**Slug**: 083-sample-spec-repo | **Date**: 2026-04-25

## Summary

Add a "Sample Specs" section to README.md that points readers at concrete spec directories already living inside this repo's `specs/` folder. The repo's own history is the best "what does good look like" artifact: include one full SpecKit-style spec (with research, data-model, quickstart, tasks) and a couple of minimal SDD-style specs (just `spec.md` + `plan.md` + `tasks.md`) so newcomers can compare both flows side by side.

## Requirements

- **R001** (MUST): README.md contains a discoverable section that lists at least three sample spec directories from this repo's `specs/` folder.
- **R002** (MUST): The section appears after **Getting Started** and before **Supported AI Providers** so first-time readers see it immediately after install steps.
- **R003** (MUST): At least one of the listed samples is a full SpecKit-style spec (artifacts include `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, plus `checklists/` and/or `contracts/`) and at least one is a minimal SDD-style spec (only `spec.md`, `plan.md`, `tasks.md`).
- **R004** (MUST): Each listed sample is rendered as a clickable relative link (e.g., `specs/008-spec-viewer-ux/`) so readers can jump straight to the directory on GitHub.
- **R005** (SHOULD): Each entry has a one-line annotation describing what the sample shows (full-flow vs. minimal-flow, kind of change).

## Scenarios

### First-time reader skimming the README

**When** a new visitor reads the README on GitHub or the marketplace
**Then** they see a "Sample Specs" heading shortly after Getting Started, with clickable links to a small set of in-repo example specs and one-line annotations on each.

### Developer comparing full SpecKit vs. minimal SDD output

**When** a reader follows two of the links — one full sample and one minimal sample
**Then** they can see the file-list difference (multiple artifacts vs. just spec/plan/tasks) without leaving GitHub.

## Out of Scope

- Creating a separate companion repo for samples.
- Adding new spec directories or rewriting existing ones.
- Embedding screenshots or diff snippets of the samples in this README.
- Marketplace listing / `package.json` description updates.
