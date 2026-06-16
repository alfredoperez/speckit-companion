# What changed in the Companion pipeline — step by step

This is the plain record of every change made in the parallelism + quality pass, **what it was before, what it is now, why, and exactly how it was tested.** Branch: `parallelism-quality-loop` (uncommitted). Everything was validated by running the real `/speckit.companion.*` steps by hand in a sandbox and spawning real subagents — not by reasoning about it.

---

## How everything was tested (the rig)

The `/speckit.companion.*` steps are just Markdown instructions handed to an AI. Claude *is* that AI and can spawn subagents, so each step was executed directly against a real app and watched:

- **Target app:** a small but realistic React + TypeScript + Vite todo app (`examples/bench-sandboxes/todo-companion`) — store/reducer pattern, routing, persistence, co-located tests.
- **Feature under build:** the "hard" bench feature — **Tags** (a tags page, per-todo assignment, a filter bar, localStorage persistence). It has real cross-feature interactions, which is what stresses both parallelism and quality.
- **What "verified" means here:** the step actually ran, subagents actually spawned concurrently (observable start/finish times in one batch), the app **built clean** (`tsc` + vite), and the **tests passed** — including a `hard.test.tsx` acceptance oracle that drives the feature end to end.

Every node change was also put through the extension's own gates after editing: re-assemble the command bodies, re-freeze the golden snapshots, run the byte-parity check, and run the 90 Python tests. All green throughout.

---

## Change 1 — The task list is now organized into parallel **waves**

**The file:** `speckit-extension/nodes/tasks/tasks-doc.md`

**Before** — a flat checklist grouped by layer, with inline `[P]` markers:
```text
2. Create tasks.md as a dependency-ordered checklist. Group by execution layer:
   - Setup / Foundational / Core work / Integration / Polish
3. Every task uses the strict format:
   - [ ] [TaskID] [P?] Description with exact file path
   - `[P]` marks tasks touching different files with no incomplete dependency
```
The output looked like one long list where *some* lines had a `[P]` tag the build step was supposed to notice and batch.

**Now** — the work is leveled into waves, each wave a set of genuinely independent tasks:
```text
2. Build the dependency graph, then level it into waves. A wave is a set of
   tasks that can all run at the same time — they touch different files and none
   depends on another in the same wave...
3. ## Wave 1 — <label> (parallel)
   - [ ] T001 Description with exact file path
   - [ ] T002 Description with exact file path
   ... Do not put [P] markers — the wave already means "parallel".
```

**Why:** in earlier runs the `[P]`-marker approach *never actually parallelized* — the build step read the flat list and ground through it one task at a time. The marker asked the model to re-derive batches on the fly, and it didn't. Pre-computing the batches **into the artifact** (waves) removes that step: the wave *is* the batch.

**How it was tested:** generated `tasks.md` for the Tags feature by hand-running the tasks step. It produced 5 clean waves (Types & nav → store + components → tags page → todos-page integration → app wiring), each wave parallel by construction. Confirmed every task line still matches the `- [ ] T###` shape that progress-tracking and capture depend on.

---

## Change 2 — Implement now **fans out one subagent per wave-task**, mechanically

**The file:** `speckit-extension/nodes/implement/implement-exec.md`

**Before** — a soft, optional nudge buried in dependency-order prose:
```text
2. Execute tasks in dependency order:
   - Complete each layer before the next: Setup → ... → Polish.
   - If you support subagents, run each [P] batch concurrently — one subagent per task.
```

**Now** — an explicit, mechanical instruction the model executes:
```text
2. Execute tasks.md wave by wave, in order. A wave is a barrier...
   - Fan out — this is the mechanical default on Claude Code, not an optional
     optimization. Issue one subagent (Task tool) call per task in the wave, all
     in a single message, so the whole wave runs concurrently. A wave of N tasks
     is N Task calls in one batch...
```

**Why:** "if you support subagents, run [P] batches concurrently" lost **twice** in prior runs — the model treated implement as one cohesive sequential job. The lever was never prompt *strength*; it was prompt *shape*. "Issue N Task calls in one message" reads like a script to run, not a suggestion to weigh.

**How it was tested:** ran implement by hand against the 5-wave `tasks.md`, genuinely spawning subagents. **Every wave fanned out as concurrent subagents in one batch.** The widest wave (5 tasks) showed durations 14.7s–42.5s overlapping in a single batch → wall-clock ≈ 42s vs ~117s if sequential (**~2.8×**). Final result: app built clean, **26/26 tests passed** including the hard acceptance oracle.

---

## Change 3 — A **reconciliation pass** after each wave (the honest catch)

**The file:** `speckit-extension/nodes/implement/implement-exec.md` (same step 2)

