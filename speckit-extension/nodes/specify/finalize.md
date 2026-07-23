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

**Capture the approach (simple mode only).** A `simple` run writes the plan inline as the `## Approach` section of `spec.md` and never reaches `plan` (which is where a full run records `--set approach`). So when `verdict == "simple"`, persist that same one-line approach onto `.spec-context.json` so the viewer Overview's APPROACH card reads it (best-effort; skip silently if `python3` is unavailable):
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set approach="<one-line summary of the Approach section>"
```

**Pin the workflow identity.** Record that this spec runs the **Companion** workflow, so the viewer advances it on Companion — not stock — at `plan`, `tasks`, and `implement`. Without this the shared writer defaults `workflow` to `speckit`, and a later footer advance dispatches the stock command. This is a **required deterministic write** (only skip if `python3` is genuinely unavailable), not best-effort:
```bash
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set workflow=companion
```

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


