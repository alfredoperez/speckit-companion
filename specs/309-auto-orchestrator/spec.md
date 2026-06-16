# Spec — `/speckit.companion.auto` runs the whole pipeline hands-off

## Intent

Give the Companion pipeline a single command (and a GUI button) that walks every step end-to-end — specify → plan → tasks → implement → mark-complete — without pausing for approval in between. It is the `sdd:auto` sibling for the Companion workflow. Auto sits *on top* of the existing per-step nodes so it can never drift from the manual/GUI behavior.

## Requirements

- **R1 — Auto orchestrator command.** A new `/speckit.companion.auto` command exists, assembled from `nodes/auto/` like the other namespaced commands. Its body is an orchestrator: it dispatches the same per-step `/speckit.companion.*` commands in order (specify → plan → tasks → implement → mark-complete) and ends the spec at `completed` via mark-complete.

- **R2 — No approval pauses.** The auto body explicitly does NOT pause at review gates. It records each checkpoint and continues. This is the one behavioral difference from the manual self-advance node, which pauses at every gate.

- **R3 — The `unattended` signal.** Auto sets `unattended: true` so project checkpoint hooks auto-continue instead of stopping. The convention: checkpoint *prompt* hooks read the flag — "if unattended, record the checkpoint and continue; otherwise ask to proceed." Background / review / PR hooks still fire; only the human pause is skipped. The convention is documented for hook authors.

- **R4 — GUI Run entry.** Create Spec gains a second action button, **Run**, alongside Create Spec. Clicking it triggers the same auto flow: it dispatches the auto prompt through the existing AI-provider / terminal dispatch path. A `speckit.*`-style command is registered in `package.json` `contributes.commands` and the button posts a message the extension routes to the same submit path with the auto command.

- **R5 — Graceful degradation.** On a plain / one-shot terminal (no agent that keeps working after each step), auto degrades to the normal one-step-at-a-time flow. The body says so in prose. Missing-extension behaviour follows the existing namespaced-command fallback (a Companion-only command with no stock twin is suppressed with a non-blocking warning).

- **R6 — Existing commands unchanged.** The per-step commands (`specify`, `plan`, `tasks`, `implement`) stay byte-for-byte. The byte-for-byte golden parity gate still passes. Auto is added by appending `auto` to the namespaced-command list and re-blessing golden.

- **R7 — Manifest registration.** `auto` is registered in `extension.yml` under `provides.commands` (name + file) or the installer skips it.

- **R8 — Terminal status.** A spec built through auto ends at `completed` (auto's final mark-complete step), via `write-context.py --mark-complete`, which refuses unless the spec is already `implemented`. No second completed-writer is introduced.

## Out of scope

- Parallelization (the `[P]` provider-aware capability) — that is the #319 half, built second.
- Any change to the spec-kit `workflow.yml` engine path.
- Custom document formats.

## Acceptance

- `/speckit.companion.auto` assembles cleanly, runs the full pipeline with no pauses, driving the same per-step nodes.
- A GUI **Run** entry does the same through the existing dispatch path.
- Auto sets `unattended: true`; a checkpoint prompt hook reading it records-and-continues instead of pausing.
- Background / review / PR hooks still fire under auto; only the human pause is skipped.
- A Companion auto-run ends at `completed`.
- No `specify workflow run` involved.
- `npm run compile && npm test`, `assemble-nodes.py --check`, and `check-shape-parity.py` all pass.
