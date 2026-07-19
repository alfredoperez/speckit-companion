# Data Model

The check reasons about one authority and three downstream surfaces. Nothing here is persisted — these are the shapes the check builds in memory for one run.

## Command

One entry under `provides.commands` in `speckit-extension/extension.yml`. The manifest's set of these is the single authority; every surface below is compared against it and is wrong when it disagrees.

| Field | Meaning |
|---|---|
| `name` | The dotted command name, e.g. `speckit.companion.living-move`. The identity used in every comparison. |
| `file` | The manifest-relative path to the command's instruction body. Read by the packaging guard; carried here so one reader serves both. |

There are seventeen at the time of writing. The check never hardcodes that number — a count is derived, never asserted against a literal.

## Install area

A directory belonging to one AI tool where the installer writes command files. Each has its own naming shape, so a command name must be translated per area rather than compared literally.

| Field | Meaning |
|---|---|
| `path` | Repository-relative directory, e.g. `.github/prompts`. |
| `shape` | How a command name becomes an entry in this area. |
| `kind` | Whether an entry is a directory holding an instruction file, or a single file. |

The seven areas present, and the translation each uses:

| Area | Kind | Entry for `speckit.companion.status` |
|---|---|---|
| `.claude/skills` | directory | `speckit-companion-status/SKILL.md` |
| `.agents/skills` | directory | `speckit-companion-status/SKILL.md` |
| `.cursor/skills` | directory | `speckit-companion-status/SKILL.md` |
| `.github/prompts` | file | `speckit.companion.status.prompt.md` |
| `.github/agents` | file | `speckit.companion.status.agent.md` |
| `.qwen/commands` | file | `speckit.companion.status.md` |
| `.gemini/commands` | file | `speckit.companion.status.toml` |

Two translations therefore exist: **dashed** (dots become dashes, used by the skills-style areas) and **dotted** (the name verbatim, plus a per-area suffix). Both must be reversible, because the check reads names *off* disk to find orphans as well as writing them *onto* disk to find gaps.

Areas are **discovered** rather than assumed. Any directory found to hold a Companion-shaped entry must appear in the table above; one that does not is a hard failure, not a skip.

## Install record

The project's stored account of what was registered. Two files, both tracked, both currently stale.

| Source | Shape | What the check reads |
|---|---|---|
| `.specify/extensions/.registry` | JSON | `extensions.companion.registered_commands` — a command-name list per agent (eight agents, seventeen names each). |
| `.specify/extensions.yml` | YAML | The hook registrations — which command each lifecycle event triggers. |

The records are the surface that goes stale by design: a reinstall adds newly registered names to what it already had and removes nothing, so a retired name persists indefinitely. They are also what the uninstall path reads, which is why a stale record blocks a clean removal.

## Documentation surface

| Source | What must appear |
|---|---|
| `speckit-extension/README.md` | Every command name, in the Commands table, grouped by family. |
| `speckit-extension/docs/commands.md` | Every command name, described. |

Matched on the literal dotted name, not on a count — a count matches when one command is added and another dropped in the same change.

## Finding

What the check emits. A run produces a list of these; empty means agreement.

| Field | Meaning |
|---|---|
| `kind` | `orphan` (present downstream, absent from the manifest) or `gap` (declared in the manifest, absent downstream). |
| `surface` | Which install area, record, or document. |
| `name` | The command name concerned. |
| `where` | The exact path, so the finding is actionable without a search. |

A third kind, `unresolvable`, covers an input the check cannot interpret — an undiscovered install area, or an entry inside a known area whose name fits no known shape. It is reported as a failure rather than skipped, because a silent skip shrinks the surface being scanned, which is the drift class the check exists to catch.

## Command family

Presentation only; it governs how the README table is grouped and carries no behavior.

| Family | Members |
|---|---|
| Pipeline | `specify`, `plan`, `tasks`, `implement`, `auto`, `classify`, `mark-complete` |
| Run state | `status`, `resume` |
| Living specs | `living-adopt`, `living-drift`, `living-coverage`, `living-move` |
| Hooks (never invoke) | `after-specify`, `after-plan`, `after-tasks`, `after-implement` |

Seventeen in total, partitioning the manifest exactly. The four hook commands are the ones a user must never invoke by hand; each is labelled with the lifecycle event that triggers it.
