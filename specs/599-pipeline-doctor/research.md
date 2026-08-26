# Phase 0 Research: Pipeline Doctor

Every entry below settles a choice the spec deliberately left open. Nothing here re-decides something the codebase already settles.

## Where the tracer attaches

**Decision**: Wrap `main()` in `write-context.py` and `compute_drift()` in `drift.py`, writing one line per invocation at exit — success or failure, including every early return.

**Rationale**: Both scripts already funnel every path through a single entry point, and both return `0` on failure by design (the never-fail-the-host contract), printing the reason to stderr and then discarding it. Wrapping the funnel is the only placement that catches the paths that currently vanish — an unresolvable feature directory, a refused lifecycle key, a `--feature-dir` / `--tasks-file` mismatch — because those are exactly the early returns. Instrumenting individual capture writers would miss all of them.

**Alternatives considered**: A decorator on each capture writer in `capture.py` — rejected because it traces only calls that got far enough to reach a writer, which is the opposite of the failures we care about. A wrapper shell script around every invocation — rejected because the command bodies would have to change, which violates the "zero prompt weight" requirement.

## How the trace file avoids being committed

**Decision**: `trace.py` writes `specs/<NNN>/.trace.jsonl` and, on first write in a spec directory, also writes a one-line `specs/<NNN>/.gitignore` containing `.trace.jsonl` if no rule already covers it.

**Rationale**: The trace must be gitignored in every project that installs the extension, not just in this repository, and the extension cannot edit a user's root `.gitignore` as a side effect of a capture call. A self-ignoring sibling is a single idempotent write that needs no user action, no installer step, and no coordination with whatever ignore rules the project already has. This repository additionally gets an explicit root-level rule so the intent is visible where a reader looks for it.

**Alternatives considered**: Writing under a system temp directory — rejected because the trace must survive the run and be findable by a doctor invocation days later, and because per-spec location is what lets the doctor scope a trace to a spec without parsing it. Adding the rule at install time — rejected because it would not cover a spec directory created by a project that installed before this feature.

## Size cap strategy

**Decision**: Cap by bytes with a single rewrite when the cap is exceeded, keeping the most recent entries and prepending one `truncated` marker line recording how many lines were dropped.

**Rationale**: The doctor's questions are all about the most recent run, so the newest entries are the valuable ones. A marker line keeps the report honest: "N earlier entries rolled off" is a statement the doctor must be able to make rather than silently reporting a partial count as a total. Rewriting only on overflow keeps the hot path a plain append.

**Alternatives considered**: Rotating to `.trace.jsonl.1` — rejected as more files to ignore, more files to read, and no added value for a diagnostic that only looks backwards a short way. An unbounded file — rejected outright by the requirement.

## What the drift audit treats as ground truth

**Decision**: Shell out to `drift.py --json` and consume its result object; never reimplement drift computation inside the doctor.

**Rationale**: `compute_drift` is already the deterministic authority, already distinguishes `tracked` from `unspeced`, and already reports skips with reasons instead of claiming a clean run it did not earn. Reimplementing it would create exactly the second source of truth this feature exists to eliminate — and a doctor whose drift answer could itself be wrong would be worthless. Shelling out also means the doctor automatically inherits every future fix to drift.

**Alternatives considered**: Importing `compute_drift` directly — a reasonable option and materially the same, but running the script as the user would run it also exercises its argument surface and its own tracing, so a defect in the drift *entry point* is visible to the doctor rather than bypassed.

## How a drift flag is classified

