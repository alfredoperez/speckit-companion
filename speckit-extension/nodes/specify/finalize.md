---
id: finalize
name: Finalise the spec
kind: control
command: specify
reads: [branch]
---
**Output**: `<feature_directory>/spec.md` + `<feature_directory>/checklists/requirements.md`. In **simple** mode, `spec.md` additionally carries an **Approach** section, and two lean files are emitted alongside it — `plan.md` (a pointer to that Approach) and `tasks.md` (the real `- [ ] **T001** …` checklist; the task list lives here, not in `spec.md`); in **normal** mode, `spec.md` holds the four sections only and no `plan.md` / `tasks.md` are written here.

**Capture the whole wrap-up in one call.** Everything this step learned goes in a single `--batch`: what it worked *from* (the living specs loaded above, the areas investigated, the constraints honored), the distilled intent, the explicit non-goals, and the workflow identity. Five volleys used to be about eleven round-trips; batched, they are one write of the shared file.

```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --batch '{
  "context": ["living spec: <name>", "area: <path or subsystem>", "constraint: <rule honored>"],
  "expectations": ["<out-of-scope item>", "<another>"],
  "set": {"intent": "<one-line goal>", "workflow": "companion"}
}'
```

Best-effort as a whole: skip silently if `python3` is unavailable. Omit `context` when there is nothing worth recording and `expectations` when the spec declares no non-goals — never invent either. **`workflow` is the one field that is not optional**: without it the shared writer defaults to `speckit`, and a later footer advance dispatches the stock command.

**On a `simple` run, add the approach to the same call.** A `simple` run writes its plan inline as the `## Approach` section of `spec.md` and never reaches `plan`, which is where a full run records it. So when `verdict == "simple"`, put it in the `set` map alongside the rest — `"approach": "<one-line summary of the Approach section>"` — rather than paying a second call for it.

**Record completion.** After `spec.md` is written, close the specify step — the extension stamps the real end (do **not** hand-write an `ai` complete for specify):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step specify --status specified --kind complete --by extension
```

**Fast-path living-spec load (simple mode only — best-effort, opt-in, read-only).** A `simple` run never reaches `plan`, which is where a full run loads living specs a second time with the touched files known. So if the pre-draft load recorded nothing (the surface wasn't known yet), do that load **now** — the touched files are known post-draft. Read `<feature_directory>/.spec-context.json`: if `livingSpecs.loaded` is already populated, skip this (never re-resolve or duplicate). Otherwise record what applies with the deterministic recorder against the files this change touches — it gates on `enabled`, runs the resolver, and writes the matched capabilities (leaf-first) onto `livingSpecs.loaded` itself, so the fast path can't lose the record to a misjudged "not configured":
```bash
python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <files this change touches…>
```
You may still read the matched specs into context for drafting (best-effort), but the recorder is the reliable write. Same contract as the load step: any missing config, resolver, or spec file is a silent no-op that never blocks the fold.

**Fast-path lifecycle fold (simple mode only).** When `verdict == "simple"`, record the folded `plan` and `tasks` steps so the history-driven panels read them as satisfied-by-fast-path — pairing with the lean `plan.md` / `tasks.md` files above, which make the file-driven stepper, sidebar, and implement progress agree — and the spec lands ready for implement. These are the step's real lifecycle boundaries, stamped by the extension like every other trusted step (**`--by extension`, step-level, no substep**), so the timing display counts specify, plan, and tasks as measured phases. Run them **in order, after** the specify completion above (each call stamps its own real clock — do not hand-write these, and do not run them for a `normal` verdict):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind start    --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step plan  --kind complete --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind start    --by extension
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --step tasks --kind complete --status ready-to-implement --by extension
```
After the fold, the spec sits at the **tasks** step with `status: ready-to-implement`; the developer triggers implement next. Do **not** write a `completed` status — the final completed gate stays a user action.


