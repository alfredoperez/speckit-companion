---
allowed-tools: Bash(. .claude/sandboxes-env.sh:*), Bash("$SANDBOXES_REPO"/new-sandbox.sh:*), Bash(ls:*)
description: Build a throwaway SpecKit test sandbox from a recipe, or list the recipes and the sandboxes that exist
argument-hint: "[<recipe> [name] [--dev] | where]"
---

## Your task

Build one test sandbox, or show what there is. A sandbox is a small throwaway project in a known starting state; the recipes live in the sibling `speckit-sandboxes` repo and every built sandbox lands under its sandbox root, never in this repo.

Shell state does not persist between Bash calls, so start each one with `. .claude/sandboxes-env.sh`. It sets `$SANDBOXES_REPO` (the sibling checkout) and `$SANDBOXES_DIR` (the sandbox root). If it says there is no checkout, relay that line and stop.

### Read `$ARGUMENTS`

- **empty**: list. Print the recipes, then the sandboxes that already exist:

  ```bash
  . .claude/sandboxes-env.sh && "$SANDBOXES_REPO"/new-sandbox.sh --list
  . .claude/sandboxes-env.sh && ls -1 "$SANDBOXES_DIR" 2>/dev/null || echo "(no sandboxes yet)"
  ```

  Show both as two short lists, with the root's path above the second. Do not build anything. Two folders in the second list are not sandboxes, so say what they are when they show up: `bench-cells` holds the benchmark's cells and `awesome-copilot` is `/publish-canvas`'s upstream clone.

- **`where`**: print the sandbox root and nothing else.

  ```bash
  . .claude/sandboxes-env.sh && "$SANDBOXES_REPO"/new-sandbox.sh --where
  ```

- **`<recipe> [name]`**: build one. The name defaults to the recipe, and a name that is taken is never reused: the new sandbox becomes `<name>-2`, then `-3`.

  ```bash
  . .claude/sandboxes-env.sh && "$SANDBOXES_REPO"/new-sandbox.sh <recipe> [name]
  ```

- **`<recipe> [name] --dev`**: the same, with Companion installed from this checkout in place of the published build. `COMPANION_DIR` points the recipe here; without it the recipe uses the `speckit-companion` folder beside the sandboxes repo, which is not this checkout when you are in a worktree.

  ```bash
  . .claude/sandboxes-env.sh && COMPANION_DIR="$PWD" "$SANDBOXES_REPO"/new-sandbox.sh <recipe> [name] -- --dev
  ```

  A recipe with no Companion (`vscode-qa-stock`, `copilot-stock`, `claude-mod-stock`) refuses `--dev`; say so and build nothing.

Anything else after the name goes to the recipe after `--`, unchanged: `living-specs` takes its scenario that way (`/sandbox living-specs drift-check ls-6`). An unknown recipe prints the list; relay it.

### Report

The recipe ends by printing `Sandbox ready: <folder>` and what to do in it. Relay exactly that: the folder, and what to type next. Add nothing of your own, and do not open the folder or run anything in it.

### Guardrails

- This command never deletes anything: not a sandbox, not a file inside one, not the root. Throwing a sandbox away is the user's call and the user's `rm`.
- It never builds over an existing folder, and never writes into this repo.
- A build that fails leaves its half-built folder in place. Name it in the report so the user can look, and do not clean it up.