**Decision**: Three classifiers applied in order — `self-inflicted` when every changed file for a capability is a companion-owned bookkeeping artifact (`.spec-context.json`, `.spec-context.events.jsonl`, `.trace.jsonl`, the capability's own living-spec documents); `suspect-baseline` when the baseline commit predates a rename that git can follow, or when the capability's spec commit is not an ancestor of `HEAD`; `real` otherwise. Any capability `drift.py` reported as skipped is carried through as `unknown` with its reason.

**Rationale**: These are the two false-alarm shapes the issue names, and both are decidable from information git already has. Keeping `unknown` distinct from `real` and from `clean` is required by the capture runtime's own living spec — a probe that cannot determine an answer must never return the negative — and the drift warning's credibility problem is precisely that it currently collapses those cases.

**Alternatives considered**: A confidence score — rejected because a number invites the same "is it real?" shrug the warning already produces; a named class tells the developer what to do.

## Detecting a false drift-clean claim

**Decision**: Compare the recomputed verdict against any recorded claim in the run record's `verified[]` entries and against the trace's recorded drift verdicts for the same spec, and report a contradiction as a false claim naming both sides and their timestamps.

**Rationale**: The claims that need catching are the ones an AI wrote into the record — `verified[]` is where a run says what it checked — and the trace is where a drift evaluation's own answer is recorded from now on. Showing both sides with timestamps is what makes the finding actionable rather than accusatory: a claim that was true when made and false now is a different problem from a claim that was never true.

**Alternatives considered**: Trusting only the trace — rejected because it would make the check non-retroactive, and retroactivity is the feature's headline property.

## How the status-versus-display triage is decided

**Decision**: Run the two readings that already exist as separate modules — `status-context.py` (record-driven) and `derive-from-files.py` (file-driven) — plus a Python re-derivation of the step badges from `history[]`, then report "records disagree with each other" when the record-driven reading and the badge derivation disagree, and "records are consistent" when they agree but the reported symptom persists.

**Rationale**: The viewer derives its stepper badges from `history[]` alone, with no file-existence fallback once context is present. So a spec whose `status` says `specified` while the Plan step is not offered is almost always a `history[]` gap — a missing step-level complete — not a display bug. Deciding the triage from the same two readings the system already computes is what makes the verdict trustworthy; a third bespoke reading would just be another opinion.

**Alternatives considered**: Reading the TypeScript derivation through a Node shim — rejected because the doctor must run in a repository with no Node toolchain, and the derivation rule is small enough that a Python twin is cheap to keep honest with a shared fixture set.

## How debug mode changes the command bodies

**Decision**: Add `presets/_parts/debug-timing.md` and append it conditionally in `assemble-nodes.py` and `build-commands.py` — the same conditional-append seam that already exists for the orchestrator part — driven by a top-level `debug: true` in `.specify/companion.yml` read through `companion_config`.

**Rationale**: Reusing the orchestrator seam means debug mode introduces no new way to change command text, which the companion-commands living spec explicitly requires (bodies are generated from single-sourced parts, and a second mechanism forks a shared rule silently). Because the part is appended rather than toggled inside a body, an off render contains no instrumentation text at all — the requirement's "absent, not dormant" — and the frozen-golden gate keeps the off render byte-identical to today's bodies.

**Alternatives considered**: A conditional block inside each node body — rejected because the text would be present-but-inactive, failing the requirement, and would have to be duplicated across five commands. A recipe that swaps the node order — rejected because a recipe replaces the whole order, so a project using both a recipe and debug would lose one of them.

## Why debug affects only the next dispatch

**Decision**: The flag takes effect when bodies are rendered, and rendering happens at install/reconcile time, not at dispatch time.

**Rationale**: This is not a constraint we are choosing so much as one the architecture already imposes — the agent reads a static file, so a body already handed to a running command cannot change underneath it. Naming it explicitly in the spec and the documentation prevents the obvious support question.

**Alternatives considered**: None; the alternative would be dynamic command text, which does not exist in this design.

## What the `--chat` audit reads and how it fails

**Decision**: Match transcript files under `~/.claude/projects/` by the project path and intersect them with the step's recorded time window from `history[]`; parse defensively, and on any parse failure or missing directory print one line and exit successfully.

**Rationale**: The time window is the only reliable join key — the record knows exactly when each step ran, and the transcripts are timestamped. Defensive parsing is mandatory because the transcript format carries no compatibility promise; the audit is documented as a builder's tool for exactly that reason, and treating a format change as a crash would violate the never-fail-the-host contract that every script in this runtime inherits.

**Alternatives considered**: Requiring an explicit transcript path — rejected as friction for the common case, though it remains available as an override. Parsing strictly and erroring on unknown fields — rejected outright.

## Merging the two-call task close

**Decision**: Keep both existing flags working and add a single-call form that appends and folds in one invocation, with the fold still performed only by the main agent.

**Rationale**: The two-call shape exists for a real reason — parallel workers must append without contending, and only the main agent may fold — so the merge must not remove the ability to do those separately. What it can remove is the main agent's own redundant second call for its own task, which is the common case and half of all capture calls during implement. The tracer is what makes the change safe to land: the call counts before and after are directly comparable.

**Alternatives considered**: Replacing the two flags outright — rejected because a fanned-out worker running the merged form would put a second writer on the shared record, which the capture runtime's living spec forbids.

## Batching the end-of-step capture volley

**Decision**: Add `--batch` taking one JSON document containing the whole end-of-step volley (verified, decision, concern, coverage, step summary, last action), applied through the same additive-capture writers in one read-modify-write.

**Rationale**: The capture flags are already additive and already compose in a single call — the volley is several calls only because the command bodies emit them separately. One document through the same writers changes the number of file rewrites, not the record, which is exactly what the trace's per-file rewrite count will demonstrate.

**Alternatives considered**: Making the existing repeatable flags accept more values — rejected because the volley spans six different flags with different shapes; a single document is simpler to emit from a command body and simpler to validate.

## How the bench proves failures are recorded

**Decision**: Add an oversized variant alongside the existing three sizes and a failure-injection fixture that removes `.specify/feature.json` and makes the context file unwritable, then assert the doctor reports both failures with reasons.

**Rationale**: A tracer validated only on happy paths proves nothing about the case it exists for. These two injections reproduce the exact conditions behind the reported mark-complete failures in foreign repositories, so the fixture doubles as a regression test for the completion check.

**Alternatives considered**: Simulating failures with monkeypatching in unit tests only — kept as well, but not sufficient on its own: the bench runs the real scripts through the real command bodies, which is where a "the body never called it" failure shows up and a unit test cannot.
