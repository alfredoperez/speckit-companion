---
allowed-tools: Bash(node examples/todo-claude/bench/sync-templates.mjs:*), Bash(specify:*), Bash(cd examples/todo-claude:*)
description: Pull latest spec-kit + speckit-companion into the bench sandbox and re-bake the 5 variant folders
---

## Your task

Refresh the bench so a round tests **current** code, then (re)bake the five per-variant sandbox folders. Run this when `speckit-extension/` changes, when you bump the `specify` CLI, or on a fresh machine.

### 1. Latest speckit-companion (reliable)

The five folders install the companion spec-kit extension from the local `speckit-extension/` via `--dev`, so re-baking always picks up your latest source. This is the load-bearing step:

```bash
node examples/todo-claude/bench/sync-templates.mjs
```

This clones the canonical `examples/todo-claude` into `examples/bench-sandboxes/todo-{speckit,companion-logs,companion-standard,companion-turbo,companion-fast-path}/`, git-inits each, and arms each variant (strip companion for `speckit`; install + profile + preset for the four companion variants). ~15s (APFS reflink).

### 2. Latest spec-kit (best-effort)

The stock `/speckit.*` commands the sandbox uses come from the canonical `examples/todo-claude/.specify` + `.claude/commands` (checked-in fixtures). To bump them to the latest upstream spec-kit, re-emit them in the canonical sandbox **before** step 1, then re-run step 1:

```bash
cd examples/todo-claude && specify init --here --ai claude --force
```

If `specify init` isn't available or you don't want to bump upstream, **skip this** — the committed fixtures are a fine pinned baseline. Only the app's `src/` must never be touched; `specify init` only rewrites `.specify/` + `.claude/commands`.

### 3. Report

Print which variants were baked and confirm `specify extension list` (run in a companion folder) shows the companion version installed. Note whether the spec-kit fixtures were refreshed or left pinned.
