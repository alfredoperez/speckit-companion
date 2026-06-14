# Contract: Assembly + Parity + Terminal Node

**Feature**: 172-composable-command-nodes

The interfaces this feature exposes are CLI scripts (build + parity check) and one workflow node (mark-complete). No HTTP/library API.

---

## Contract 1 — Build script (assemble parts → whole command bodies)

**Invocation:** `python3 speckit-extension/scripts/build-commands.py [--check]`

| Mode | Behavior | Exit |
|---|---|---|
| default (write) | For every command body, replace each `<!-- speckit-companion:part NAME -->…<!-- /…part NAME -->` region with `_parts/NAME.md`. Write the result back. | 0 on success |
| `--check` | Assemble in memory; do **not** write. Compare against the committed file. | 0 if identical, 1 + diff if any region drifted |

**Guarantees:**
- Deterministic and idempotent (`build(build(x)) == build(x)`).
- A missing part file, an unclosed fence, or a fence naming an unknown part is a hard error (exit 1), never a silent no-op.
- Fixed (non-fenced) text is never modified.

---

## Contract 2 — Parity gate (the existing check, extended)

**Invocation:** `python3 speckit-extension/scripts/check-shape-parity.py`

Replaces the current "every body contains the timing partial" assertion with two assertions:

| Assertion | Failure message | Exit |
|---|---|---|
| Region equality | each fenced region equals its part byte-for-byte | `part drift: <command>#<name>` | 1 |
| Golden equality | each unchanged command equals its golden capture | `golden drift: <command>` | 1 |

**Guarantees:**
- Runs in the existing pre-commit / CI slot (no new wiring beyond updating this script).
- Fails loudly and blocks the change on any difference (FR-003); green output: `[shape-parity] OK — N bodies match parts and golden`.
- Is the gate referenced by SC-001 (100% byte-for-byte before any new behavior).

---

## Contract 3 — Golden capture (one-time, pre-decomposition)

**Invocation:** `python3 speckit-extension/scripts/capture-golden.py` (run once, before extracting parts)

- Snapshots the current committed command bodies into `speckit-extension/tests/golden/commands/`.
- Idempotent re-run after an *intentional* command change is the sanctioned way to re-bless the golden (explicit, reviewed) — never run silently inside the build.

---

## Contract 4 — Terminal mark-complete node

**Workflow:** `speckit-companion.workflow.yml`, final node `mark-complete`, runs the `speckit.companion.mark-complete` command.

**Precondition → effect:**

| Precondition (`.spec-context.json` status) | Effect |
|---|---|
| `implemented` | `write-context.py --mark-complete` promotes `status: completed`, appends the terminal history entry. |
| any other status | writer refuses; status unchanged (no partial promotion). |

**Guarantees:**
- Single completed-writer: the node calls the existing `write-context.py` mark-complete path only; no second writer is introduced (FR-012).
- Present only in the Companion workflow. Stock SpecKit has no terminal node and stops at `implemented` (FR-007b).
- On the self-advancing path the engine runs this node automatically after implement (+ optional commit). On one-shot/non-agentic environments it is reached only by manual/panel trigger (FR-013). No VS Code file-watcher completion logic.

---

## Contract 5 — Self-contained command (plain terminal)

**Guarantee:** Any installed `/speckit.companion.*` command file, read directly in a plain terminal with no extension or panel, is a complete runnable command — fully-expanded, no unresolved include tokens (FR-008, SC-004). Verified by Contract 2's region-equality check operating on whole committed files.
