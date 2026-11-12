---
id: finalize
name: Finalise the spec
kind: control
command: specify
reads: [branch]
---
**Output**: `<feature_directory>/spec.md`. In **simple** mode the spec additionally carries an **Approach** section, and two lean files sit alongside it: `plan.md` (a pointer to that Approach) and `tasks.md` (the real `- [ ] **T001** …` checklist; the task list lives here, not in the spec). In **normal** mode the spec holds the four sections only, and no `plan.md` / `tasks.md` are written here.

**Capture the whole wrap-up in one call.** Everything this step learned goes in a single `--batch`: what it worked *from* (the living specs loaded above, the areas investigated, the constraints honored), the distilled intent, the explicit non-goals, and the workflow identity.

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --batch '{
  "context": ["living spec: <name>", "area: <path or subsystem>", "constraint: <rule honored>"],
  "expectations": ["<out-of-scope item>", "<another>"],
  "coverage": [{"req": "FR-001", "title": "<the requirement's one-line text>"}],
  "set": {"intent": "<one-line goal>", "workflow": "companion", "size": "<verdict>"},
  "classification": {"projectedFiles": <n>, "projectedTasks": <n>, "scopeSignal": "<larger|smaller|none>", "verdict": "<verdict>"}
}'
```

Best-effort as a whole: skip silently if `python3` is unavailable. Omit `context` when there is nothing worth recording and `expectations` when the spec declares no non-goals; never invent either. A spec with a `**Source**:` line adds `"source": "<that ticket, as written>"` to `set`, and one the brief says extends or supersedes an earlier folder adds `"extends"` or `"supersedes"` with that folder. **`workflow` is the one field that is not optional**: without it the shared writer defaults to `speckit`, and a later footer advance dispatches the stock command.

**On a `simple` run, add the approach to the same call.** A `simple` run writes its plan inline and never reaches `plan`, where a full run records it. So when `verdict == "simple"`, put `"approach": "<one-line summary of the Approach section>"` in the `set` map alongside the rest rather than paying a second call.

**Record completion.** After `spec.md` is written, close the specify step. The extension stamps the real end, so do **not** hand-write an `ai` complete for specify:
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specified --kind complete --by extension
```

**Fast-path living-spec load (simple mode, and only when this project keeps living specs).** A `simple` run never reaches `plan`, where a full run loads them again. If a `living-specs.yml` sits at the repository root, or `.specify/companion.yml` has a `livingSpecs` block, follow "Simple runs" in `.specify/extensions/companion/commands/reference/living-specify-load.md`. Otherwise skip this.

**Fast-path lifecycle fold (simple mode only).** When `verdict == "simple"`, record the folded `plan` and `tasks` steps so the history-driven panels read them as satisfied-by-fast-path and the spec lands ready for implement. One call, **after** the specify completion above, writes all four boundaries in order (plan start and complete, tasks start and complete) in a single write, so the fold lands whole or not at all. It is idempotent. Do not hand-write the boundaries, and do not run it for a `normal` verdict:
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --fold plan,tasks --by extension
```
After the fold, the spec sits at the **tasks** step with `status: ready-to-implement`; the developer triggers implement next. Do **not** write a `completed` status: the final completed gate stays a user action.
