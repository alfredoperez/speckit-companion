---
description: "Companion turbo specify — spec.md with no user-story section (per-spec opt-in)"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Produce a turbo specification — **no user-story / user-scenario section**. Capture intent as testable requirements, not narrative journeys.

1. **Resolve the feature directory — mint a fresh dir for new work.** `.specify/feature.json` is an **output** of this step, not an input to reuse: it points at the *previous* spec (frequently already completed), so reusing it would clobber finished work. Pick the target:
   - If the request explicitly names a target path (or `SPECIFY_FEATURE_DIRECTORY` is set), use it.
   - Otherwise create the next numbered dir: scan `specs/` for the highest `NNN-…` prefix, derive a 2–4 word short-name from the description, and use `specs/<NNN+1>-<short-name>/`. **Never write into a directory that already contains a `spec.md`** — that's a stale pointer to a prior spec, not this feature.
   Create `<feature_directory>/`, point `.specify/feature.json` at it, then record the **specify START** so the step's duration begins now (the script stamps the real clock — do not hand-write this):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specifying --kind start --by extension
   ```

2. Create `<feature_directory>/spec.md` with exactly these sections, in order:
   - **Overview** — 1–3 sentences: what this delivers and why. No implementation detail. (This replaces the stock user-scenarios narrative.)
   - **Functional Requirements** — a numbered `FR-001…` list. Each requirement is a single, testable MUST/SHOULD statement. Mark a genuinely unresolvable choice with `[NEEDS CLARIFICATION: …]` (max 3; prefer informed defaults).
   - **Success Criteria** — measurable, technology-agnostic `SC-001…` outcomes (time, count, percentage, pass/fail). No framework or API names.
   - **Assumptions** — the informed defaults you chose for anything unspecified.

3. Keep it business-readable. Do **not** add user stories, acceptance-scenario tables, or priority labels — turbo tracks requirements and outcomes directly. Fold edge cases into Functional Requirements or Assumptions.

4. **Spec quality checklist.** Write `<feature_directory>/checklists/requirements.md` using the template below, then run a **single** self-check pass: grade each item pass/fail, fix obvious fails in `spec.md` in place, and leave any genuine ambiguity as a `[NEEDS CLARIFICATION: …]` marker (max 3) for the `clarify` step. Do **not** run a multi-iteration rewrite loop or prompt the user with option tables — turbo defers interactive clarification to `clarify`. Update the checklist to reflect the final pass/fail state.

   ```markdown
   # Specification Quality Checklist: [FEATURE NAME]

   **Purpose**: Validate turbo specification completeness before planning
   **Created**: [DATE]
   **Feature**: [Link to spec.md]

   ## Content Quality

   - [ ] No implementation details (languages, frameworks, APIs)
   - [ ] Focused on user/business value and the change's intent
   - [ ] Overview states what is delivered and why in 1–3 sentences
   - [ ] All four sections present (Overview, Functional Requirements, Success Criteria, Assumptions)

   ## Requirement Completeness

   - [ ] Any [NEEDS CLARIFICATION] markers are genuine ambiguities (≤3) deferred to clarify — not unresolved guesses
   - [ ] Each Functional Requirement is a single, testable MUST/SHOULD statement
   - [ ] Success criteria are measurable
   - [ ] Success criteria are technology-agnostic (no implementation details)
   - [ ] Edge cases are folded into Functional Requirements or Assumptions
   - [ ] Scope is clearly bounded
   - [ ] Dependencies and assumptions identified

   ## Feature Readiness

   - [ ] Every Functional Requirement maps to at least one Success Criterion
   - [ ] Overview intent is reflected by the FR list (no orphan goals)
   - [ ] No implementation details leak into the specification

   ## Notes

   - Items marked incomplete require spec updates before clarify or plan
   ```

5. **Classify the change — right-size the ceremony.** After the spec content is drafted, decide whether this change is small enough to fast-track straight to implement, or large enough to keep the full specify → plan → tasks → implement pipeline. This is a best-effort heuristic and **MUST err toward `normal`** on weak or conflicting signals — a change is never under-planned by accident.

   ```
   fastPathEnabled = read `complexityFastPath` from .specify/companion.yml (default false when the key is absent — opt-in beta)

   projectedFiles  = estimate the number of files the drafted requirements imply
   projectedTasks  = estimate the number of implementation tasks the drafted requirements imply
   scopeSignal     = "larger"  if the description/requirements contain rewrite | overhaul | new system | migration | redesign | …
                     "smaller" if they contain one-line | rename | typo | tweak | copy change | …
                     else "none"

   crossedGuardrail = projectedFiles > 5 OR projectedTasks > 10   # fixed threshold — mirrors the tiny-change guardrail

   verdict = "simple" if  fastPathEnabled
                      and projectedFiles <= 5
                      and projectedTasks <= 10
                      and scopeSignal != "larger"
             else "normal"
   ```

   - **Guardrail warning.** When `crossedGuardrail == true` OR `scopeSignal == "larger"`, print this line verbatim, then run the **normal** branch (never a silent fast-track):

     ```
     [companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline.
     ```

     Exactly-at-threshold (`projectedFiles == 5` / `projectedTasks == 10`) is the simple ceiling — it does **not** warn and stays eligible for `simple`.
   - **Opt-out.** When `fastPathEnabled == false`, the verdict is always `normal` — no combining, no warning.

6. **Branch on the verdict.**

   - **`simple` — minimal mode.** Write **three lean files** in this one pass so the file-driven views (top stepper, sidebar, implement progress) reconcile with the history-driven fold — never a single combined `spec.md`:
     - Append an **Approach** section to the already-written `spec.md` — the files to touch and any dependencies, in a few bullets (the plan content, inline; this stays the plan source-of-truth).
     - Write `<feature_directory>/plan.md` as a **short pointer** to the spec's Approach (e.g. a one-line blockquote linking `./spec.md#approach` and `./tasks.md`). Do **not** duplicate the approach bullets — `plan.md` references them.
     - Write `<feature_directory>/tasks.md` carrying the **real task checklist** — a dependency-ordered list, one per line as `- [ ] **T001** [P?] <description> + <path>` (`[P]` marks tasks that can run in parallel). This MUST be the actual checklist, not a pointer: implement progress counts these checkboxes, so a pointer would read 0/0.

     Put the task checklist **only** in `tasks.md` — do **not** keep a second copy in `spec.md` (the duplicate would drift). `spec.md` keeps the Approach; `tasks.md` owns the tasks.

     Still write `<feature_directory>/checklists/requirements.md` as in step 4. Do **not** run `/speckit.companion.plan` or `/speckit.companion.tasks` — the three lean files plus the lifecycle fold below record those steps as satisfied.
   - **`normal` — full pipeline.** Write `spec.md` only (no appended Approach section, no `plan.md` / `tasks.md` here, no lifecycle fold). The existing pipeline continues unchanged: plan and tasks are produced and recorded by their own `/speckit.companion.plan` and `/speckit.companion.tasks` runs.

**Output**: `<feature_directory>/spec.md` + `<feature_directory>/checklists/requirements.md`. In **simple** mode, `spec.md` additionally carries an **Approach** section, and two lean files are emitted alongside it — `plan.md` (a pointer to that Approach) and `tasks.md` (the real `- [ ] **T001** …` checklist; the task list lives here, not in `spec.md`); in **normal** mode, `spec.md` holds the four sections only and no `plan.md` / `tasks.md` are written here.

**Record completion.** After `spec.md` is written, close the specify step — the extension stamps the real end (do **not** hand-write an `ai` complete for specify):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specified --kind complete --by extension
```

**Fast-path lifecycle fold (simple mode only).** When `verdict == "simple"`, record the folded `plan` and `tasks` steps so the history-driven panels read them as satisfied-by-fast-path — pairing with the lean `plan.md` / `tasks.md` files above, which make the file-driven stepper, sidebar, and implement progress agree — and the spec lands ready for implement. Run these **in order, after** the specify completion above (each call stamps its own real clock — do not hand-write these, and do not run them for a `normal` verdict):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind start    --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind complete --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind start    --substep fast-path --by ai
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind complete --substep fast-path --status ready-to-implement --by ai
```
After the fold, the spec sits at the **tasks** step with `status: ready-to-implement`; the developer triggers implement next. Do **not** write a `completed` status — the final completed gate stays a user action.


<!-- speckit-companion:timing -->
## Timing — keep `.spec-context.json` honest

These rules apply to every Companion profile command. The extension records lifecycle timing with its own scripts wherever it can; these rules keep anything you append consistent with that and accurate for any dispatcher (terminal, IDE chat, or the GUI). The model is **finish-only**: each task and each substep records a *single* finish event, and its duration is the gap to the previous finish (or the step's start). Never a `start`+`complete` pair for a task or substep — a pair stamped at one instant is what produces `0s` ticks and bursts.

- **Live timestamps.** When you append a history entry yourself, stamp it by running `date -u +"%Y-%m-%dT%H:%M:%SZ"` at that moment. Never hand-type a timestamp, never reuse an earlier value, never stamp several entries with one shared value.
- **Self-close — but not specify or implement.** When your own work for **plan, tasks, clarify, or analyze** ends, append `{ "step": "<this step>", "substep": null, "kind": "complete", "by": "ai", "at": "<date -u output>" }`. Do NOT self-close **specify** or **implement**: the extension closes those itself (specify from its own command, implement from the end-of-step hook), so an `ai` complete there would duplicate it.
- **Substeps — one finish each.** For each substep boundary (plan: `research`, `design`; tasks: `generate`) append a single finish `{ "step": "<step>", "substep": "<name>", "kind": "complete", "by": "ai", "at": "<fresh date -u>" }` the moment that substep ends. One entry per substep, each with its own real timestamp — never two substeps sharing a value, never a separate `start`. The delta between consecutive finishes is each substep's duration.
- **Implement — journal each task with a script (finish-only).** As you finish each task: mark it `- [x] **<TaskID>**` in `tasks.md`, append `task_summaries.<TaskID>`, then run (feature dir from `.specify/feature.json`):

  ```bash
  python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --task <TaskID> --kind complete --by ai
  ```

  Run this **the moment that task completes** — one finish per task, as you go. Do NOT defer journaling to the end of the step and do NOT dump every task's finish in one end-of-step batch: that collapses their real durations into a single instant, and the cadence check now FAILS a run whose task finishes are clustered into a tiny fraction of the step's real duration. This stamps **one** finish event from the real clock — its delta to the previous task's finish is that task's duration. Do NOT hand-author per-task JSON and do NOT write a per-task `start`. The end-of-step hook is a backstop that fills any task you didn't journal (it won't duplicate one you did). Parallel `[P]` tasks: journal each as it finishes; the batch's time is attributed to whichever finishes last (accepted limitation).
- **Never write the next step's start.** Only the next command appends the next step's start entry; writing it here makes the viewer render a phantom "Generating <next>…".
<!-- /speckit-companion:timing -->
