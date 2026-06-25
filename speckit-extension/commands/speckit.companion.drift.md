---
description: "Report living-spec drift — per capability, the source files changed since the spec was last committed (opt-in, never halts)"
---

# Spec Drift

Show, for each living-spec capability, the source files that changed since that capability's spec was last committed — and **how** each one slipped. A living spec only stays honest if changes to its area flow back into it; this command surfaces the ones that didn't. **Read-only** — it never edits anything, and it **never fails** (always exits success). A surrounding workflow or CI may treat findings as a gate; the command itself does not.

This is **opt-in**. With living specs disabled (or no config), it reports nothing and exits clean.

## Prerequisites

- Verify Python is available by running `python3 --version`.
- If `python3` is not available, warn the user and skip:
  `[companion] Warning: python3 not detected; skipped drift`.
  Do not fail the host command.

## Execution

Run the drift detector from the repository root:

```bash
python3 .specify/extensions/companion/scripts/drift.py
```

The script reads the `livingSpecs` block from `.specify/companion.yml`, reuses the
resolver for capability membership, and uses git to find what changed since each
capability's `capabilities/<name>/spec.md` was last committed. Each drifted file
is classified:

- **`tracked`** — the file went through the Companion pipeline (it appears in a
  `specs/*/.spec-context.json` changed set) but was never folded back into the
  living spec → a missed sync.
- **`unspeced`** — the file changed entirely outside the pipeline; the living spec
  never saw it. The more concerning of the two.

Files matching any glob in `livingSpecs.exempt` (default `*.config.*`, `*.test.*`,
`**/migrations/**`) are filtered out. A capability whose spec is not yet committed
is skipped with an informational note. When every capability is in sync, the
command prints a single all-clear line.

Add `--json` for a machine-readable object (used by tooling/CI):

```bash
python3 .specify/extensions/companion/scripts/drift.py --json
```

## What to do with the report

Drift is a signal, not an error. For each `unspeced` or `tracked` row, either fold
the change into the living spec (e.g. run `/speckit.companion.adopt` for the area,
or write a delta spec) or add the path to `livingSpecs.exempt` if it shouldn't be
tracked. The command never blocks the pipeline on its own.
