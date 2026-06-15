# Ship-ticket as a Companion hook (dogfood)

This example shows the node-hook mechanism (#317) end to end: it takes the work that the `/ship-ticket` skill does — review → PR → Copilot → merge → reinstall — and attaches it to the end of the Companion pipeline so it runs automatically after a build, without changing any shipped command.

It exists to prove the mechanism. It is **not** wired in by default and the extension does not ship it.

> **Run it only against a throwaway branch and spec.** The merge and reinstall steps do real, hard-to-reverse things (`gh pr merge`, a local reinstall). Never point this at a real ticket.

## What you get

After the implement step finishes its work (but before the spec is marked complete), the orchestrator runs your ship steps in order. Each step records a line of progress into the spec's `.spec-context.json`, so you can watch the tail advance in the Companion panel just like the build phases.

## Two ways to wire it

**As node files** (the richer form — each step is its own file you can edit):

1. Copy `companion.yml` to your project's `.specify/companion.yml`.
2. Copy `nodes/*.md` to `.specify/companion/nodes/`.

The config attaches five `type: node` hooks to `after: implement-exec`; each one points at a file in `nodes/`.

**As inline hooks** (the lean form — no extra files): copy `companion.inline.yml` to `.specify/companion.yml` instead. It expresses the same tail as inline `command` and `prompt` hooks.

## How it maps to the contract

- **Anchor:** `after: implement-exec` — the window between "the build is done" and "mark the spec complete."
- **Order:** hooks at one anchor run top to bottom, exactly as listed.
- **Failure handling:** the same failure table as every hook — a missing node file is a hard error; a malformed config falls back to the shipped pipeline with a warning; a hook's own failure is reported without blocking the host command.

## Under the hood

- The orchestrator instructions that read `.specify/companion.yml` and run these hooks are the `orchestrator` part appended to every command (`presets/_parts/orchestrator.md`).
- `scripts/companion_config.py` is the executable spec of the merge contract (unit-tested in `tests/test_config.py`).
- Each node journals a `ship-<phase>` substep finish on the implement step via `write-context.py`, which is what makes the tail observable in `.spec-context.json`.