**Added:**
```text
   - Wait for the whole wave, then reconcile it. Concurrent subagents can't see
     each other's choices, so the seams between same-wave files are where drift
     lands — a test that imported a default export the implementation made named,
     two files that named a shared prop differently. On the main agent,
     type-check/build the touched files and fix any such seam drift before moving on.
```

**Why:** the validation run surfaced a real failure mode of side-by-side work. **3 of 3 same-wave pairs that shared an interface drifted at the seam:**
- A component exported `TagFilterBar` as a *named* export; its test imported it as a *default* → "element type is invalid."
- Two files named a shared handler `onToggle` — one for the checkbox, one for the tag toggle → a duplicate prop that silently broke todo completion. (Two of the subagents *flagged this themselves* but couldn't fix it without editing each other's files.)
None were catastrophic; each was a one-line fix. So the fix is structural: the build step **expects** a quick reconcile pass after each wave, and treats it as normal, not as a failure.

**How it was tested:** the reconciliations were applied live during the run (rename the colliding handler to `onToggleTag`, fix the import to named), after which the build went green and all tests passed. Documented in the running log.

---

## Change 4 — Same-wave tasks now share **one pinned `> Contract:`** (drift *prevention*)

**The files:** `speckit-extension/nodes/tasks/tasks-doc.md` + `speckit-extension/nodes/implement/implement-exec.md`

**Added to tasks:**
```text
   - When same-wave tasks share an interface, write the interface ONCE as a wave
     `> Contract:` line, not twice in two task descriptions... the export shape
     (default to a named export...), the exact signature, and the names of any
     shared handlers or test attributes.
```
**Added to implement:**
```text
   - Hand every subagent in the wave its `> Contract:` line verbatim... so files
     written side by side code to the same shape instead of each guessing.
```

**Why:** reconciliation (Change 3) *catches* drift cheaply, but preventing it is sharper. The drift was always the same two things — export named-vs-default, and a handler named two ways. Writing the interface **once** (instead of describing it in two task descriptions that can disagree) plus a default "use named exports" convention removes the most common drift at the source.

**How it was tested — directly against the case that failed before:** deleted the exact pair that drifted twice (`TagFilterBar.tsx` + its test), regenerated **both concurrently** with one shared `> Contract:` handed to each subagent, and ran them **with no reconciliation pass**. Result: both chose the named export, both used `aria-pressed`, **5/5 passed first-try, zero drift**; full suite 27/27, build clean. Prevention works on the case that previously failed.

---

## Change 5 — A built-in **adversarial reviewer** that closes gaps before implement

**The file (new):** `speckit-extension/nodes/tasks/review-gaps.md`, wired into `speckit-extension/nodes/tasks/_order.yml`:
```text
order:
  - tasks-doc
  - review-gaps      # ← new
  - handoff
```

**What it does:** after `tasks.md` is written, it takes one deliberately adversarial pass over spec + plan + tasks, hunting for the bugs lean specs ship — destructive cascades, active-state-vs-mutation, persistence/boundary gaps. When it finds a real one, it **closes it in the task list** (adds the missing requirement + the task to fix it). It is told to be a skeptic, not a generator: a clean spec yields zero findings.

**Then sharpened to a diverse-lens panel:**
```text
   - If you can spawn subagents, run this as a small panel — distinct lenses,
     concurrently — not one generalist... each attacking a different failure
     family, then merge their findings on the main agent: dedup overlaps, keep
     only gaps tied to a concrete failure.
```

**Why:** this is the quality lever that earns its keep. The question was "do we need user stories?" — answer: **no.** The bug class that ships isn't an "edge case" you list up front; it's a cross-feature interaction you only see by attacking the finished artifact. A panel of distinct lenses (run on the time the plan fan-out banked) raises recall without the ceremony.

**How it was tested — twice:**
1. **Catch power:** ran the reviewer against the Tags artifacts. It found a **real high-severity bug** — deleting a todo orphaned its tag assignments forever. The spec *claimed in prose* this was handled, but no requirement or task implemented it. It added `FR-013` + a remediation wave (T015–T017), and **dismissed the non-gaps without false-positiving.**
2. **Precision under the panel:** ran the 3-lens panel against the *now-complete* spec (gap already closed). All three lenses ran concurrently and each returned **"no gaps in this lens,"** citing the FR + task that covers each. The persistence lens even *found* a latent robustness concern (malformed localStorage) but **judged it a pre-existing app-baseline issue, not a feature gap, and refused to manufacture a finding.**

And to prove the whole loop closes: the remediation it added (T015–T017) was then **implemented by the same parallel fan-out** — 3 subagents, zero drift, 15/15 tests including the new cascade test. Review finds a real bug → adds tasks → parallel build fixes it → tests pass.

---

## Change 6 — Plan now **fans out the codebase investigation**

**The file:** `speckit-extension/nodes/plan/gather-context.md`

