---
id: finalize
name: Finalise the spec
kind: control
command: specify
reads: [branch]
---
**Output**: `<feature_directory>/<short-name>.spec.md` + `<feature_directory>/checklists/requirements.md`. In **simple** mode the spec additionally carries an **Approach** section, and two lean files sit alongside it: `plan.md` (a pointer to that Approach) and `tasks.md` (the real `- [ ] **T001** …` checklist; the task list lives here, not in the spec). In **normal** mode the spec holds the four sections only, and no `plan.md` / `tasks.md` are written here.

**Capture the whole wrap-up in one call.** Everything this step learned goes in a single `--batch`: what it worked *from* (the living specs loaded above, the areas investigated, the constraints honored), the distilled intent, the explicit non-goals, and the workflow identity.

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --batch '{
  "context": ["living spec: <name>", "area: <path or subsystem>", "constraint: <rule honored>"],
  "expectations": ["<out-of-scope item>", "<another>"],
  "set": {"intent": "<one-line goal>", "workflow": "companion"}
}'
```

Best-effort as a whole: skip silently if `python3` is unavailable. Omit `context` when there is nothing worth recording and `expectations` when the spec declares no non-goals; never invent either. **`workflow` is the one field that is not optional**: without it the shared writer defaults to `speckit`, and a later footer advance dispatches the stock command.

**On a `simple` run, add the approach to the same call.** A `simple` run writes its plan inline and never reaches `plan`, where a full run records it. So when `verdict == "simple"`, put `"approach": "<one-line summary of the Approach section>"` in the `set` map alongside the rest rather than paying a second call.

**Record completion.** After `<short-name>.spec.md` is written, close the specify step. The extension stamps the real end, so do **not** hand-write an `ai` complete for specify:
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specified --kind complete --by extension
```

**Fast-path living-spec load (simple mode only; best-effort, opt-in, read-only).** A `simple` run never reaches `plan`, where a full run loads living specs again with the touched files known. So if the pre-draft load recorded nothing, do it **now**: the touched files are known post-draft. Read `<feature_directory>/.spec-context.json`. If `livingSpecs.loaded` is already populated, skip this; never re-resolve or duplicate. Otherwise run the deterministic recorder against the files this change touches:
```bash
python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <files this change touches…>
```
You may also read the matched specs into context (best-effort), but the recorder is the reliable write. Same contract as the load step: a missing config, resolver, or spec file is a silent no-op that never blocks the fold.

**Fast-path lifecycle fold (simple mode only).** When `verdict == "simple"`, record the folded `plan` and `tasks` steps so the history-driven panels read them as satisfied-by-fast-path and the spec lands ready for implement. These are real lifecycle boundaries, stamped like every other trusted step (**`--by extension`, step-level, no substep**). Run them **in order, after** the specify completion above. Do not hand-write them, and do not run them for a `normal` verdict:
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind start    --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind complete --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind start    --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind complete --status ready-to-implement --by extension
```
After the fold, the spec sits at the **tasks** step with `status: ready-to-implement`; the developer triggers implement next. Do **not** write a `completed` status: the final completed gate stays a user action.
