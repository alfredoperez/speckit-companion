# Plan: Check the requirements by default above small size

## Summary

`check-requirements` moves from implement's optional list into its default order, between the build and the verified record, and the brownfield workflow gets it in the same place. The node gains a size gate as its opening line (skip at `simple`, run otherwise, a missing size counts as `normal`), worded like plan's and tasks' size budgets, and an inline fallback for a host that cannot dispatch a worker. Everything else in the check stays as written. The implement command is rebuilt, and the docs describe the new default.

## Project Structure

```text
apps/speckit-extension/
├── nodes/implement/
│   ├── _order.yml               # check-requirements into order and the execute phase; out of optional
│   └── check-requirements.md    # "6a." size gate first line; inline fallback
├── workflows/presets/brownfield.yml  # same slot in its implement nodes and execute phase
├── commands/speckit.companion.implement.md  # rebuilt
├── docs/node-model.md           # implement row lists the check
├── tests/test_requirements_check.py  # new: order, gate, add-ons, brownfield
└── CHANGELOG.md
apps/website/src/content/docs/docs/steps/index.mdx  # Implement section
```

**Structure Decision**: the gate lives in the node's own text because no mechanism skips a node by size, and a simple run still reaches implement.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: a project recipe that lists implement nodes keeps exactly its list. |
| II. Spec-Driven Workflow | PASS: requirements are checked against the code by someone other than the builder. |
| III. Visual and Interactive | PASS: the builder shows the node as a box instead of an add-on; no UI code changes. |
| IV. Modular Architecture | PASS: order and node text only. |

## Key Decisions

- **Gate inside the node.** Rejected: a new `_order.yml` size key, which would be a second mechanism for one node.
- **Inline fallback.** A host without subagents reads the requirements and the diff itself, fresh, without the plan. Rejected: no fallback, which leaves Copilot and one-shot hosts with an instruction they cannot follow now that the check runs by default.
- **Number it 6a.** It sits between implement-exec's step 5 and record-verified's 6b.
- **Workflow Builder docs need no edit.** That page names neither optional implement node.
