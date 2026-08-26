# Phase 0 Research: Status shows the decisions a run actually recorded

## Where the two forms come from

`capture.py`'s `_coerce_entry` is the single writer for the decision/verified/concern lists. It takes whatever a command body passes to `--decision` and stores a **dict**: a JSON object carrying the identity key is kept as-is (unknown keys preserved), and anything else is wrapped as `{"decision": "<the raw text>"}`. So every entry a real Companion run writes is an object. A bare string only ever appears when a human hand-authored the context file or when an older run predates the coercion — which is exactly the demo-fixture population that kept the defect green.

`status-context.py`'s `_decisions` filters on `isinstance(d, (str, int, float))`, so it drops every dict — i.e. everything a real run records — and the report prints its "(none recorded)" branch, which reads as a fact rather than a failure.

## Decision — mirror the TypeScript reader that already gets this right

**Decision**: Widen `_decisions` to the same accept-both-shapes rule the viewer's `pickEntryList` in `src/features/spec-viewer/stateDerivation.ts` already implements — a non-empty string passes through as itself; a dict whose `decision` is a non-empty string renders as that text; everything else is dropped.

**Rationale**: The viewer and the status report are two readers of one field, and the viewer's version is the one that has been correct all along. Copying its rule rather than inventing a second one means the two surfaces cannot disagree about which decisions exist — the "one fact, one derivation" trap the review checklist names. It also keeps the `why`/`rejected` detail on the entry rather than discarding it at the boundary, which is what FR-006 asks for.

**Alternatives considered**: Normalizing at *write* time (store decisions as plain strings) — rejected: it would throw away `why` and `rejected`, which the viewer's Overview renders and which are the most valuable part of the capture. Migrating existing context files to one shape — rejected: `.spec-context.json` is a shared, append-tolerant document with several producers; a reader that accepts both forms is cheaper, needs no migration, and keeps working for hand-authored files.

## Decision — return entries, not just text, and flatten only at the print boundary

**Decision**: `_decisions` keeps returning a list of display strings so the `RESOLUTION` JSON line and its consumers see no shape change, and the supporting detail stays reachable through a separate helper that returns the full entries.

**Rationale**: `resume` parses the `RESOLUTION` line and `decisions` is already typed there as a list of strings, both in `speckit-extension/tests/test_context.py` and on the TypeScript side. Changing that element type to an object would be a silent contract break for a fix whose whole point is that a silent break went unnoticed for months. FR-005 pins this: nothing about the output shape changes except that the missing decisions appear.

**Alternatives considered**: Returning entry dicts and flattening in `_print_summary` — rejected: it changes the `RESOLUTION` payload's element type, which is the one thing another program reads. Rendering `why`/`rejected` inline on the default report — rejected by the spec's Assumptions: verbose output is separate, opt-in work.

## Decision — the sibling-reader audit is a finding to report, not necessarily code to write

**Decision**: Audit every reader of `verified[]`, `concerns[]`, `expectations[]`, and `context[]` and fix only the ones that share the string-only assumption; name the ones that are already correct in the report rather than touching them.

**Rationale**: The audit found exactly one other Python reader of these lists — `doctor_drift.py`'s `_recorded_claims`, which reads `verified[]` and already branches on `isinstance(entry, dict)` before falling back to `str(entry)`. On the TypeScript side, `pickEntryList` serves decisions, verified, and concerns and handles both shapes; `expectations[]` and `context[]` are written by `append_string_list`, which stores plain strings only, so a string-only reader of those is correct by construction rather than by accident. `status-context.py` is the only defect. Writing speculative widening into readers that are already right would add untested branches for data that cannot occur.

**Alternatives considered**: Widening every list reader for symmetry — rejected: `expectations`/`context` have a string-only writer, so the extra branch would be dead code that no test can reach honestly.

## Decision — pin the failure direction before the fix

**Decision**: Run the new mixed-form test against the pre-fix `_decisions` and confirm it fails there, before landing the widened version.

**Rationale**: The review checklist's rule for a new gate applies to a new regression test too — a test that only ever ran against the fixed code proves nothing about the bug it claims to pin. The defect here is precisely a test population (all-strings fixtures) that could not see the bug, so demonstrating the new test's failure direction is the part that makes it a real regression test.

**Alternatives considered**: Trusting the test by inspection — rejected: that is the same reasoning that let the original defect ship.
