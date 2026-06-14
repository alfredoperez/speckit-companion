# Data Model: Composable Command Nodes

**Feature**: 172-composable-command-nodes
**Date**: 2026-06-14

This feature has no runtime database. Its "entities" are authoring-time artifacts: parts, command bodies, the assembly relation, the golden reference, and the workflow nodes. This model defines their shape, fields, and the invariants the parity gate enforces.

---

## Entity: Part (shared logic block)

A single-source block of command text, stored once and expanded into many command bodies.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Stable identifier, e.g. `sizing`, `routing`, `timing`, `self-advance`. Matches the fence marker. |
| `body` | markdown | The canonical text. The only place this rule is authored. |
| `path` | path | `speckit-extension/presets/_parts/<name>.md` |

**The four parts:**
- `sizing` — small/large definition + the 5-files / 10-tasks thresholds.
- `routing` — which step runs next given the size.
- `timing` — the finish-only timing rules (the current `timing-partial.md`, relocated).
- `self-advance` — the agentic-CLI handoff text (continue to next workflow step, pause at gates, run the terminal node, land at `completed`; stay manual where the environment runs one step).

**Invariants:**
- Each part is authored in exactly one file (SC-002: duplicate-definition count = 0).
- A part's text is whatever the golden reference already contains for that region — decomposition extracts, it does not rewrite (FR-002).

---

## Entity: Command body

An assembled `/speckit.*` / `/speckit.companion.*` command file. Whole and self-contained after assembly.

| Field | Type | Notes |
|---|---|---|
| `command` | string | e.g. `speckit.companion.specify`, `speckit.companion.mark-complete`. |
| `path` | path | `speckit-extension/commands/…` or `presets/companion-standard/commands/…`. |
| `parts[]` | Part[] | The parts this body includes, each delimited by a named fence. |
| `fixedText` | markdown | The command-specific prose outside any fence. |

**Fence convention (existing, generalized):**
```
<!-- speckit-companion:part <name> -->
…expanded part text (byte-identical to the part file)…
<!-- /speckit-companion:part <name> -->
```
The legacy `<!-- speckit-companion:timing -->` fence is migrated to `<!-- speckit-companion:part timing -->`.

**Invariants:**
- The text between a fence pair equals the named part's body byte-for-byte (region-equality, enforced by the parity check).
- The committed file is whole: a plain terminal reading it sees fully-expanded text, no unresolved tokens (FR-008, SC-004).

---

## Entity: Assembly relation

The build step that maps parts + fixed text → whole command bodies.

| Field | Type | Notes |
|---|---|---|
| `build(parts, bodies)` | function | For each fenced region, replaces its content with the part body; leaves fixed text untouched. |
| `output` | command bodies | Written back into the committed `.md` files. |

**Invariants:**
- `build` is deterministic and idempotent: `build(build(x)) == build(x)`.
- Assembly happens at authoring/build time, not install time; what ships is already assembled (Decision 1 in research.md).

---

## Entity: Golden reference (frozen command set)

The pre-decomposition snapshot used to prove behavior is unchanged.

| Field | Type | Notes |
|---|---|---|
| `commands{}` | map<command, bytes> | The committed command bodies captured once, before decomposition. |
| `path` | path | Stored under the feature/test fixtures (e.g. `speckit-extension/tests/golden/commands/`). |

**Invariants:**
- Captured once, before any part is extracted (FR-001).
- For every command not intentionally changed, `committed == golden` byte-for-byte (FR-002, SC-001).

---

## Entity: Workflow node

A step in `speckit-companion.workflow.yml`. Relevant new/changed nodes:

| Node | Role | Notes |
|---|---|---|
| `specify` / `plan` / `tasks` / `implement` | pipeline steps | Each dispatches its Companion command; each command body carries the `self-advance` part. |
| `route` (switch) | sizing-driven routing | References the same thresholds as the `sizing` part (no re-derivation). |
| `mark-complete` | **terminal node (in scope here)** | Runs after implement (and any commit step). Writes `status: completed` via the existing `write-context.py` mark-complete writer. Present only in the Companion workflow — stock has no terminal node. |

**State transition (Companion, self-advancing path):**
```
… → implement → (commit?) → mark-complete → completed
```
- `mark-complete` refuses to promote unless the spec is already `implemented` (writer precondition).
- Stock SpecKit stops at `implemented`; completion is a manual user action there (FR-007b).
- One-shot / non-agentic environments do not auto-advance; the terminal node is reached only when the user/panel triggers it (FR-013).

---

## Invariant summary (what the parity gate checks)

1. Every fenced region in every command body equals its part byte-for-byte.
2. Every command body equals its golden capture (for unchanged commands).
3. Each shared rule (sizing, routing, timing) is authored in exactly one part.
4. The `self-advance` part appears in each pipeline command body.
5. Capture output (`.spec-context.json` history/timing) is unchanged before/after (FR-016, verified by the existing context tests, not by this script).