**Before** — fanned out reading *two files* (trivial):
```text
1. ...load spec.md and constitution.md if present.
   - If you support subagents, fan these reads out in parallel (one per area).
```

**Now** — fans out understanding the *codebase* before designing:
```text
2. Investigate the codebase in parallel — this is the default on a host with
   subagents... derive the independent investigation areas (store pattern,
   routing/nav, persistence helper, component conventions, test setup), then
   issue one subagent per area, all in a single message... each returns a
   distilled finding... never a dump of file contents.
```

**Why:** the slow part of planning isn't reading the spec — it's understanding where the feature attaches. That work is naturally parallel (different areas of the codebase), and doing it in subagents saves **both wall-clock and main-context budget** (the planner gets five tight summaries instead of reading the whole app in). That banked time is what pays for the adversarial panel — so quality goes up without a net slowdown.

**How it was tested:** ran the investigation for the Tags spec — 5 read-only investigators (store / routing / persistence / components / tests) ran **concurrently**, each returning a distilled area summary with concrete file paths and conventions, not file dumps. Together they form exactly the research basis a good plan needs.

---

## Change 7 — The GUI progress tracker understands "Wave" headers

**The file:** `src/speckit/taskProgressService.ts`

**Before:** `line.match(/^#{2,3}\s+Phase\s+\d+[:\s]+(.+)/i)` — only recognized `## Phase N:` headers.
**Now:** `line.match(/^#{2,3}\s+(?:Phase|Wave)\s+\d+\s*[:—–-]?\s*(.+)/i)` — recognizes `## Wave N —` too (and still `Phase`, so stock/old specs keep working).

**Why:** the task list now emits `## Wave N` headers (Change 1). Without this, the VS Code sidebar's per-phase progress would stop attributing tasks to a phase. This is the one VS Code-extension-side change needed to keep the GUI honest about wave progress.

**How it was tested:** `tsc` clean; the regex was checked against both `## Wave 1 — Setup (parallel)` and the legacy `## Phase 1: Setup` shape.

---

## Change 8 — Smaller supporting edits

- **`speckit-extension/presets/_parts/parallel.md`** (the shared block injected into all four steps): rewritten from a soft *"use subagents where your provider supports them... a capability suggestion, not a requirement"* into the wave model — tasks organize into waves, implement runs a wave's subagents in one message. This is what makes the directive land in every step.
- **`speckit-extension/presets/_parts/timing.md`**: the per-task journaling note changed from "Parallel `[P]` tasks: journal each as it finishes" to "Tasks in the same parallel wave: the main agent journals each as its subagent returns" — same finish-only timing rules, just worded for waves.
- **Docs:** `speckit-extension/README.md` (the "as fast as your assistant allows" section now describes waves + the reconcile pass, plus a new "built-in skeptic" section) and `speckit-extension/CHANGELOG.md` (an Unreleased entry). No version bump — shipping deferred.

---

## Full file inventory

| File | Change |
|---|---|
| `nodes/tasks/tasks-doc.md` | flat `[P]` list → dependency-leveled **waves** + shared `> Contract:` |
| `nodes/tasks/review-gaps.md` | **new node** — adversarial diverse-lens gap review that closes gaps |
| `nodes/tasks/_order.yml` | inserted `review-gaps` between `tasks-doc` and `handoff` |
| `nodes/implement/implement-exec.md` | soft `[P]` nudge → **mechanical per-wave fan-out** + hands contract + reconcile pass |
| `nodes/plan/gather-context.md` | 2-file read → **codebase investigation fan-out** |
| `presets/_parts/parallel.md` | soft suggestion → wave model (injected into all 4 steps) |
| `presets/_parts/timing.md` | `[P]` journaling note → wave wording |
| `src/speckit/taskProgressService.ts` | progress regex matches `Phase` **or** `Wave` |
| `README.md` / `CHANGELOG.md` (extension) | docs updated; Unreleased entry; no version bump |
| (regenerated) command bodies + golden snapshots | re-assembled + re-frozen from the nodes above |

**Gate status after every change:** assemble-nodes `--check` ✓ · shape-parity ✓ · 90 Python tests ✓ · `tsc` ✓.

---

## Current state

- All changes live on branch **`parallelism-quality-loop`**, **uncommitted** (per your call to keep iterating before committing).
- Full chronological play-by-play with every experiment: `examples/todo-claude/bench/IMPROVEMENT-PLAN.md` (running log at the bottom).
- One follow-up filed as a ticket, not built: **#346** (a JSONL append-log + JSON read-model so parallel tasks can each record their own real duration).
- **Not yet done:** a cold-start full-pipeline run where the *real dispatched* Claude Code runs `/speckit.companion.*` end to end on its own (rather than hand-driven step by step). That's the GUI test below.
