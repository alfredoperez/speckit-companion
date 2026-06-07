# Commands & hooks

The extension follows spec-kit's bundled-extension pattern exactly: a **lifecycle hook** runs a **command-markdown** file, which tells the agent to **run a script**.

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture  →  write-context.py  →  .spec-context.json
```

## Lifecycle hooks

Registered in the extension's `extension.yml` (and, once installed, in the project's `.specify/extensions.yml`):

| Hook | Command | optional | Effect |
|------|---------|----------|--------|
| `after_specify` | `speckit.companion.capture` | `false` (auto-runs) | Record specify completion into `.spec-context.json` |
| `after_plan` | `speckit.companion.capture-plan` | `false` (auto-runs) | Record plan completion (`currentStep=plan`, `status=planned`) into `.spec-context.json` |
| `after_tasks` | `speckit.companion.capture-tasks` | `false` (auto-runs) | Record tasks completion (`currentStep=tasks`, `status=ready-to-implement`) into `.spec-context.json` |
| `after_implement` | `speckit.companion.capture-implement` | `false` (auto-runs) | Per-task journaling on implement (`currentStep=implement`); `status=implemented` when all tasks checked |

`optional: false` means the agent runs it **automatically** with no prompt. (For contrast, the bundled `git` extension's `after_specify` commit hook is `optional: true`, so it only *offers* to run.) ROADMAP step 2 shipped `after_plan` / `after_tasks` / `after_implement`, so the full `specify → plan → tasks → implement` lifecycle is now captured automatically — see [../ROADMAP.md](../ROADMAP.md).

## `speckit.companion.capture`

The first command. It carries no business logic itself — it resolves the active feature and invokes the writer script, mirroring `speckit.git.feature.md`. The three commands below follow the same pattern.

**What the agent runs:**

```bash
python3 speckit-extension/scripts/write-context.py --step specify --status specified --by extension
```

**Flags** (`scripts/write-context.py`):

| Flag | Default | Meaning |
|------|---------|---------|
| `--step` | `specify` | Canonical step (`specify`/`clarify`/`plan`/`tasks`/`analyze`/`implement`). A non-canonical value (incl. legacy `done`) is a no-op. |
| `--status` | `specified` | Canonical lifecycle status written to the file. |
| `--by` | `extension` | Authorship tag on the appended transition. |
| `--feature-dir` | — | Explicit target dir; otherwise resolved (see [how-it-works.md](./how-it-works.md#active-directory-resolution)). |
| `--tasks-file` | — | Per-task journaling mode: append one transition per completed task marker in this `tasks.md`. Idempotent; sets `status=implementing` until all checked, then the `--status` value. |

**Graceful degradation:** if `python3` is missing the command warns and skips; if the active feature directory can't be resolved the script warns and exits 0. It never fails the host spec-kit command.

## `speckit.companion.capture-plan`

Runs after `/speckit.plan`. Resolves the active feature and records plan completion.

**What the agent runs:**

```bash
python3 speckit-extension/scripts/write-context.py --step plan --status planned --by extension
```

## `speckit.companion.capture-tasks`

Runs after `/speckit.tasks`. Resolves the active feature and records tasks completion.

**What the agent runs:**

```bash
python3 speckit-extension/scripts/write-context.py --step tasks --status ready-to-implement --by extension
```

## `speckit.companion.capture-implement`

Runs after `/speckit.implement` in task-sync mode: it appends one transition per completed `- [x] **T###**` marker in `tasks.md`. Idempotent — re-running adds only newly-checked markers; status stays `implementing` until all markers are checked, then becomes `implemented`.

**What the agent runs:**

```bash
python3 speckit-extension/scripts/write-context.py --step implement --status implemented --by extension --tasks-file specs/<NNN>-<slug>/tasks.md
```

## Derive-from-files fallback

`speckit-extension/scripts/derive-from-files.py` reconstructs `.spec-context.json` from on-disk artifacts when a hook never fired. Stdlib-only; reuses `write-context.py`'s feature-dir resolution and its no-backward-clobber guard, so it never drags an already-advanced or terminal spec backward. It writes the same canonical schema, tagged `by: "derive"`.

It infers the lifecycle from what's present: `spec.md` → `specify`/`specified`, `plan.md` → `plan`/`planned`, `tasks.md` → `tasks`/`ready-to-implement`, and all task markers checked → `implement`/`implemented`, plus git as a signal.

**Invocation:**

```bash
python3 speckit-extension/scripts/derive-from-files.py
# or target an explicit dir:
python3 speckit-extension/scripts/derive-from-files.py --feature-dir specs/<NNN>-<slug>
```

See [how-it-works.md](./how-it-works.md) for what the writer guarantees (atomic, append-only, no-regress) and the canonical schema.
