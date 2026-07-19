# Contract — the context writer's command line

The command line is the contract this feature must not break. Every flag below is accepted before the change and must be accepted after, with the same behavior, the same printed text, and the same exit code.

## Flags

`--step` · `--status` · `--by` · `--kind` · `--substep` · `--feature-dir` · `--tasks-file` · `--task` · `--append` · `--materialize` · `--mark-complete` · `--finish` · `--advance` · `--did` · `--files` · `--set` · `--living-specs` · `--fold-living-spec` · `--decision` · `--verified` · `--concern` · `--expectation` · `--context` · `--coverage-req` · `--tests` · `--tasks` · `--title` · `--step-summary` · `--classification`

## Dispatch groups

**Additive — all of these run when present in one invocation, each printing its own confirmation line.**

`--classification`, `--set`, `--decision`, `--verified`, `--concern`, `--expectation`, `--context`, `--coverage-req`, `--step-summary`, `--living-specs`, `--fold-living-spec`

The one behavioral change in this feature: today only the first of these takes effect. After the change every one of them does.

**Exclusive — first match wins, in this order, unchanged.**

`--tasks-file`, `--mark-complete`, `--finish`, `--advance`, `--materialize`, `--task`

**Default.** When no additive flag and no exclusive flag is present, the invocation records a step-level lifecycle entry from `--step`, `--status`, `--kind`, `--substep`, and `--by`. When any additive flag is present, the default must not fire — a capture call writes no lifecycle history, exactly as today.

## Exit codes

| Code | When |
|---|---|
| `0` | success, and every best-effort miss — an unresolvable feature directory, a non-canonical step, a write that raised. The writer must never fail its host command. |
| `2` | a malformed `--classification` value. Caller error in the emitting command body, not a runtime miss. |

## Output

One line per action taken, on stdout, in the additive order above followed by the exclusive match. A single-flag invocation therefore prints exactly one line, as it does today. Best-effort skips and warnings go to stderr.

## Compatibility surface for importers

Four things outside this script import it as a module and call its functions directly — the derive-from-files fallback, the status reader, the extension's Python test suites, and the living-spec eval check. Every name they reach for must stay resolvable through `write-context.py` after the split. The names in current use:

`parse_spec_deltas`, `apply_deltas`, `_living_requirement_span`, `parse_task_markers`, `read_ctx`, `atomic_write`, `canonical_log`, `commit_log`, `fill_required`, `resolve_feature_dir`, `_repo_root`, `_git_branch`, `_spec_name`, `_now_iso`, `_is_more_advanced`, `_journaled_tasks`, `_has_complete`

Treat this as a floor, not a ceiling: every public and private name that existed before the split must still resolve through the same module afterward.
