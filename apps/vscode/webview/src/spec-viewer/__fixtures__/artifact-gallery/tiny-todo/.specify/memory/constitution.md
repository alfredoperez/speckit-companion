<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles: none (initial adoption)
- Added sections: Core Principles (4), Governance
- Removed sections: template slots SECTION_2 and SECTION_3 (not needed for a four-principle charter)
- Deferred TODOs: none
-->

# Tiny Todo Constitution

A tiny, dependency-free browser todo app.

## Core Principles

### I. No Runtime Dependencies
The shipped app MUST NOT import or bundle any third-party runtime code. Dev-only tooling is
allowed only if it never reaches the delivered files.
Rationale: the app stays small, auditable, and free of supply-chain risk.

### II. Accessible by Default (WCAG AA)
Every UI change MUST meet WCAG 2.x AA: semantic HTML, full keyboard operation, visible focus,
text contrast of at least 4.5:1, and labels for all controls. Accessibility is part of the
definition of done, not a follow-up.

### III. State Lives in localStorage Only
All persistent state MUST be stored in `localStorage`. The app MUST NOT use a backend, cookies,
IndexedDB, or any network call to store or sync data.
Rationale: one storage location keeps the app private, offline-capable, and simple.

### IV. Every Store Function Has a node:test
Every exported store function MUST have at least one test using `node:test`. A store change
MUST NOT merge without its test. Store code MUST stay testable in Node (storage injected or
stubbed), with no DOM dependency.

## Governance

This constitution supersedes other practices. Amendments require a written change to this file,
a version bump, and an updated Sync Impact Report. Versioning follows semantic versioning:
MAJOR for removed or redefined principles, MINOR for added principles or materially expanded
guidance, PATCH for wording fixes. Every PR MUST be checked against the four principles, and any
exception MUST be justified in the PR description.

**Version**: 1.0.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-03
