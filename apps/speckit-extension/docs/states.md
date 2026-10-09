# States in the plan

A states block shows a lifecycle the change adds or alters: the states, the arrows between them and where each sits on a grid. In the spec viewer it is a diagram you click through, and picking a state shows its sentence underneath.

It is not the code. A state carries a name and one sentence, never a type, a field or a function.

The node is attachable and off by default. It adds one section to `plan.md`, and every other renderer shows the block as plain code.

## Turn it on

Add the hook to `.specify/companion.yml`:

```yaml
commands:
  plan:
    hooks:
      after:
        plan-doc:
          - { type: node, ref: states }
```

Then build, from the Workflow Builder in VS Code. Without a build, copy [`presets/_parts/states.md`](../presets/_parts/states.md) to `.specify/companion/nodes/states.md`. A copy in your project wins over the shipped one, which is how you change its wording.

It sits beside [call paths](./call-paths.md) at the same anchor, and the two can be attached together.

## The grammar

````markdown
## States

```states A review's lifecycle
Draft: Edited, not sent yet. (start)
Sent: Waiting on a reviewer.
Held: Parked until picked up. (proposed)
Done: Merged. (final)
Draft -> Sent: submit
Sent -> Held: park (proposed)
Held -> Sent: resume (proposed)
Sent -> Done: approve
grid:
Draft | Sent | Done
.     | Held | .
```
note: only the parked state is new.
````

| Part | Rule |
|---|---|
| Fence | ```` ```states <title> ````, the title naming the lifecycle in a few words |
| State | `name: one sentence`. The name is plain text with no colon. |
| Marks | After the sentence, in any order: `(start)`, `(final)`, `(proposed)`. With no `(start)` the first state starts. |
| `shows <screen>` | Optional, last on the line. Kept for the screen block; nothing draws it yet. |
| Arrow | `from -> to: label`, with `(proposed)` after the label for an arrow the change adds. A state can point at itself. |
| `grid:` | Rows of state names after it. Cells split on `\|`, or on spaces when every name is one word. `.` is an empty cell. |
| `note:` | One optional line straight after the block |

The budget is 2 blocks a plan, 8 states a block, a grid of 4 columns by 3 rows and one `note:` line. A change sized `simple` writes none.

## What the viewer draws

Rounded boxes on the grid, arrows with their labels, and a dashed green outline for what is proposed. Each state is a button with a hover and a focus ring. The start state is picked first, and clicking another shows its sentence in the caption under the diagram. The accent colour marks the picked state and nothing else, and arrows stay neutral. The header carries `4 states`, and `1 proposed` when there is one.

The pick is local to the page: it is not saved, and a redraw puts it back on the start state.

A block that does not parse, or goes over the budget, stays the plain code block it is in any other reader. A comment on the block is a comment on the whole block.

The Copilot board has no click, so there the diagram is static and every state's sentence is listed under it.

## The check

```bash
python3 .specify/extensions/companion/scripts/check_plan.py --feature-dir specs/<your-spec>
```

It is the same check that reads call paths, and it reads `states` blocks too.

| Level | What it found |
|---|---|
| ERROR | A state nothing reaches from the start |
| ERROR | A state with no way out that is not marked `(final)` |
| ERROR | A state missing from the grid, or none placed because there is no `grid:` |
| ERROR | An arrow or a grid cell naming a state that is not listed |
| ERROR | Over the viewer's limit: more than 8 states, or a grid past 4 by 3 |
| ERROR | A line it cannot parse: a state with no sentence, a repeated name, a second `grid:`, more than one `(start)`, an empty or unclosed block |
| WARNING | More than 2 blocks, more than one `note:` line, or a block with no title |
| WARNING | A block in a spec sized `simple` |

Over-budget is an error here because the viewer draws nothing past it, and the block would only show as code.

The node has the assistant run the check, fix what it reports once, and record the result with `write-context.py --verify-run`. Like the call-path check it always exits 0, and `--strict` exits 1 on any error.
