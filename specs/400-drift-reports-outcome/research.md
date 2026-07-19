# Phase 0 Research: Drift and fold-back summaries report outcome, not intent

## Decision 1 — The all-skipped summary shape

**Decision**: When the feature is enabled and at least one capability is configured, the summary always ends with a counts line of the form `0 checked, 9 skipped (spec not yet committed)`. The parenthetical names the reason only when every skip shares one reason; with mixed reasons it is omitted, because the per-capability skip notes above already carry them and a single parenthetical would misattribute one reason to all. The `✓ All capabilities in sync.` claim is emitted only when the checked count is greater than zero and no checked capability drifted, and it then carries the count: `✓ All 4 checked capabilities in sync.`

**Rationale**: The reported harm is a reader who scrolls to the last line. Making the last line the counts line means the honest signal is exactly where the dishonest one used to be. Keeping the success glyph on the genuinely-clean path preserves the positive signal the README documents.

**Alternatives considered**: Emitting `✓ All capabilities in sync (0 checked)` — rejected, because it keeps the success glyph and the reassuring phrase on a run that verified nothing, which is the defect wearing a footnote. Dropping the summary line entirely on an all-skipped run — rejected, because silence after nine skip notes reads as truncated output rather than a deliberate verdict.

## Decision 2 — Where the checked count lives

**Decision**: `compute_drift` gains a `checked` integer on its result object, alongside the existing `capabilities` and `skipped` lists. It equals `len(capabilities)` by construction.

**Rationale**: It is redundant with the list length, but the README documents `--json` as the surface tooling and CI consume, and a consumer branching on "did this run actually check anything" should read a named field rather than infer it from an array length — the inference is exactly the reasoning error the human-readable bug encodes. Making it explicit data is the fix generalized from prose to the machine surface, which is FR-005.

**Alternatives considered**: Leaving consumers to compute `len(result["capabilities"])` — rejected per the reasoning above. Adding a boolean `ran` flag — rejected as strictly less informative than the count, which answers both "did it run" and "how much".

## Decision 3 — Exit code for an all-skipped run

**Decision**: Stay 0 in every case. No new exit code.

**Rationale**: The module's documented contract, stated in its own docstring and in the README, is that drift never halts — a surrounding workflow or CI may gate on findings, the command itself does not. A skip is not a failure: it is the correct behavior when there is no committed baseline to diff against, and making the correct behavior exit non-zero would break every existing caller and turn adoption day into a red build. The caller's real need — telling "clean" from "did not run" — is better served by the `checked` field than by a status code, because a single non-zero code could not distinguish "skipped everything" from "found drift", and those demand opposite responses (commit your specs vs. fold your changes back).

**Alternatives considered**: Exit 2 on all-skipped — rejected: it conflates a healthy adoption state with an error, breaks the never-halts contract, and would fire on the exact run the report describes as correct behavior. A `--strict` flag that exits non-zero when nothing was checked — rejected for this change as scope the ticket did not ask for; the `checked` field is the primitive such a flag would be built on, so adding it later stays cheap and is a clean follow-up if a CI caller ever wants it.

## Decision 4 — How the fold reports a dropped change

**Decision**: `apply_deltas` returns the updated text together with a per-verb count of what it actually applied, and `fold_living_spec` renders its existing counts line from those applied numbers. When any parsed change was dropped, the same line gains a short trailing note naming how many and that their target headings were not found.

**Rationale**: The counts line already exists and is already read as the fold's receipt; correcting its numbers at the source is the contained fix. Surfacing the dropped count in the same line satisfies FR-009 without inventing a new failure mode — the fold is documented as best-effort and stays best-effort.

**Alternatives considered**: Raising or returning an error when a change matches nothing — rejected: unmatched targets are an explicitly supported best-effort case (a spec may name a requirement that lives in a different capability), so failing would break working flows. Logging one line per dropped heading — rejected as noisy for a routine case; the count plus the existing per-capability line is enough to prompt a look.

## Decision 5 — Not widening to the sibling reporting surfaces

**Decision**: An audit of the other reporting lines under `speckit-extension/scripts/` was run and its findings are recorded for separate triage. None are changed here.

**Rationale**: The audit surfaced ten further instances of the same intent-vs-outcome class, including a second, mechanically distinct one in `drift.py` itself (a git failure yields an empty changed-file list, so the capability is reported positively in sync rather than skipped). Folding any of them in would widen this change past its own spec, which is the specific failure the previous ticket hit. They are reported so they can be filed and sized on their own.

**Alternatives considered**: Fixing the second `drift.py` instance here, since it is the same file and arguably the same sentence of the ticket — rejected, narrowly: it is a different mechanism with its own test surface and its own correct-behavior question (should an unreachable spec commit be a skip or a hard error?), and answering that question inside this change would leave the spec describing something narrower than the diff.
