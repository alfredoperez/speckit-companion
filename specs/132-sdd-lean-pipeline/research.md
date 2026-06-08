# Phase 0 Research: Pipeline + the sdd-lean Preset

All unknowns the plan raised are resolved below. Source of truth: the installed GitHub-source spec-kit CLI (`specify`, ~0.9.5.dev0), its `src/specify_cli/presets.py`, the shipped `presets/lean` and `presets/scaffold`, `docs/reference/presets.md`, and ADR 0003 (#3, #7).

## R1 — Reshaping lever: command overrides, not raw template files

**Decision**: `sdd-lean` reshapes output by overriding the **commands** (`type: command`, `replaces:` the core `speckit.specify`/`plan`/`tasks`/`implement`), exactly as the shipped `lean` preset does — not by shipping only `spec-template.md`/`tasks-template.md` files.

**Rationale**: The core command markdown embeds/copies its own structure (e.g. the core specify does `cp .specify/templates/spec-template.md`; the `lean` preset's commands embed the shape inline). A preset that provided *only* a `spec-template.md` would not reach a stock command that hard-codes the core template path. Preset **command** overrides, by contrast, are registered into every agent command dir at install time, so "stock `/speckit.specify`" literally becomes the preset's command. This is the proven path (`lean` works this way) and is what makes User Story 1 (stock command → SDD shape) real.

**Alternatives considered**: (a) Template-only override — rejected: doesn't flow into the hard-coded core copy step. (b) Forking the core commands in the VS Code extension prompt text — rejected: violates the spec-kit-native preset model and the extension-isolation rule. We may *additionally* ship `type: template` overrides for `spec-template.md`/`tasks-template.md` as belt-and-suspenders for any preset-aware consumer, but the command override is the load-bearing piece.

## R2 — `features.sddLean: false` maps to preset removal, not just `disable`

**Decision**: "On" = the `sdd-lean` preset is installed (and enabled). "Off" = the preset is **removed** (or its command overrides are otherwise un-registered), not merely `disable`d.

**Rationale**: spec-kit registers preset *command* overrides into agent dirs at install time and explicitly notes that `disable` "skips during file resolution but their commands remain registered." Because `sdd-lean` reshapes via command overrides (R1), `disable` alone would leave the SDD-lean `speckit.specify.md` sitting in `.claude/commands/` — the stock shape would NOT return, breaking FR-007. Therefore the off-path must `specify preset remove sdd-lean` (which "cleans up its registered commands") to restore stock commands. `disable`/`enable` remain useful for *template*-type overrides but are insufficient for command reversal.

**Alternatives considered**: Rely on `disable` — rejected (leaves stale command files). Re-register core commands manually — rejected (duplicates what `remove` already does).

## R3 — Real selection command is `preset add`, not `preset use`

**Decision**: The selection vocabulary is `specify preset add sdd-lean [--dev <path>] [--priority N]`, with `enable`/`disable`, `set-priority`, `remove`, and `resolve` for management. The spec's FR-002 phrase `specify preset use sdd-lean` is a backlog inaccuracy and is corrected to `specify preset add` in the contracts; the *intent* (select via one action) is unchanged.

**Rationale**: `specify preset --help` exposes `list/add/remove/search/resolve/info/set-priority/enable/disable/catalog`. There is no `use` subcommand. Local/dev install is `specify preset add --dev ./speckit-extension/presets/sdd-lean`.

## R4 — Relationship to the shipped `lean` preset: standalone, not a dependency

**Decision**: `sdd-lean` is a **standalone** preset that fully `replaces:` the four pipeline commands with the SDD-lean shape. It does not depend on or compose-require `lean`.

**Rationale**: `lean` keeps user stories (its specify lists "user scenarios"; its tasks says "user stories in priority order"). The whole point of `sdd-lean` is to drop user stories and switch to a files/dependencies task axis, which `lean` does not do. Sharing a base would couple us to `lean`'s evolution for no gain. If both are installed, deterministic priority ordering decides the winner (R5); we document that `sdd-lean` should sit at a higher precedence (lower priority number) than `lean` when a user wants the SDD shape.

## R5 — Composition & precedence are native and deterministic

**Decision**: Use spec-kit's priority-ordered resolution as-is. Lower priority number = higher precedence; resolution stack is project-overrides → presets (by priority) → extensions → core. `sdd-lean` installs at a documented default priority that sits above the `companion` extension (presets always outrank extensions) and is tunable via `set-priority`.

**Rationale**: `presets.py` implements `list_by_priority` (equal priority → alphabetical by id) and the documented stack. Composition strategies `replace`/`prepend`/`append`/`wrap` are present in `VALID_PRESET_STRATEGIES` in the installed build (the reference doc that calls append/prepend/wrap "planned" lags the code). `sdd-lean` uses plain `replace` for the four commands — simplest and fully supported — satisfying FR-003/FR-009 without relying on the newer strategies. `specify preset resolve <name>` is the documented debugging path to prove which layer wins (used in quickstart + SC-005 verification).

**Alternatives considered**: `wrap` the core commands to inherit future core edits — rejected for step 4 (more moving parts; the SDD shape is a full replacement, not an addendum).

## R6 — VS Code setting → preset action seam

**Decision**: `speckit.features.sddLean` (boolean, default `true`) lives in the root `package.json` `contributes.configuration`. The VS Code extension reads it and, on change/activation, shells out to the spec-kit CLI: `true` → ensure `sdd-lean` is added+enabled; `false` → `specify preset remove sdd-lean` (per R2). The project file `.specify/sdd.config.yml` `features.sddLean` is the persisted, CLI-agnostic source of truth; the VS Code setting mirrors/drives it.

**Rationale**: The extension may shell out and write workspace files (allowed); it must not *read* `.specify/**` at runtime for its own behavior, but *acting on* the project via the CLI is a legitimate command, consistent with how the extension already dispatches spec-kit commands. Single-source-of-truth (FR-010): `.specify/sdd.config.yml` wins; the setting is the user-facing control that writes it.

**Alternatives considered**: Have the VS Code extension manipulate `.specify/presets/**` directly — rejected (fragile, bypasses the CLI's registry bookkeeping). Make the setting purely cosmetic — rejected (FR-006 requires it to actually toggle behavior).

## R7 — Dual-extension packaging & isolation

**Decision**: Preset + namespaced commands are **speckit-extension** assets (own README/CHANGELOG, `extension.yml` version, `speckit-ext-v*` release). The four namespaced commands are declared in `extension.yml` `provides.commands` or the installer skips them. The VS Code setting is the only root-`package.json`/`src` change and rides the normal `v*` release.

**Rationale**: The dual-extension rule in CLAUDE.md is explicit; the preset is not packaged in the `.vsix`. Install scaffolding (FR-008) runs both `specify extension add ./speckit-extension --dev` and `specify preset add --dev ./speckit-extension/presets/sdd-lean`.

## Open items intentionally deferred (out of scope for step 4)

- Complexity branching inside the commands (step 5).
- Living specs / drift (step 6) and auto mode (step 7).
- The newer `wrap`/`append` composition strategies for inheriting future core-command edits — revisit if/when the SDD shape needs to track core changes rather than fully replace them.
