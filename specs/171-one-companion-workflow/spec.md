# One SpecKit Companion Workflow

## Overview

SpecKit Companion currently presents itself as two competing shapes — a "standard" profile and a "turbo" profile — when in reality there is only one Companion workflow: the lean, fast one. This change makes that single lean shape the official and only Companion offering, removes the dead "turbo" preset and all user-facing "turbo"/"standard" naming, and turns the small-change fast-path on by default so a small spec can fold straight to implement without a hidden flag. Stock SpecKit (the separate upstream flow) is left untouched.

## Functional Requirements

- **FR-001** The system MUST treat the lean `speckit.companion.*` command set as the sole SpecKit Companion workflow shape — there is no longer a "standard" vs. "turbo" choice for Companion.
- **FR-002** The system MUST remove the `companion-turbo` preset source directory.
- **FR-003** The preset reconciler MUST no longer list, install, or reconcile `companion-turbo`, and the preset parity check MUST no longer reference it.
- **FR-004** The system MUST retain the existing migration that removes an already-installed leftover `companion-turbo` preset, so users who previously installed turbo are cleaned up on upgrade.
- **FR-005** All user-facing "turbo" wording MUST be scrubbed from the live Companion command bodies and descriptions (e.g. "Companion turbo specify" → "Companion specify", "turbo specification" → "Companion specification").
- **FR-006** The word "standard" MUST no longer be used as a *Companion profile* name in documentation; where it referred to the stock timing carrier, docs MUST describe it as stock SpecKit plus timing, not a Companion profile.
- **FR-007** The internal `companion-standard` preset id MUST be preserved (not renamed) to avoid migration risk; any id rename is explicitly out of scope.
- **FR-008** The classify → small-change short-circuit (fast-path) MUST be core Companion behavior, active by default with no opt-in flag required.
- **FR-009** The system MUST NOT require the `complexityFastPath` setting to enable the fast-path; the fast-path is on regardless of that flag's value for the Companion workflow.
- **FR-010** The oversized-change guardrail MUST remain in force: a change projected to exceed 5 files or 10 tasks (or carrying a "larger" scope signal) MUST run the full specify → plan → tasks → implement pipeline, never a silent fast-track.
- **FR-011** A change within the small-change thresholds MUST fold to implement via the fast-path, producing the lean three-file output (spec with Approach, pointer plan, real task checklist) and the folded lifecycle records.
- **FR-012** The system MUST NOT change stock SpecKit's workflow shape or its commands.
- **FR-013** The stock timing carrier MUST keep working so the Activity panel continues to track stock SpecKit specs.

## Success Criteria

- **SC-001** A repository-wide search finds zero occurrences of a `companion-turbo` preset source directory or its id in the reconciler and parity check.
- **SC-002** A repository-wide search finds zero user-facing occurrences of "turbo" or "standard" used as a Companion profile name (command descriptions, command bodies, docs).
- **SC-003** Upgrading from a build that had `companion-turbo` installed results in the leftover turbo preset being removed automatically, with no manual step.
- **SC-004** Running the Companion workflow on a small change (≤5 files and ≤10 tasks, no "larger" scope signal) folds to implement without any flag set, emitting the three lean files and recording plan/tasks as satisfied.
- **SC-005** Running the Companion workflow on a change exceeding 5 files or 10 tasks always runs the full pipeline and emits the guardrail warning, never a silent fast-track.
- **SC-006** Stock SpecKit specs still appear and update in the Activity panel after the change (timing carrier intact).
- **SC-007** All existing automated tests (including the preset reconciler and parity tests) pass with the turbo references removed.

## Assumptions

- The fast-path classification heuristic, thresholds (5 files / 10 tasks), scope-signal keywords, and guardrail warning text are unchanged from today's `complexityFastPath`-gated behavior — only the gating flag is removed so the path is on by default.
- The `complexityFastPath` setting key may remain defined for backward compatibility but no longer gates the Companion fast-path; removing the setting entirely is out of scope for this change.
- The formal home of the route/short-circuit node in `workflow.yml` is formalized by a separate, later change (#308); this change only makes the fast-path on by default in the current command-driven path.
- "Companion specification" / "Companion specify" are the agreed replacement names for the scrubbed "turbo" wording.
- Documentation updates land in the spec-kit extension's own README/CHANGELOG (and the relevant `docs/*.md`), not the root VS Code extension docs, since this change is under `speckit-extension/`.
