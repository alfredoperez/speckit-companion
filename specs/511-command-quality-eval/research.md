# Research: Command-Quality Eval

## D1 — Where the checker lives

**Decision**: `.claude/skills/eval-speckit-extension/check_quality.py`, sibling to `check_capture.py`.
**Rationale**: the eval family already lives there (`check_capture.py`, `check_living_spec.py`) and is documented in `docs/capture-and-timing.md` as "a tracked project skill — edit it here". The skill dir ships in neither the `.vsix` nor the spec-kit archive, so no packing-list (`package-manifest.py` / `.vscodeignore`) impact.
**Alternatives considered**: `speckit-extension/scripts/` — rejected: everything there is candidate runtime for consumer installs and would drag in packing/manifest questions for a dev-only tool; `examples/todo-claude/bench/` — rejected: the bench is a Node harness for stock-vs-companion scoring, not a per-spec deterministic checker.

## D2 — How tests reach a script outside the test tree

**Decision**: `speckit-extension/tests/test_check_quality.py` inserts the skill dir on `sys.path` and imports `check_quality` via `importlib` — the exact pattern `test_capture_fields.py` uses for `scripts/write-context.py` (a hyphen-free module name, so plain import works).
**Rationale**: CI's `unittest discover -s speckit-extension/tests` picks it up with no workflow change; the repo checkout guarantees the relative path exists.
**Alternatives considered**: a separate test file inside the skill dir — rejected: it would be outside every discovery path and never run in CI.

## D3 — Verbosity budgets

**Decision**: lines are the primary unit, characters the secondary (catches pathological single-line files); two bands per artifact, all in one `BUDGETS` table:

| artifact | healthy (484/509/510) | WARN ≥ | FAIL ≥ |
|---|---|---|---|
| spec.md | 93–145 lines | 250 lines / 30k chars | 450 lines / 60k chars |
| plan.md | 45–60 lines | 150 lines / 15k chars | 300 lines / 30k chars |
| tasks.md | 70–101 lines | 250 lines / 20k chars | 450 lines / 40k chars |

**Rationale**: WARN sits ~1.7–2.5× above the largest healthy fixture (headroom for a legitimately bigger feature), FAIL at ~3–5× (a balloon no healthy run produces). tasks.md scales with task count, so it gets the widest band. Missing artifacts and tiny artifacts (fast-path pointers) are never flagged — only oversize is a defect here; capture completeness belongs to `check_capture.py`.
**Alternatives considered**: budgets relative to the spec's own `size` field — rejected for v1: only `normal` fixtures exist to calibrate against, and a wrong `simple` label would silently loosen the gate.

## D4 — Timing-waste checks from `history[]`

**Decision**: three checks, thresholds as module constants:
- `trusted-boundaries` — for each pipeline step present in history, the span is *trusted* only when a step-level start precedes a step-level complete, both by a deterministic writer (`extension`/`derive`/`cli`/`user`, same set as `check_capture.py`). Untrusted reached steps → WARN (stock-family runs are legitimately best-effort; only Companion-current runs give 4/4).
- `burst-journaling` — ≥ 3 `by:ai` task completes whose first→last span ≤ 1.0s → FAIL. This is the absolute pre-#509 bug shape; it complements `check_capture.py`'s relative `task-cadence-span` (5% of the implement step).
- `step-duration-outlier` — among trusted spans, a step > 8× the median of the others *and* > 300s → WARN, never FAIL (wall-clock varies by machine/model; a hard gate would flap).
**Rationale**: reuses the deterministic-writer vocabulary already documented in `docs/capture-and-timing.md`; each check answers one yes/no question with the gate named in the detail string.
**Alternatives considered**: re-read counts (the issue mentions them) — rejected: `history[]` does not record file reads, and inventing a proxy would be noise; noted as follow-up.

## D5 — Static prompting checks

**Decision**: line-based scan of command-body sources with three rules baked in:
- **Never-prompt roster** (12 files in `commands/`): the four `after-*` hooks, `living-drift`, `living-sync`, `living-coverage`, `mark-complete`, `status`, `resume`, `classify`. Any non-negated prompt-instruction phrase → FAIL with the line quoted.
- **Must-ask roster**: the stock-named `speckit.clarify.md` carrier in `presets/companion-standard/commands/` (resolved as a sibling of `--commands-dir`); zero ask-phrases → FAIL.
- **Scanner hygiene**: word-bounded phrase patterns (`ask the user`, `prompt the user`, `wait for the user('s)`, `present exactly one question`, `confirm with the user`, `ask up to N questions`, `one question at a time`, `await/wait for … answer/approval/confirmation`) — a bare `ask` must not match `tasks` (verified against main: every current hit in the roster is that substring). Fenced code blocks are skipped (the #443 lesson: templates inside fences aren't instructions to the agent reading the body). A negation window (`do not`, `don't`, `never`, `without`, `rather than`, `instead of`, `no `) within the 40 chars before a match suppresses it. A roster file missing on disk → FAIL loudly (the #432/#455 shrinking-scan-surface rule).
**Rationale**: checkable text analysis, no AI simulation — exactly the issue's scope. The roster is enumerated (not prefix-derived) deliberately: the never-prompt contract is per-command semantics, not a namespace property (`specify`/`plan`/`implement` share the prefix but legitimately mention prompting in negated form).
**Alternatives considered**: deriving the roster from `extension.yml` descriptions ("never halts") — rejected: descriptions are prose, not a contract field; a reworded description would silently drop a file from the scan.

## D6 — Severity & exit-code model

**Decision**: rows are `PASS | WARN | FAIL | INFO`; `--strict` exits non-zero only when a FAIL exists. WARN is the judgment-call tier (budgets, outliers, untrusted spans) and never blocks.
**Rationale**: mirrors the issue's "non-blocking WARN tier where thresholds are judgment calls" and keeps CI green on debatable signals while hard regressions fail.
**Alternatives considered**: `--strict-warn` escalation flag — deferred; nothing needs it yet.
