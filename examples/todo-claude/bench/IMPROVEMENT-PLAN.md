# SpecKit Companion — parallelism + quality improvement loop

**Owner:** autonomous (Claude). **Status:** in progress. **Started:** 2026-06-16.
This is the durable plan + running log. It must survive conversation compaction — resume from here.

## Why this exists

The faithful 2-mode bench surfaced two gaps in the Companion pipeline:

1. **Parallelism never fires.** `tasks` correctly marks `[P]` tasks, but `implement` runs them strictly sequentially — no subagents — across every observed run. Strengthening the prompt **twice** (soft → hard directive) did **not** change it (user saw no `Task` blocks, no wall-clock speedup). So **prompt strength is not the lever**; the fix is structural.
2. **Quality has an intermittent edge-case gap (#342).** On the hard "Tags" feature the run sometimes ships a real bug (remove the tag you're filtering by → dead empty filter) that acceptance + capture + isolated rubric all miss; only an adversarial comparative reviewer catches it. n=3 so far → 2 miss / 1 catch (variance, not guaranteed).

Goal: iterate on the nodes/prompts **using the bench as the test rig**, running each step myself, until parallelism truly fires and quality is reliably good. Then commit (version bump + CHANGELOG + golden re-bless).

## How I run it myself (key enabler)

The `/speckit.companion.*` steps are just markdown instructions dispatched to an AI — **I am that AI**, so I can execute each step directly in a sandbox AND spawn subagents (Task/Agent), letting me observe firsthand whether the instructions actually lead to parallel execution. Work only in the sandbox; never touch real specs.

- Sandbox: `examples/bench-sandboxes/todo-companion` (gitignored).
- Re-bake after a node/prompt change: `node examples/todo-claude/bench/sync-templates.mjs --only companion` then `git restore .specify/`.
- Pristine + arm: `node examples/todo-claude/bench/run-all.mjs prep --size hard --no-open`.
- The command bodies I'm iterating: `speckit-extension/nodes/**`, `speckit-extension/presets/_parts/**`.
- After ANY node/prompt change: re-assemble + re-bless + verify, all must stay green:
  `python3 speckit-extension/scripts/assemble-nodes.py` → `build-commands.py` → `capture-golden.py` → `assemble-nodes.py --check` → `check-shape-parity.py` → `python3 -m unittest discover -s speckit-extension/tests -p "test_*.py"`. Also sync the 4 node `_frame.md` part-fences to the part source (they don't auto-fill).

## Pending uncommitted starting point

- `presets/_parts/parallel.md` — strengthened to a directive (already done; insufficient alone).
- `nodes/implement/implement-exec.md` — batch-by-batch, subagents default, main-agent serial journaling (already done; insufficient alone).
Treat these as the baseline to iterate past, not the answer.

---

## Track A — Make parallelism actually fire

Run each step, observe **closely** (did subagents spawn? did a wave run concurrently? wall-clock vs sum-of-task-times?), improve the node/prompt, re-run until satisfied, then move on.

- **A1 · specify** — low priority (single feature spec, little to fan out). Note investigation reads.
- **A2 · plan / gather-context** — does investigation fan out reads across subagents? Improve `nodes/plan/gather-context.md` if not.
- **A3 · tasks — RESTRUCTURE (user's idea).** Stop relying on inline `[P]` markers. Emit tasks as explicit **waves / phases** that are parallel *by construction*: each wave is a set of tasks that genuinely touch different files with no intra-wave dependency, designed up front for concurrency. Consider splitting "edit the component" and "write its test" into separate same-wave tasks so a subagent does each. Iterate `nodes/tasks/tasks-doc.md` (+ `_frame`) until waves are clean and truly independent. Re-bless golden each time.
- **A4 · implement — CORE.** Following `implement-exec`, do I actually spawn one subagent per wave-task and run the wave concurrently, main agent journaling serially? Likely the prose still loses to "single cohesive job." **Experiment with making it STRUCTURAL**: an explicit, mechanical fan-out the AI executes ("for each task in this wave, issue a Task call now; await all; then journal each") rather than a nudge. Test the "truly parallel" pattern: subagent A edits `Component.tsx`, subagent B writes `Component.test.tsx`, concurrently.
- **A5 · resolve the lever question:** is prose ever enough, or must the orchestrator structurally drive the Task fan-out? Record the answer.

**Track A success:** a hard-size implement where ≥1 wave runs as observable concurrent subagents, wall-clock meaningfully < sequential, journaling clean (no `.spec-context.json` / `tasks.md` races), build + acceptance still pass.

---

## Track B — Quality: validate #342 levers; decide if user stories are needed

Experiments on hard "Tags", measuring whether the **filter-revert edge case** (the recurring bug) is caught. The comparative reviewer is the judge (it's the only gate that caught it). n≥3 per config where feasible.

- **B0 · baseline** — current lean spec (no Edge Cases section). Bug rate? (establishes the variance floor.)
- **B1 · + `### Edge Cases`** — restore stock's section in `nodes/specify/draft-spec.md`. Does it prevent the bug? At what ceremony cost?
- **B2 · + `### Key Entities`** — does it surface cascade/lifecycle (tag delete → assignment cleanup)?
- **B3 · + adversarial task-review agent** — an agent that reviews the generated `tasks.md` against the spec and flags missing edge-case / teardown coverage *before* implement. (User's idea: "adversarial agents actually testing against the tasks created.") Could ship as an `after: tasks` hook.
- **B4 · user stories?** — test whether re-adding user stories (vs lean FR-only) changes quality, or whether B1–B3 suffice. **Decide explicitly:** are the lite levers enough, or do we need US / a different structure?

**Track B success:** a config (sections ± adversarial review) where the edge case is reliably caught/prevented across ≥3 runs with minimal added ceremony; a clear verdict on user-stories.

---

## Capture (do this continuously)

Append each experiment to the **log section below**: hypothesis · what changed · what I observed (parallel? bug caught?) · verdict · next. Route durable learnings per the usual rules (review-checklist / CLAUDE.md / command files / issues). Update **#344** (parallelism findings) and **#342** (quality findings) as conclusions firm up.

## Guardrails

- Sandbox-only. Never touch real specs, never merge.
- Don't commit until BOTH tracks have a validated solution; then bump `speckit-extension/extension.yml` version + CHANGELOG + re-bless golden + both parity gates + python tests green.
- Preserve runs/conversations during investigation (don't reset mid-analysis).
- Keep the lean default lean: prefer composable hooks/recipes (#317) for opt-in rigor over base-pipeline bloat.

## Resume checklist (after compaction)

1. Read this file top-to-bottom.
2. `git status` — confirm the pending `parallel.md` / `implement-exec.md` changes are still there (the baseline).
3. Re-bake the sandbox; prep hard.
4. Continue from the lowest-numbered unfinished experiment in the log below.

---

## Running log

_(append newest at the bottom)_

- **2026-06-16 — setup.** Plan written. Baseline pending changes in place (parallel.md directive + implement-exec batch wording) — confirmed insufficient by a live run (no Task blocks, ~8.9 min sequential implement on hard/Tags, 13 tasks, 9 marked [P]). Next: Track A3 (restructure tasks into waves) and A4 (structural fan-out in implement).

- **2026-06-16 — A3 + A4 redesign + LIVE fan-out validation (hard/Tags).** Rewrote three nodes: `tasks-doc` now emits **dependency-leveled waves** (`## Wave N`, no inline `[P]`), `implement-exec` does a **mechanical per-wave fan-out** ("issue one Task per wave-task in a single message"), and the shared `parallel.md` part teaches the wave model. Fixed the one real downstream break: `taskProgressService.ts` now matches `Phase|Wave` headers. Re-blessed golden + both parity gates + 90 python tests green; `tsc` clean.
  - **Ran implement myself in the sandbox, wave by wave, genuinely spawning subagents.** 14 tasks across 5 waves. Every wave fanned out as **observable concurrent subagents** (one batch of Task calls per wave). Wave 2 (5 tasks): durations 14.7–42.5s in one batch → wall-clock ≈ 42s vs ~117s sequential (**~2.8× speedup**). The waves `tasks.md` came out clean and parallel-by-construction. **A3 + A4 mechanically work.**
  - **The real lesson — same-wave seam drift.** Every same-wave pair that shared an *evolving interface* drifted at the seam, because concurrent subagents can't see each other's choices: Wave 2 `TagFilterBar`/its test disagreed on export shape (named vs default) + `aria-pressed`; Wave 3 `TagsPage`/its test disagreed on export shape; Wave 4 `TodoItem`/`TodoList`/`TodosPage` collided on a prop name (`onToggle` used for both checkbox and tag toggle → duplicate JSX prop, breaks completion). Two Wave-4 subagents **self-flagged** the collision honestly but couldn't fix it without editing each other's files. None were catastrophic — all fixed by a **cheap main-agent reconciliation** (typecheck/build + fix the seam). After reconciliation: **26/26 tests pass incl. the hard acceptance oracle; build clean.**
  - **Design conclusions (folding into the nodes):** (1) keep the mechanical fan-out — it works; (2) `implement-exec` needs an explicit **per-wave reconciliation step** (main agent typechecks/builds after each wave and fixes cross-file seam drift before the next wave) — this is the missing piece that makes truly-parallel robust; (3) `tasks-doc` same-wave pairs must **pin the export shape (named vs default) + key signature** in the contract, and a tight producer→consumer prop-threading chain should be **one coherent task**, not N concurrent ones (split only genuinely independent files). Applying these next, then re-bless.
  - **A5 answer (lever question):** prose alone never drove the fan-out in prior runs; the **artifact** (pre-computed waves) + a **mechanical** instruction ("N Task calls in one message") is what makes it fire. Structure beats exhortation. The orchestration can stay in-prose IF the tasks artifact hands the model ready-made batches and the main agent owns a reconciliation pass.

- **2026-06-16 — Track B: adversarial spec/tasks review (B3 + B4 verdict).** Ran one adversarial reviewer agent over the hard/Tags `spec.md` + `plan.md` + `tasks.md`, lensed for destructive cascades / active-state-vs-mutation / persistence / boundary gaps. Result was decisive:
  - **Found a real HIGH-severity gap the lean format missed:** deleting a todo orphans its tag assignments — the spec *asserts in prose* "deleting a tag or a todo cleanly drops assignments," but only FR-011 (tag→assignment) is specified/tasked/tested; the **todo→assignment** direction has no FR, no task, no test → a growing localStorage leak. This is the **same class** as the recurring #342 "filter-revert" bug (state-vs-mutation cascade), generalized.
  - **Also caught a MEDIUM spec self-contradiction:** duplicate tag names are explicitly allowed, but `data-testid`s are keyed by name → collision breaks the graded contract. Nothing reconciles the two.
  - **No false positives.** It explicitly marked the well-covered items covered (empty-name rejection FR-006/SC-007, ephemeral filter, empty-list boundary) and refused to invent findings — exactly the behavior that makes it trustworthy as a gate.
  - **B4 verdict — user stories are NOT the answer; the adversarial reviewer is.** Re-adding user-story ceremony (or mechanically restoring stock's `### Edge Cases`/`### Key Entities`, B1/B2) is example-agnostic bloat that wouldn't have caught the todo-orphan cascade — it's not an "edge case" you'd list up front, it's a cross-feature interaction you only see by *attacking the artifact*. A general adversarial pass over spec+tasks catches the real bug class without the ceremony. B0/B1/B2 multi-run bug-rate experiments deprioritized (the lever is found).

- **2026-06-16 — B3 BUILT + validated (user chose: default node, not preset).** Added `nodes/tasks/review-gaps.md` (kind=author, reads=[tasks-doc], writes=tasks.md) to the `tasks` command order between `tasks-doc` and `handoff`. The node runs an adversarial pass (in a subagent when available) over spec+plan+tasks, and **closes** high-severity gaps by appending wave-format remediation tasks (+ a new FR in spec.md when needed); it's explicitly told to be a skeptic, not a generator (zero findings on a clean spec is valid). Re-blessed golden + both gates + 90 python tests green. **Validated live:** against the built hard/Tags artifacts it found exactly the one real HIGH gap (todo-deletion orphans assignments), dismissed the non-gaps with no false positives, added `FR-013`+`SC-008` to spec.md and `## Wave 6` (T015–T017) to tasks.md in correct format. Both tracks now built + validated on branch `parallelism-quality-loop` (uncommitted).

- **2026-06-16 — adversarial review → diverse-lens PANEL (spend banked time on quality).** Sharpened `review-gaps` from one generalist reviewer into a **small concurrent panel** — distinct lenses (destructive cascades / active-state-vs-mutation / persistence & boundary), issued in one message, merged + deduped on the main agent under the same skeptic rule. **Validated the precision risk** by running the 3-lens panel against the *now-complete* Tags artifacts (FR-013 + Wave 6 already close the cascade): all three ran concurrently and each returned **"no gaps in this lens,"** every claim citing the FR+task that covers it — zero false positives, zero invented work. Best signal: the persistence lens surfaced a genuine latent robustness candidate (malformed/legacy localStorage past the seed default) but **judged it a pre-existing app-baseline issue, not a feature gap, and declined to manufacture a finding.** Panel raises recall without flooding noise. Re-blessed golden + gates + python tests green. (Byproduct: the malformed-localStorage robustness gap is a real *app* improvement, not this feature's — noted, not acted on.)

- **2026-06-16 — seam-drift PREVENTION (sharpening the one real weakness).** The 3 earlier same-wave drifts were always the same two things: export named-vs-default, and a shared handler/attr named two ways. Reconciliation caught them cheaply, but prevention is sharper. Two node edits: `tasks-doc` now emits the shared interface **once** as a wave `> Contract:` line (not twice in two task descriptions that can disagree) + a **default-to-named-export** convention; `implement-exec` now **hands every wave subagent its `> Contract:` line verbatim**. **Validated decisively:** deleted the exact pair that drifted twice (`TagFilterBar` + its test — export shape + `aria-pressed`), regenerated both concurrently with one shared contract → **agreed first-try, zero reconciliation**, 5/5 then 27/27 full suite, build clean. Reconciliation stays as a backstop; prevention drops the drift rate to zero on the case that previously failed. Re-blessed golden + gates + python tests green.

- **2026-06-16 — A2: plan investigation fan-out (user ask — bank time for the adversarial review).** Rewrote `nodes/plan/gather-context.md` from a trivial 2-file read into a **mechanical investigation fan-out**: derive the independent investigation areas from the spec (store pattern, routing/nav, persistence, component conventions, test setup), then "issue one subagent per area, all in a single message," each returning a **distilled finding** (pattern to copy + concrete paths + conventions), never a file dump. Re-blessed golden + gates + python tests green. **Validated live** on the Tags spec: 5 read-only investigators ran concurrently and each returned a tight area summary — a double win, **wall-clock + main-context budget** (the main agent never read the whole codebase in). This is the time A2 banks to pay for B3's adversarial pass, so quality rises without a net slowdown. The README's "reads different parts of the codebase side by side" claim now has real structural teeth.

- **2026-06-16 — full loop proven + capture ticket filed.** Closed the loop end-to-end on the sandbox: the review node's `Wave 6` remediation (T015–T017, the todo-orphan fix) was **implemented via the same parallel fan-out** — 3 subagents against a tiny pinned `removeTodoAssignments(todoId)` contract, this time with **zero seam drift** (small crisp contract held), build clean, 15/15 tests incl. the new cascade test + hard acceptance. So the complete improved pipeline composes: **adversarial review finds a real bug → adds an FR + wave-format tasks → parallel implement fans out → bug fixed → tests green.** Filed **#346** (JSONL write-ahead-log + JSON read-model for parallel-safe per-task capture) per the user — spec-only, not built. Remaining: a from-scratch full-pipeline run (regression confidence), #346 build, and commit/ship when the user calls it.
