# Spec: Empty-State Onboarding Card

**Slug**: 084-empty-state-onboarding | **Date**: 2026-04-25

## Summary

When a user opens an initialized SpecKit workspace with zero specs, the Specs tree shows a polished onboarding "card" — a short headline, one-sentence value prop, a primary "Create your first spec" button, and a secondary "Read the docs" link. Today the same state shows only the line "Build features with specs" with a single button, which reads as a placeholder rather than a deliberate first-run experience.

## Requirements

- **R001** (MUST): When `speckit.detected` is true, `speckit.constitutionNeedsSetup` is false, and the workspace contains zero specs, the Specs tree welcome view renders the onboarding content (headline, description, primary button, docs link) instead of the current single-line message.
- **R002** (MUST): The primary button invokes the existing `speckit.create` command (no new command is introduced).
- **R003** (MUST): The docs link opens `https://github.com/alfredoperez/speckit-companion#readme` in the user's external browser via VS Code's standard markdown-link command (no custom command needed).
- **R004** (MUST): When at least one spec exists, the onboarding view is hidden and the normal Specs tree is shown — the new copy must not display alongside spec rows.
- **R005** (MUST): The other welcome states (no workspace, CLI not detected, constitution-needs-setup, filter-no-match) are not regressed — each still appears under its existing `when` clause and only one welcome view shows at a time.
- **R006** (SHOULD): The onboarding copy is friendly and concrete (e.g., describes what a spec is in one sentence) so a first-run user understands the value before clicking.

## Scenarios

### First-run user with no specs

**When** the user installs the extension, opens an initialized SpecKit workspace, and the `specs/` directory is empty
**Then** the Specs view shows the onboarding card: headline, one-line description, "Create your first spec" button, and "Read the docs" link

### User clicks the primary button

**When** the user clicks "Create your first spec" in the onboarding card
**Then** the existing `speckit.create` flow runs exactly as it does today from the command palette

### User clicks the docs link

**When** the user clicks "Read the docs"
**Then** VS Code opens `https://github.com/alfredoperez/speckit-companion#readme` in the user's default browser

### Existing specs hide the onboarding card

**When** the workspace contains one or more specs under `specs/`
**Then** the onboarding card does not render — the normal spec tree is shown

### Other empty states still work

**When** any of the existing `when` clauses match (no workspace open, CLI installed but workspace not initialized, constitution needs setup, active filter with no match)
**Then** the corresponding welcome view shows and the new onboarding view does not

## Out of Scope

- Adding a new `speckit.openDocs` command or any custom command — the docs link uses a standard URL.
- Changing the constitution-needs-setup, no-workspace, CLI-not-detected, or filter-no-match welcome views.
- Adding analytics or telemetry around the onboarding view.
- Changing the activity-bar icon or the welcome view in the Steering panel.
