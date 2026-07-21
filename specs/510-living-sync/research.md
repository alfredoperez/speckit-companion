# Research: One command to sync living specs from your current changes

## Decision 1 — The sync's grouping engine is `drift.py --working`, not a new script

**Decision**: extend `drift.py` with an opt-in `--working` flag and have the `/speckit.companion.living-sync` command body consume `drift.py --working --json` as its sync plan.

**Rationale**: drift already does everything the sync needs to group changes — resolver membership (most-specific-first, nested-project boundaries), exempt globs, own-spec-document exclusion, per-capability baselines, skip reasons, and the never-fails contract. FR-008 (and this repo's "one fact, one derivation" rule) forbids a second membership derivation; the issue itself asks for the drift `--working` mode as part of the same feature, so the read-only report and the sync consume the identical computation by construction.

**Alternatives considered**: a dedicated `living_sync.py` grouping script — rejected as a second derivation that would drift from the report; teaching the AI to run raw `git status` + resolver calls in the command body — rejected because prose-driven git plumbing is exactly the unreliable path the capture-runtime spec warns against.

## Decision 2 — Working-tree changed-set = `git diff <baseline>` ∪ untracked

**Decision**: in working mode, a capability's changed files are `git diff --name-only <baseline-commit>` (that is, baseline → working tree) plus `git ls-files --others --exclude-standard`, de-duplicated.

**Rationale**: dropping `..HEAD` from the existing diff makes git compare the baseline against the working tree directly, which covers commits since the baseline AND staged AND unstaged changes AND deletions in one invocation — the issue's "optionally also include commits" resolves to "always", with no second git call and no double-reporting (one diff = one occurrence per file). Untracked files are invisible to `diff` and need the standard `ls-files --others --exclude-standard` (respects .gitignore).

**Alternatives considered**: `git status --porcelain` parsing — rejected (re-implements what two purpose-built plumbing commands already answer, and mixes rename/status codes into path parsing); separate `commit..HEAD` + `HEAD` diffs merged — rejected (two calls, manual de-dup, same result).

## Decision 3 — Default drift path stays byte-identical; the flag threads through `compute_drift`

**Decision**: `compute_drift(root, living, working=False)`; the JSON result carries a top-level `"working"` boolean; the human header notes working-tree inclusion only when the flag is on. Without the flag every git command is unchanged.

**Rationale**: FR-007 pins the default output as byte-identical and SC-005 makes the existing suite the regression gate; a mode captured in the result object lets the sync command (and tests) confirm which mode produced the data instead of inferring it.

**Alternatives considered**: a separate `compute_working_drift()` — rejected (duplicates the skip/baseline logic that must stay shared).

## Decision 4 — The command body is hand-authored, mirroring the `living-*` family

**Decision**: write `commands/speckit.companion.living-sync.md` by hand in the same shape as `living-drift.md`/`living-adopt.md` (frontmatter description, python3 prerequisite check, opt-in gate, never-halt tone), carrying the update-not-regenerate insistence text from the viewer's Update action.

**Rationale**: the four existing `living-*` bodies are outside the node-assembly/golden system (zero assembly markers), so no parity/golden work applies; reusing the #475 prompt language keeps one voice for "update, do not regenerate" across the viewer action and the command.

**Alternatives considered**: assembling from nodes — rejected (the family convention is hand-authored; joining the assembly system is unrelated scope).

## Decision 5 — Sidebar action is a Living Specs view title item following `adopt`

**Decision**: `speckit.livingSpecs.sync`, title `Sync living specs from my changes` (verbatim from the spec), Living Specs `view/title` at `navigation@3`, handler dispatching `/speckit.companion.living-sync` via `executeSlashCommand` (it is a real slash command, not prose).

**Rationale**: identical registration/dispatch/gating surface as `speckit.livingSpecs.adopt` — the view is only rendered when `speckit.companion.installed`, which is the family gate the checklist requires; `executeSlashCommand` is correct here because the dispatched text IS a slash command (the #475 prose-prompt rule applies to the per-capability Update action, which stays as-is).

**Alternatives considered**: a Specs-view or command-palette-only surface — rejected (the action is about living specs; their view is its home); dispatching the built update prompt directly from the extension for all capabilities — rejected (the extension would have to re-derive grouping = second derivation, and long multi-capability prose prompts are fragile vs. one slash command the agent expands).
