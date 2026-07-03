---
id: finalize
kind: control
command: specify
reads: [branch]
---
**Output**: `<feature_directory>/spec.md` + `<feature_directory>/checklists/requirements.md`. In **simple** mode, `spec.md` additionally carries an **Approach** section, and two lean files are emitted alongside it — `plan.md` (a pointer to that Approach) and `tasks.md` (the real `- [ ] **T001** …` checklist; the task list lives here, not in `spec.md`); in **normal** mode, `spec.md` holds the four sections only and no `plan.md` / `tasks.md` are written here.

**Capture the context (the C of Intent/Context/Expectations).** Record what this run worked *from* — the living specs loaded above (when any), the key files/areas you investigated, and the constraints you honored — one short entry each (best-effort; skip silently if `python3` is unavailable; omit entirely when there is nothing worth recording):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --context "living spec: <name>" --context "area: <path or subsystem>" --context "constraint: <rule honored>"
```

**Capture the goal and the fence.** Before closing the step, persist the spec's distilled intent (one sentence — what this feature is *for*) and each explicit non-goal / out-of-scope item, so a resume or a colliding future spec can read them without re-reading the spec (best-effort; skip silently if `python3` is unavailable):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set intent="<one-line goal>"
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --expectation "<out-of-scope item>" --expectation "<another>"
```
Omit the `--expectation` call when the spec declares no non-goals — never invent them.

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


