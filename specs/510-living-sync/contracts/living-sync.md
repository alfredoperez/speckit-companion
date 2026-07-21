# Contracts: living-sync

Identifiers below are pinned (spec → Verbatim Constraints) and copied exactly.

## Spec-kit extension command

- Name: `speckit.companion.living-sync` (dispatched as `/speckit.companion.living-sync`)
- File: `speckit-extension/commands/speckit.companion.living-sync.md`
- Registered in: `speckit-extension/extension.yml` `provides.commands` (no `version` change)
- Contract: opt-in by presence of living-specs config; never fails the host; edits only capability spec files, in place; never commits; ends with a synced/skipped report.

## Drift CLI

```
drift.py [--root <dir>] [--json] [--working]
```

- `--working` (new, opt-in): include baseline→working-tree changes and untracked files in each capability's drifted set.
- Exit code: `0` always, both modes.
- `--json` object: existing shape + top-level `"working"` boolean.
- Default invocation (no `--working`): same git commands, identical human output; the JSON adds only the constant `working: false` field.

## VS Code surface

- Command id: `speckit.livingSpecs.sync`
- Title: `Sync living specs from my changes`
- Menu: `view/title`, `when: view == speckit.views.livingSpecs`, group `navigation@3`
- Behavior: dispatches `/speckit.companion.living-sync` through the active AI provider (`executeSlashCommand`), same path and gating as `speckit.livingSpecs.adopt`.

## Update instruction (shared voice with the viewer's Update action)

The command body must instruct, per capability: edit `<spec path>` in place; UPDATE, do not regenerate; keep every requirement, clarification, and acceptance scenario already written; revise only what the changed files require; treat deleted files as removed behavior.
