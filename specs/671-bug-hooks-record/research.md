# Research

## Hook events and bug folder

**Decision**: register `before_bug_assess`, `after_bug_assess`, `before_bug_fix`, `after_bug_fix`, `before_bug_test`, `after_bug_test`; the record goes in `.specify/bugs/<slug>/`.
**Rationale**: read from spec-kit's bundled `bug` extension 1.0.2 (`core_pack/extensions/bug/commands/*.md`). Each command resolves `BUG_SLUG` and `BUG_DIR = .specify/bugs/<BUG_SLUG>`, checks `hooks.before_bug_<stage>` before work and `hooks.after_bug_<stage>` only after it writes its report. Early stops skip the after hook.
**Alternatives considered**: hooks in the bug extension itself (not ours to edit).

## A missing bug folder

**Decision**: a hook for a folder that does not exist records nothing.
**Rationale**: spec-kit's assess creates `BUG_DIR` before it checks `hooks.before_bug_assess` (`speckit.bug.assess.md` line 78), and fix and test require an existing folder. So a missing folder means a wrong slug, and creating it would leave an orphan.
**Alternatives considered**: creating the folder, as the spec's edge case first said.

## How the hook knows the slug

**Decision**: the hook command tells the model to pass the slug the bug command just resolved.
**Rationale**: hooks carry no variables, and the bug command states its slug in its reply. The writer refuses a slug that is not a plain folder name, so a bad slug records nothing.
**Alternatives considered**: guessing from the newest folder (wrong when two bugs run).

## Bug stages as steps

**Decision**: a `--bug` write allows `assess`, `fix` and `test` as steps, with no status change.
**Rationale**: the writer already records steps outside the canonical order without ranking them and without a status, so a bug record never moves a spec status. Allowing the three names only with `--bug` keeps the typo guard for specs.
**Alternatives considered**: adding them to the canonical steps (would leak into spec status logic).

## Outcome

**Decision**: on finish, the writer reads the stage's field from its report (`assessment.md` Verdict, `fix.md` Status, `test.md` Result) and stores it as the entry's `did`.
**Rationale**: deterministic, no model wording; the report already holds it.
**Alternatives considered**: the model passing `--did` (drifts).

## Not counting engine runs twice

**Decision**: the page shows the engine run when one exists, otherwise the record.
**Rationale**: an engine-run bug also fires the hooks, so both sources describe the same stages. One source per page means each stage appears once.
**Alternatives considered**: merging the two (two clocks for one stage, and nothing to gain).
