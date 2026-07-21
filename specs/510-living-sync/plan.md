# Implementation Plan: One command to sync living specs from your current changes

**Branch**: `510-living-sync` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

## Summary

Give direct-coding developers one pass that brings every affected living spec up to date with their current changes, uncommitted work included. The deterministic half is a new opt-in `--working` mode on the existing drift detector, which extends each capability's changed-set from "commits since the spec's baseline" to "baseline → working tree, plus untracked files" — and that same derivation becomes the sync's grouping engine, so the read-only report and the sync can never disagree. The AI half is a new hand-authored command body, `/speckit.companion.living-sync`, that runs the working-tree drift in JSON mode and applies the established update-not-regenerate flow to each drifted capability, scoped to its own changed files, then reports synced/skipped and leaves the spec edits uncommitted. A small VS Code sidebar action on the Living Specs view dispatches the command.

## Project Structure

```
speckit-extension/
├── extension.yml                                    # + living-sync in provides.commands (no version bump)
├── commands/speckit.companion.living-sync.md        # NEW — the sync command body
├── commands/speckit.companion.living-drift.md       # + document --working
├── scripts/drift.py                                 # + --working mode (default path byte-identical)
├── tests/test_living_specs.py                       # + working-mode drift tests
├── README.md                                        # + command table row, living-sync section, --working
├── docs/commands.md                                 # + living-sync entry, families table
└── CHANGELOG.md                                     # + [Unreleased] entry

src/features/specs/
├── livingSpecsCommands.ts                           # + speckit.livingSpecs.sync handler
└── __tests__/
    ├── livingSpecsCommands.test.ts                  # + sync dispatch test
    └── manifest.test.ts                             # + title row for the new command

package.json                                         # + command + Living Specs view/title menu item
README.md                                            # + sidebar action in the Living Specs paragraph
docs/sidebar.md                                      # + title action in the Living Specs reference
```

**Structure Decision**: no new modules. The deterministic grouping lives where drift already lives (`drift.py`); the sync command is a sibling of the other hand-authored `living-*` bodies (they are not node-assembled, so no golden/parity work); the sidebar action follows the exact registration pattern of `speckit.livingSpecs.adopt`.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — opt-in by presence (living specs config), no new settings, no provider-specific logic. |
| II. Spec-Driven Workflow | PASS — strengthens the spec-anchored loop (fold-back for direct devs); touches no pipeline phase or lifecycle transition. |
| III. Visual and Interactive | PASS — ships a visual surface (Living Specs view title action) alongside the CLI command. |
| IV. Modular Architecture | PASS — no webview work; changes slot into existing focused modules. |

Re-checked after Phase 1 design: unchanged, no violations. No Complexity Tracking needed.

## Key Design Points

- **One derivation (FR-008)**: the sync command body consumes `drift.py --working --json` — capability grouping, exempt filtering, own-spec-doc exclusion, skip reasons, and never-fails semantics all come from the one existing engine. No new grouping script.
- **`--working` mechanics (FR-002, FR-007)**: with the flag, the per-capability changed-set is `git diff --name-only <baseline>` (baseline commit → working tree: commits since + staged + unstaged + deletions) unioned with `git ls-files --others --exclude-standard` (untracked), de-duplicated. The tracked-vs-unspeced classification scopes its context-file scan the same way. Without the flag, every git invocation is the exact command run today — the default path stays byte-identical.
- **Update-not-regenerate (FR-004)**: the command body carries the same insistence the viewer's Update action dispatches (`buildLivingUpdatePrompt` in `livingSpecsCommands.ts`): edit the spec file in place, keep every requirement/clarification/scenario the change doesn't invalidate, revise only what the changed files require. Deleted files are named as behavior removals.
- **Never-committed specs (FR-010)**: drift already skips them with `spec.md not yet committed`; the command body surfaces that skip and points at `/speckit.companion.living-adopt`, never redrafts.
- **Uncommitted-by-design (FR-005)**: the body explicitly forbids committing; spec edits stay in the user's working tree.
- **Gating (US3)**: the sidebar action lives only in the Living Specs view title, and that view is already gated on `speckit.companion.installed` — same degradation as adopt/drift.
- **Inventory gates**: the new command must land in `extension.yml` `provides.commands`, both doc tables (README + `docs/commands.md`), and be re-emitted to the agent dirs via `specify extension add ./speckit-extension --dev --force` so `check-command-emissions.py` stays green. Emissions are gitignored dev symlinks — nothing extra to commit.

## Phase 1 artifacts

- [research.md](./research.md) — decisions and alternatives
- [data-model.md](./data-model.md) — sync plan / report shapes
- [contracts/living-sync.md](./contracts/living-sync.md) — command, flag, JSON, and UI identifiers
