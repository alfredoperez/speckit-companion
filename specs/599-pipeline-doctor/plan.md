# Implementation Plan: Pipeline Doctor — Run Tracing, Debug Mode, and a Health Check

**Branch**: `599-pipeline-doctor` | **Spec**: [spec.md](./spec.md) | **Issue**: [#599](https://github.com/alfredoperez/speckit-companion/issues/599)
**Size**: `oversized` (22 projected files / 34 projected tasks)

## Summary

Give every Companion run a free record of itself and a read-only health check that recomputes reality instead of trusting what the AI claimed. The work lands almost entirely in the spec-kit half of the repo (`speckit-extension/`), which already owns every script that touches `.spec-context.json`. Three mechanisms carry it: a tiny append-only tracer wired into the single funnel each capture script already has, a new `doctor` command backed by a set of focused check modules that read the run record, the on-disk artifacts, and the tracer's log, and a `debug` flag in `.specify/companion.yml` that makes the existing body-assembly pipeline append an extra instrumentation part — so turning debug off removes the instruction text rather than leaving it dormant.

Nothing here is a new mechanism where an old one exists. The tracer hooks `main()` in `write-context.py` and `compute_drift()` in `drift.py` — the two places every capture and every drift evaluation already passes through. The doctor's drift audit shells out to `drift.py --json` as ground truth rather than reimplementing drift. The status-versus-display triage compares the two readings that already exist as separate modules: `status-context.py` (what the record says) against `derive-from-files.py` (what the files say), which is precisely the disagreement the viewer's step derivation trips over. The debug switch reuses the conditional-part append that `assemble-nodes.py` already performs for the orchestrator part.

No new dependency and no new language: everything is stdlib Python 3, matching every sibling script, and the tests join the existing `speckit-extension/tests/` suite.

## Project Structure

```
speckit-extension/
  scripts/
    trace.py                    NEW  append-only tracer: write one line, read/tail, size cap, self-ignore
    doctor.py                   NEW  the doctor CLI: argument surface, orchestration, human + --json report
    doctor_checks.py            NEW  record audit, status-vs-display triage, completion check, template fidelity
    doctor_drift.py             NEW  drift audit: recompute via drift.py, classify each flag, detect false claims
    doctor_chat.py              NEW  --chat transcript audit (Claude-first, degrades to one line)
    write-context.py            EDIT wrap main() so every invocation — including every early return — traces
    drift.py                    EDIT trace each compute_drift call's inputs and verdict
    companion_config.py         EDIT read the top-level `debug` flag off .specify/companion.yml
    assemble-nodes.py           EDIT append the debug-timing part when debug is on
    build-commands.py           EDIT same conditional for the non-node bodies
    capture.py                  EDIT --batch: one call for the end-of-step capture volley
    task_sync.py                EDIT fold --append + --materialize into a single task close
  presets/_parts/
    debug-timing.md             NEW  the instrumentation text, present only in a debug render
  commands/
    speckit.companion.doctor.md NEW  the command body (hand-authored + part fences, like living-drift)
  extension.yml                 EDIT declare the doctor command
  tests/
    test_trace.py               NEW
    test_doctor.py              NEW
    test_doctor_drift.py        NEW
    test_doctor_chat.py         NEW
    fixtures/doctor/            NEW  broken-record, false-claim, flattened-tasks, stuck-completion fixtures
  README.md                     EDIT document the doctor command and the debug flag
  CHANGELOG.md                  EDIT [Unreleased] entry
  docs/                         EDIT publishing/command tables gated by check-command-emissions.py

examples/todo-claude/bench/
  lib.mjs                       EDIT fold the doctor verdict into scoring
  run-all.mjs                   EDIT oversized variant wiring
  fixtures/                     EDIT failure-injection fixture (missing feature.json, unwritable context)

.gitignore                      EDIT ignore specs/*/.trace.jsonl in this repo
```

**Structure Decision**: Everything ships in `speckit-extension/` because that is where the capture runtime, the command bodies, and the manifest live; the VS Code half is untouched by this feature. New behavior is split across five small modules rather than one large `doctor.py`, per the constitution's modular-architecture principle — each check family is independently testable and the `--chat` audit stays quarantined in its own module because it is the one part built on an unstable external format.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — the debug switch is a declarative flag in the project's own `.specify/companion.yml`, read through the existing `companion_config` loader; no new configuration mechanism and no fork required to change it. |
| II. Spec-Driven Workflow | **PASS** — the doctor observes the Specify → Plan → Tasks → Implement pipeline and never alters it. It is read-only, never gates a step, and never writes a lifecycle status, so the Active → Completed → Archived lifecycle and its explicit-user-action rule are untouched. |
| III. Visual and Interactive | **JUSTIFIED VIOLATION** — this feature ships as a command with no VS Code surface. See Complexity Tracking. |
| IV. Modular Architecture for Complex Features | **PASS** — the doctor exceeds the 3–4 file bar and is therefore split by responsibility (CLI/report, record checks, drift audit, transcript audit, tracer), matching how the capture runtime is already decomposed into `spec_context` / `capture` / `task_sync` / `living_spec_fold`. |

Re-checked after Phase 1 design: unchanged. The contracts introduce no new configuration surface, no lifecycle writer, and no additional file beyond the structure above.

### Complexity Tracking

| Violation | Why it is needed | Simpler alternative rejected |
|---|---|---|
| No VS Code visual component (Principle III) | The doctor diagnoses the capture runtime, which lives entirely in the spec-kit half and must be runnable on a repository that has no VS Code session — including retroactively, on a spec finished weeks ago, and inside the bench harness where scoring calls it headlessly. A webview would also be unable to run the `--chat` audit, which reads local transcript files. | Shipping a panel first was rejected because it would put the diagnosis behind the very display the doctor exists to put on trial: a display bug would hide its own evidence. A panel that surfaces the doctor's `--json` output is a natural follow-up once the verdict shape has settled, and is deliberately out of scope here. |

## Phased delivery

The spec's eight user stories map to five delivery phases; the first two are the usable MVP on their own.

1. **Doctor v0** (US1) — `trace.py` reader stubs aside, this phase reads only the run record and the on-disk files, so it works retroactively from day one.
2. **Self-trace** (US2) — the tracer wired into `write-context.py` and `drift.py`; the doctor grows its trace-derived sections.
3. **Deeper verdicts** (US3, US4, US5) — drift audit, completion check, template fidelity.
4. **Debug mode** (US6) and the **chat audit** (US7) — independent of each other and of phase 3.
5. **Bench validation** (US8) — the oversized variant, the failure-injection fixture, and doctor verdicts in scoring.

The two quick wins folded in from the issue — a single-call task close and a `--batch` end-of-step capture — ride with phase 2, because the tracer is what proves they record exactly what the two-call versions recorded.
