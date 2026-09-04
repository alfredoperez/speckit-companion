# Examples and sandboxes

Two kinds of folder live here, and the difference is whether git tracks them.

## Fixtures — committed, read-only

`examples/todo-*` are baked projects the tests and the docs read from. Each is one provider or one storage layout of the same tiny todo app, so a screenshot or a bench cell has something real to point at. Treat them as fixtures: do not run a spec through one in place.

| Folder | What it is |
|---|---|
| `todo-claude/` | The canonical app, plus `bench/` — the adoption-ladder eval harness and its README |
| `todo-copilot/`, `todo-gemini/` | The same app set up for other providers |
| `todo-living-central/`, `todo-living-colocated/` | The two living-spec storage layouts |
| `todo-gsd-superpowers/`, `todo-matt-skills/` | Skill-pack comparison fixtures |

The spec-kit extension keeps its own example at `speckit-extension/examples/ship-ticket/` — five real node files and two configs, the ship-tail a project can copy.

## Sandboxes — gitignored, yours to break

`examples/bench-sandboxes/` is the one place a throwaway project goes. Everything in it is gitignored, and each folder is its **own git repo** so the capture writer resolves the sandbox as the project root rather than this repository. Open a sandbox as its own VS Code window; opening the whole repository points the pipeline at the extension's `.specify/`, not the sandbox's.

| Folder | For | Made by |
|---|---|---|
| `bench-sandboxes/todo-{speckit,companion}/` | The stock-vs-companion bench, one cell at a time | `bench/sync-templates.mjs` |
| `bench-sandboxes/ls-*` | Living-spec adoption-ladder cells | the bench drivers |
| `bench-sandboxes/582-fresh-install/` | A fresh `specify init` with nothing else, for install-path bugs | by hand |
| `bench-sandboxes/builder-qa/` | The pipeline builder's manual test plan — hook fixtures and two run prompts are already in it | by hand; the recipe is in `RUNS.md` inside it |

A sandbox points at whichever extension source it was installed from. After a branch merges, re-point it:

```bash
cd examples/bench-sandboxes/<name>
specify extension add ../../../speckit-extension --dev --force
```

**Do not make a sandbox anywhere else.** Four earlier ones — `~/dev/GitHub/speckit-status-sandbox`, `~/dev/stock-capture-sandbox`, `~/dev/GitHub/sandbox/speckit`, `~/dev/GitHub/sandbox/custom-ai-workflow-demo` — were one-offs from July that nothing references now. They are the reason this file exists.
