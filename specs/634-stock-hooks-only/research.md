# Research: Capture plain SpecKit runs with hooks only

## One start command for four hooks

- **Decision**: one command, `speckit.companion.before-step`, registered for `before_specify`, `before_plan`, `before_tasks` and `before_implement`.
- **Rationale**: every hook command shows up in the user's command list. Four near-identical ones would be noise. The agent knows which step it is running, and a table in the body gives it the values.
- **Alternatives considered**: four commands, one per step. More to list and document, no behavior gained.

## Specify's start is read from the clock and written afterwards

- **Decision**: the `before_specify` hook only reads the clock. The `after_specify` hook writes the start with `--at` and then the finish.
- **Rationale**: the spec folder does not exist when specify begins, and `.specify/feature.json` still points at the previous spec. Any write at that moment lands on finished work. The writer already accepts `--at` for a step start.
- **Alternatives considered**: a pending-start file written by a new writer flag. More code and a new file in the user's project for the same result.

## The prompt VS Code prepends stays as it is

- **Decision**: no change to the preamble code. Add a test that a stock command with the extension installed gets the full stock text.
- **Rationale**: the short "the command body carries the protocol" text is chosen by the command's name, `companionRecordsSteps` in `promptBuilder.ts`, so it only ever went to `/speckit.companion.*` commands. Stock commands already get the full stock preamble, which also tells the agent to write per-task summaries. That is why the Tasks card still fills on plain SpecKit runs sent from VS Code.
- **Alternatives considered**: a third preamble mode that drops the agent's own step close in favor of the hooks. It would change four pinned test groups to fix nothing: the agent close and the hook close already coexisted while the preset was installed.

## The preset is removed like the older leftovers

- **Decision**: `companion-standard` joins the set the reconciler removes once. The add, enable and stale-refresh branches go.
- **Rationale**: the reconciler already does exactly this for `companion-turbo`, `companion-lean` and `sdd-lean`. Removal restores the stock command bodies, which was verified on spec-kit 1.0.10.dev0 and v0.8.5 during the wrap work.
- **Alternatives considered**: leave installed presets alone. Every existing user would keep the wrapped commands forever, and nothing would ever refresh them.

## The Steering sidebar's Companion "Templates" group goes

- **Decision**: remove the group, `readCompanionTemplates`, its two context values and their tests.
- **Rationale**: it lists the files under `presets/companion-standard/commands`. With the preset gone it would never render. Dead code that names a deleted folder misleads.
- **Alternatives considered**: repoint it at the shared parts. Those are build inputs, not something a user opens.

## The doctor's burst warning ignores the extension's own finishes

- **Decision**: `doctor_checks.py` counts only `by: ai` task finishes toward "journaling was batched".
- **Rationale**: on a hooks-only run every task finish comes from the `after_implement` sync in one call, so any run with three tasks would be warned for doing the right thing. `check_capture.py` and `check_quality.py` already make this exemption.
- **Alternatives considered**: exempt by workflow name. The writer is the real cause, so key on the writer.

## Golden files and their checks are deleted, not emptied

- **Decision**: delete `tests/golden/`, `--bless`, `golden_path`, the golden check and the stock timing-fence check. `check_shape_parity.py` stays for the part-region check over the seven namespaced bodies.
- **Rationale**: an empty carrier list makes those checks pass while checking nothing, and the build would print "0 match golden".
- **Alternatives considered**: keep the machinery for a future preset. No such preset is planned.

## Committed fixtures change through the CLI

- **Decision**: regenerate `.specify/extensions.yml`, `.specify/extensions/.registry` and the seven `.claude/skills/speckit-*` bodies by running `specify` in the worktree, then keep only those files from the result.
- **Rationale**: they are `specify init` output. Hand edits drift from what the CLI writes. The seven skills still carry an older preset build's text, marked `source: preset:companion-standard`.
- **Alternatives considered**: leave the skills as they are. The repo's own stock commands would keep the wrapper this change removes.
