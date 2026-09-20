# Found, not proposed — run-record

Things seen while adopting this area and deliberately left out of the specs.

## Belongs to another area

- Review comments, viewer collapse state and other editor-owned keys in `.spec-context.json`. They are written by the spec viewer; here they matter only as "a lifecycle write must not eat them", which is already a requirement.
- Telemetry events emitted when a step is captured. Owned by the telemetry area.
- The sidebar's status labels, badges and sort order. They read the record; rendering it is the sidebar's behaviour, not the record's.
- The pipeline stepper and the pipeline graph. They derive display from history, and the record's contract already says what history holds.
- Drift detection and living-spec folding, which read the record but are their own capability.
- Spec discovery and folder resolution, beyond the one sentence that says a capture writes to the spec it is working on.
- The per-step capture instructions inside the specify, plan, tasks and implement command bodies. What they record is here; how a step is written is the pipeline's shape.

## True but not worth a requirement

- Self-trace file naming (`run_trace` rather than `trace`) exists only to avoid shadowing a standard library module. An implementation constraint, not product behaviour.
- The lock lives outside the spec folder so a stray lock file cannot be committed. The part that bit us, that both halves resolve it under one fixed root instead of their own temporary directory, is now stated in "two writers at once both land".
- The trace file ignoring itself in git. Housekeeping; the size cap is a requirement because it makes every count a floor.
- Exact field names inside a decision, verification or concern object. Named in the record-a-run requirement only because outside tools read the file; the finer shape is schema detail.
- Stdlib-only, no third-party dependency in the capture scripts. A build rule, and the rules file was dropped from this run.

## Dev tooling, not shipped behaviour

- `check_capture.py`, `check_report.py`, `check_quality.py` and the other `check_*` evals. They grade a run during development of the extension itself; the shipped run-health command is the doctor.
- The doctor's transcript audit and the debug timing switch. Both recorded under `## Uncovered` in the doctor spec with the reason.
- The build-time renderers and instruction budget scripts. Part of building command bodies, not of recording a run.

## Deliberately unstated

- Which python version, which JSON library, how the file is formatted on disk.
- Retry counts, timeout values and lock refresh intervals. Tuning numbers a rewrite may change without breaking anything a person relies on.
