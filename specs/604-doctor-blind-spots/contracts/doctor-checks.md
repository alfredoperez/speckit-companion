# Contract: the health check's readers

The identifiers below are what tests and callers code against. The four pinned by the spec's Verbatim Constraints — `.trace-lost`, `verified[]`, `_lost_entries`, `speckit-extension/scripts/doctor_checks.py` — appear exactly as the spec wrote them.

## `check_trace(feature_dir, ctx=None) -> (CheckStatus, [Finding])`

Module: `speckit-extension/scripts/doctor_checks.py`. Signature unchanged.

| Input state | Status | Findings |
| --- | --- | --- |
| No trace file, no `.trace-lost`, no unattributed failures | `CheckStatus("trace", "skipped", …)` with the current wording, unchanged | `[]` |
| No trace file, `.trace-lost` has entries | `CheckStatus("trace", "ran")` | one `Finding("trace", "problem", …)` whose detail contains at least one marker line verbatim |
| Trace file present, `.trace-lost` has entries | `CheckStatus("trace", "ran")` | the existing lost finding plus the existing count note, both unchanged |
| `.trace-lost` present but empty or unreadable | as the "no marker" row for the same trace state | no lost finding |

The lost finding's `data` payload keeps its current key, `{"lost": [...]}`, capped at five entries.

## `check_verification(feature_dir, ctx) -> (CheckStatus, [Finding])`

New function in `speckit-extension/scripts/doctor_checks.py`.

| Input state | Status | Findings |
| --- | --- | --- |
| `implement` has a step-level `complete` in `history[]`, and `verified[]` is absent, empty, or not a list | `CheckStatus("verification", "ran")` | exactly one `Finding("verification", "problem", …)` naming that the step closed with nothing verified |
| `implement` has a step-level `complete` and `verified[]` has at least one entry | `CheckStatus("verification", "ran")` | `[]` |
| No `implement` step-level `complete` in `history[]` | `CheckStatus("verification", "skipped", …)` — no record | `[]` |
| No `.spec-context.json`, unreadable context, or empty `history[]` | the shared `_no_record` skip | `[]` |

A `verified[]` entry recorded against any step other than `implement` still counts, because the list is not step-scoped; the check asserts only that the run verified something before implement closed.

## `CHECKS` registration

Module: `speckit-extension/scripts/doctor.py`.

```python
CHECKS = ("record", "triage", "bleed", "drift", "completion", "verification", "template", "trace", "chat")
```

`verification` is dispatched through the existing `run_check(report, "verification", lambda: _via("doctor_checks", "check_verification", feature_dir, ctx))`, so a raised exception is contained by `run_check` and the doctor never halts the host command.

## `step-start` command part

File: `speckit-extension/presets/_parts/step-start.md`.

- Fenced into `speckit-extension/nodes/<step>/_frame.md` for `specify`, `plan`, `tasks` and `implement`, using the standard markers:
  ```
  <!-- speckit-companion:part step-start -->
  <!-- /speckit-companion:part step-start -->
  ```
- The fence is placed **above** the `speckit-hooks` fence in every frame.
- The part text is byte-identical across all four commands, as `check-shape-parity` assertion (a) requires. It refers to the step generically (`<step>`, its in-progress `<status>`), in the same idiom `speckit-hooks` uses.
- The command it instructs:
  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step <step> --status <status> --kind start --by extension
  ```
- The six content nodes that stamp the start today no longer do so: `plan/gather-context.md`, `tasks/tasks-doc.md`, `implement/implement-exec.md`, `specify/resolve-dir.md`, `specify/resolve-dir-git.md`, `auto/resolve-dir.md`. The fast-path folds in `specify/finalize.md` are unaffected and keep their explicit `plan`/`tasks` starts.

## Idempotency guarantee relied on

`spec_context._has_step_start(log, step, substep=None)` returns true when any prior `start` exists for that pair. With `history[]` append-only, a second start for the same step is refused and the earlier timestamp stands. This is existing behaviour; the contract records it because the part now depends on it against the extension's dispatch seed.
