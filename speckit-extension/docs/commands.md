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

`optional: false` means the agent runs it **automatically** with no prompt. (For contrast, the bundled `git` extension's `after_specify` commit hook is `optional: true`, so it only *offers* to run.) Steps 2+ add `after_plan` / `after_tasks` / `after_implement` — see [../ROADMAP.md](../ROADMAP.md).

## `speckit.companion.capture`

The only command today. It carries no business logic itself — it resolves the active feature and invokes the writer script, mirroring `speckit.git.feature.md`.

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

**Graceful degradation:** if `python3` is missing the command warns and skips; if the active feature directory can't be resolved the script warns and exits 0. It never fails the host spec-kit command.

See [how-it-works.md](./how-it-works.md) for what the writer guarantees (atomic, append-only, no-regress) and the canonical schema.
