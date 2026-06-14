# Composable command nodes

The Companion commands are no longer single hand-written markdown files. Each one is **assembled from smaller pieces** — a short frame plus an ordered list of nodes — so the same building blocks can be reordered or, later, swapped out per project. This page is the map of how that works and what each piece is.

> **v1 is a pure refactor.** The commands assemble back to exactly the text they had before — byte for byte. The structure (nodes, order, metadata) ships now; *changing* what a command produces by adding or dropping a section is a later step. Two checks guard this: the node-assembly parity check and the existing part-fence parity check, both run in CI.

## The vocabulary

These four words mean specific things. "Node" used to get used loosely for all of them — it doesn't anymore.

- **step** — one entry in the workflow (`workflow.yml`): `specify`, `route`, `plan`, `mark-complete`. A step maps to one dispatched `/speckit.companion.*` command.
- **node** — one section *inside* a command, written as its own file (e.g. `draft-spec`, `plan-doc`). This is the new thing.
- **part** — a reusable block shared across commands, injected by a fence (`<!-- speckit-companion:part NAME -->`): `timing`, `sizing`, `routing`, `self-advance`. Parts stay as inner fences inside node bodies — they are *not* nodes.
- **node hook** — a user-added `before`/`after` insert defined in `.specify/companion.yml`. Distinct from the engine-level **lifecycle hook** in `extension.yml` (`after_specify` → capture).

## How a command is assembled

Each decomposed command lives under `speckit-extension/nodes/<command>/`:

```
nodes/plan/
  _frame.md      # the non-reorderable preamble (verbatim, no node frontmatter)
  _order.yml     # order: [gather-context, plan-doc, constitution-check, side-files, handoff]
  gather-context.md
  plan-doc.md
  constitution-check.md
  side-files.md
  handoff.md
```

`scripts/assemble-nodes.py` builds the command body:

1. Read `_frame.md` verbatim — the command frontmatter, the `## User Input` block, and the `## Outline` lead-in. This is connective glue you'd never reorder, so it has its own home outside the node list.
2. Read each node named in `_order.yml`, strip its frontmatter, and concatenate the bodies in order.
3. Run the **part-fence pass** (shared with `build-commands.py`) so inner `<!-- speckit-companion:part NAME -->` fences fill from `presets/_parts/`.
4. Append the **orchestrator** part, when present (run-time hook instructions; see below).

The output is written to `commands/speckit.companion.<command>.md` (still committed and whole). `assemble-nodes.py --check` re-assembles in memory and fails on any drift from the frozen golden.

## A node file

```markdown
---
id: plan-doc
kind: author
command: plan
writes: plan.md            # METADATA ONLY in v1 — for the future config surface, not a runtime instruction
reads: [gather-context]    # advisory ordering, validated against the active recipe
---
2. Create `<feature_directory>/plan.md` with these sections, in order:
   ...
```

**Kinds** (each describes what the node does, so they're testable):

- **investigate** — reads/loads context, produces no artifact (e.g. `gather-context`).
- **author** — owns and writes a deliverable: a spec doc/section, or the working code (e.g. `draft-spec`, `plan-doc`, `implement-exec`).
- **gate** — a check or pause that may abort or skip (e.g. `constitution-check`).
- **control** — side-effecting orchestration: setup (`resolve-dir`), routing (`classify-size`, `branch`), finish (`finalize`), or the cross-cutting `handoff` that carries the trailing parts.

`writes:` is metadata in v1 — the assembled body is still prose that makes the AI produce the same document in one pass. Real section-level composition (recipes that add or drop sections) is a later step.

## specify decomposition — the spike result

`specify` was the gating spike: would it cut to byte-identical, given its inline `sizing` fence, its lifecycle-START / completion / fast-path-fold bash, and the connective glue between numbered steps? **It did.** Every byte maps to exactly one node body, the `_frame`, or a named part, and the assembler reproduces the golden byte-for-byte. specify ships decomposed in v1 alongside `plan`, `tasks`, and `implement`. The bash blocks and connective prose live inside their owning `control` nodes (`resolve-dir`, `finalize`); the inline `sizing` part stays a fence inside `classify-size`.

## Mapping table — every target node and where it came from

| Command | Node | Kind | Source |
|---------|------|------|--------|
| specify | `_frame` | — | new file (frontmatter + User Input + Outline lead-in) |
| specify | `resolve-dir` | control | new file (feature-dir setup + START bash) |
| specify | `draft-spec` | author | new file (spec.md sections) |
| specify | `quality-checklist` | author | new file (checklists/requirements.md) |
| specify | `classify-size` | control | new file — absorbs the `sizing` part fence inline |
| specify | `branch` | control | new file (simple/normal branching) |
| specify | `finalize` | control | new file (Output + completion + fast-path-fold bash) |
| specify | `handoff` | control | new file — absorbs the `timing` + `self-advance` part fences |
| plan | `_frame` | — | new file |
| plan | `gather-context` | investigate | new file |
| plan | `plan-doc` | author | new file (plan.md) |
| plan | `constitution-check` | gate | new file |
| plan | `side-files` | author | new file |
| plan | `handoff` | control | new file — absorbs `timing` + `self-advance` |
| tasks | `_frame` | — | new file |
| tasks | `tasks-doc` | author | new file (tasks.md) — single author node, so a recipe is a no-op here in v1 |
| tasks | `handoff` | control | new file — absorbs `timing` + `self-advance` |
| implement | `_frame` | — | new file |
| implement | `implement-exec` | author | new file (executes tasks.md) — single author node |
| implement | `handoff` | control | new file — absorbs `timing` + `self-advance` |
| classify | — | — | **existing command** (`speckit.companion.classify.md`) — stays separately dispatchable; not decomposed in v1 |
| mark-complete | — | — | **existing command** (`speckit.companion.mark-complete.md`) — stays separately dispatchable; not decomposed in v1 |

Parts (`sizing`, `timing`, `self-advance`, `routing`) stay in `presets/_parts/` and are absorbed as inner fences inside the node bodies that already carried them.
