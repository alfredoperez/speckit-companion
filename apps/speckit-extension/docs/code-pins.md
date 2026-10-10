# Code pins in the plan

A code pin is a note that sits under the line of code it explains. A plan shows a few lines of code, and where one of them needs a sentence to be understood, the sentence is pinned to that line instead of floating in the paragraph around it.

The code is either a sketch, which is code that does not exist yet, or a citation, which is real lines copied from a file. The fence says which, so a reviewer never mistakes a proposal for what the code does today.

The Companion plan step writes this block when the change needs it: one deciding step, `pick-blocks`, picks the blocks and records the choice as `planBlocks`. A project on the stock pipeline, or one that always wants the block, can still attach the part with the hook below. It asks for a code fence that names a file, and every other renderer shows the block as plain code with the pins as text below it.

## Attach it by hook

Add the hook to `.specify/companion.yml`:

```yaml
commands:
  plan:
    hooks:
      after:
        plan-doc:
          - { type: node, ref: code-pins }
```

The same hook works after `tasks-doc` under `commands.tasks`, for a task list that shows the lines a task starts from.

Then build, from the Pipeline Builder in VS Code. The build finds the node inside the extension and writes it into your command.

If you do not build, your assistant reads the hook at run time and looks for the node in your project, so copy [`presets/_parts/code-pins.md`](../presets/_parts/code-pins.md) to `.specify/companion/nodes/code-pins.md`. A copy in your project also wins over the shipped one, which is how you change its wording.

It attaches after `plan-doc` because that is where the files were just read, so a citation is copied from the file and not from memory.

## The grammar

````markdown
```ts sketch src/money/add.ts hl=2
export function add(a: number, b: number) {
    return Math.round((a + b) * 100) / 100;
}
```
pin 2: rounded here, so callers never see a third decimal.

```ts src/money/total.ts:40-42 hl=41
export function total(items: Item[]) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```
pin 41: this is the sum that drifts, and the line the sketch replaces.
````

| Part | Rule |
|---|---|
| Language | Required, and first on the fence. A fence with no language is never a code block. |
| `sketch <file>` | Code that does not exist yet. Lines are numbered from 1. The file may already exist, since new code can land in an old file. |
| `<file>:<from>-<to>` | Real lines, copied as they are. Lines are numbered from `<from>`, and the body is exactly as long as the range. One line is written `:40-40`. |
| File | A path from the repo root |
| `hl=3,6-7` | Optional, and the only other word allowed. Numbers and low-to-high ranges split by commas, naming lines to highlight. |
| `pin N: text` | A note under line N. Pins go straight after the fence, one a line, and a blank line before the first is fine. The first line that is not a pin ends them. |
| Numbers | `hl` and `pin` use the numbers the card shows, so a citation of lines 40-42 pins with `pin 41:` |

A pin may use inline markdown such as `code` and **bold**; any other markup typed in a pin shows as text.

The viewer draws the block as a card. A small tag after the file path says `sketch` (green, new code) or the cited lines (neutral). A cited path opens the file, a sketch path is plain text. The code is syntax coloured like any other fence, a long line scrolls the code sideways while pin notes wrap in place, and each pin sits under the code column of its line.

The budget is 12 lines a sketch and 3 pins a block, sketch or citation. A code fence that names no file this way is left alone.

## The check

```bash
python3 .specify/extensions/companion/scripts/check_plan.py --feature-dir specs/<your-spec>
```

It reads `plan.md` and `tasks.md` and opens every cited file. It is the same script that checks [call paths](./call-paths.md), and a plan with neither block prints nothing.

| Level | What it found |
|---|---|
| ERROR | A cited file that does not exist |
| ERROR | A range that runs past the end of the file |
| ERROR | A citation whose body is not as long as its range |
| ERROR | A block the viewer would not draw: a `sketch` with no file, a word after the file that is not one `hl=`, a bad `hl` value, a path outside the repo, a range that does not count from 1 or runs high to low, an empty or unclosed block, a highlight or pin outside the lines shown, a pin with no text |
| WARNING | Cited text that differs from the file once trailing spaces are dropped. One finding a block, naming the first line that differs. |
| WARNING | A cited file that could not be opened, so the block is unverified |
| WARNING | Over budget: a sketch over 12 lines, or a block with more than 3 pins |

It proves a citation is the file's own lines today. Line numbers go stale once implement edits the files, which is why drifted text is a warning, and why the check belongs to the step that wrote the block. A sketch is not compared with anything.

`--json` prints the same findings with a `code_blocks` count, for a bench or a script. `--plan <file>` checks one file, and `--root <dir>` says where cited paths resolve from.

**It always exits 0**, because a check never fails the step it runs in. To make it a gate, run it with `--strict`, which exits 1 on any error. The node has the assistant fix what the check reports once. The result is recorded when the plan step closes, as a `plan blocks check out` verification with its exit code, and a later close replaces it, so a failing check shows on the spec instead of stopping the step. Warnings never change the exit code.
