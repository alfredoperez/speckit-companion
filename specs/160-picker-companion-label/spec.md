# Picker Companion Label

> Source: [issue #284](https://github.com/alfredoperez/speckit-companion/issues/284)

## Overview

Relabel the companion choice in the Create-Spec **Workflow** picker from "Turbo" to "SpecKit Companion" so that surface names the real contrast — stock SpecKit vs. the companion pipeline — directly, instead of making the user learn a second brand word. The internal `turbo` profile value stays unchanged everywhere (settings, `.spec-context.json`, preset ids, skill names); this is a label-only edit with no settings or data migration.

## Functional Requirements

- **FR-001** The Create-Spec workflow picker MUST display the companion choice with the label "SpecKit Companion" rather than "Turbo".
- **FR-002** The picker choice's description MUST make clear that selecting it pins the leaner (turbo) companion `/speckit.companion.*` pipeline on that spec, regardless of the project default.
- **FR-003** The `speckit.companion.turboWorkflowPicker` setting description MUST be reworded so its quoted choice name matches the new picker label.
- **FR-004** The persisted profile value MUST remain `turbo`: no change to `templateProfile` settings values, the `.spec-context.json` `profile` field, the `companion-turbo`/`companion-standard` preset ids, the `TemplateProfile` type, dispatch routing, the `speckit-companion-*` skill names, or the `turboWorkflowPicker` setting key — and therefore no settings/data migration.
- **FR-005** Choosing the relabeled option MUST route specify to `/speckit.companion.specify` and seed `profile: "turbo"` exactly as before — selection behavior is unchanged, only the label and description text differ.
- **FR-006** User-facing docs that name the picker choice (README and `docs/template-profiles.md`) MUST be updated to the new label wording, while the ceremony-axis "Turbo"/"Standard" wording in those docs stays as-is.
- **FR-007** The Create-Spec picker screenshot MUST be re-shot in place (filename unchanged) only if it currently shows the "Turbo" label; otherwise it is left untouched.
- **FR-008** The `templateProfile` settings UI MUST continue to present its options as Standard / Turbo / Off — the ceremony/speed axis keeps the word "Turbo".

## Success Criteria

- **SC-001** In the Create-Spec workflow dropdown, the companion choice reads "SpecKit Companion"; the standalone label "Turbo" no longer appears for that choice.
- **SC-002** After the change, 100% of persisted `turbo` values (settings.json `templateProfile`, each spec's `.spec-context.json` `profile`) are unchanged and no migration code runs; existing specs continue to load and dispatch as before.
- **SC-003** Creating a spec via the relabeled choice dispatches `/speckit.companion.specify` and seeds `profile: "turbo"`, identical to pre-change behavior (verifiable on a fresh spec).
- **SC-004** The settings page still lists the `templateProfile` options as Standard / Turbo / Off.
- **SC-005** No surface (picker, setting description, README, template-profiles doc, screenshot) shows mixed or stale picker-choice wording — every reference to the *choice* uses the new label.

## Assumptions

- **Final wording = "SpecKit Companion."** The issue offered "SpecKit Companion" or "Companion" (flagged TBD). Defaulting to the longer form because it parallels the stock "SpecKit" picker choice and matches the brand wording the docs already use; the clarify step can downshift to "Companion" if preferred.
- **The label↔value mismatch is acceptable.** A user who set `templateProfile: turbo` will see "SpecKit Companion" in the picker; this is mitigated by the picker description tying the two together, per the issue's stated decision.
- **Ceremony-axis wording is out of scope.** The "Turbo mode needs the companion spec-kit extension…" warning, the `templateProfile` Standard/Turbo/Off enum labels, and the standard-vs-turbo wording in `docs/template-profiles.md` stay unchanged — those name the ceremony/speed axis, not the picker-choice axis.
- **The setting key stays `turboWorkflowPicker`.** Renaming the key would be a breaking settings migration and is explicitly out of scope.

## Approach

Pure label/copy edits across four files plus a conditional screenshot — no new modules, no value/type changes, each edit independent of the others.

- `src/features/spec-editor/specEditorProvider.ts` (~L175, `buildTurboWorkflowEntry`) — change `displayName: 'Turbo'` → `'SpecKit Companion'`; reword the adjacent `description` to frame it as pinning the leaner SpecKit Companion (turbo) `/speckit.companion.*` pipeline regardless of the project default.
- `package.json` (~L1056, `speckit.companion.turboWorkflowPicker`) — reword the `markdownDescription` so the quoted choice name reads "SpecKit Companion" (drop the "(Turbo)" from the *choice name*; keep the rest).
- `README.md` (~L291) — update the `"SpecKit Companion (Turbo)" choice` wording to the new picker label.
- `docs/template-profiles.md` (~L86) — update the picker-choice label wording; leave the ceremony-axis Turbo/Standard description intact.
- `docs/screenshots/create-spec.png` — re-shoot **only if** it currently shows "Turbo"; overwrite in place (never rename/delete — README URLs are pinned to `main`).
- Untouched on purpose: `TemplateProfile` type, `companion-turbo`/`companion-standard` preset ids, `profileDispatch` routing, `TURBO_WORKFLOW_NAME`/skill names, the `turboWorkflowPicker` setting key, and every persisted `turbo` value.
