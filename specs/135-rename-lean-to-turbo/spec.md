# Feature Specification: Rename the "lean" template profile to "turbo"

**Feature Branch**: `135-rename-lean-to-turbo`
**Created**: 2026-06-09
**Status**: Draft
**Input**: GitHub issue #226 — rename the trimmed pipeline profile from "lean" to "turbo"

## Overview

The trimmed pipeline profile is currently named "lean," which sells the mechanism (stripped down) rather than the benefit and collides with established uses of the word (lean startup, lean manufacturing). This feature renames it to "turbo" everywhere a user selects or sees the mode — settings, UI, presets, and documentation — with zero change in what the mode actually produces. Nothing has shipped with the "lean" name, so this is a clean rename with no migration or backward compatibility.

## Functional Requirements

- **FR-001**: The template profile selection MUST offer exactly the modes `standard`, `turbo`, and `off`; the value `lean` MUST NOT appear as a selectable or accepted option.
- **FR-002**: Selecting the turbo profile MUST produce exactly the same trimmed pipeline output (spec shape, generated files, and command behavior) that the lean profile produced — this is a rename only, with no behavior change.
- **FR-003**: The `standard` and `off` modes MUST be unchanged in name, description, and behavior.
- **FR-004**: Every user-facing surface that names the trimmed mode MUST say "turbo" — the profile setting's values and descriptions, any per-spec profile control, the preset's identifier and its README, and all related UI text.
- **FR-005**: The per-spec recorded profile value MUST use `turbo` (the recorded vocabulary becomes `standard | turbo`), and internal identifiers tied to the old name MUST be renamed to their turbo equivalents.
- **FR-006**: No references to the old "lean" name may remain in the product or its documentation, including reworded unreleased changelog entries; historical artifacts (version-control history, past spec directories) are exempt.
- **FR-007**: The old `lean` value MUST NOT keep resolving — no alias, fallback, or migration is included, because the name was never released.
- **FR-008**: The `/speckit.companion.*` command names, which contain no "lean," MUST remain unchanged.

## Success Criteria

- **SC-001**: A case-insensitive search for "lean" across the product's user-facing strings, configuration metadata, presets, and documentation returns zero matches referring to the trimmed profile (historical artifacts exempt per FR-006).
- **SC-002**: The trimmed-output parity check passes: artifacts generated under "turbo" are identical in shape to those previously generated under "lean."
- **SC-003**: Users of the `standard` and `off` modes observe zero differences in behavior or wording before and after the rename.
- **SC-004**: Configuring the old `lean` value is not accepted by the profile setting (it is absent from the allowed values), and no code path silently maps it to the trimmed mode.
- **SC-005**: The recorded per-spec profile value validates against the vocabulary `standard | turbo`, and the product's existing schema-consistency check stays green.

## Assumptions

- Nothing has been released with the "lean" name, so dropping the value outright (no alias, no migration) is safe by design.
- The sequencing constraint from the issue — land after the mode-routing change (#225) — is already satisfied: #225 and its follow-up #227 are merged on `main`.
- Historical references stay as-is: git history, released changelog sections (none exist yet for this feature), and past spec directories such as `specs/132-sdd-lean-pipeline` are records of the past, not user-facing surfaces of the product.
- "Documentation" in FR-006 means the living docs: both extension READMEs, the template-profiles reference, the install guide, the unreleased changelog entries, and the spec-132 brief — per the issue's enumeration.
- Renaming the preset directory and identifier (`companion-lean` → `companion-turbo`) is part of this change; locally installed copies of the old preset are user-local and outside scope.
