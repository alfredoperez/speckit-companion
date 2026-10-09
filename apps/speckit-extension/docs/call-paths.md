# Call paths in the plan

A call path shows the shape of a change before any code is written: which entry point is hit, which functions it reaches in order, which of them are new, changed or removed, and where each one lives. A reviewer sees the blast radius, and implement starts at the right files.

It is not the code. A line carries a name and a location, never a body, a signature or pseudo-code.

The node is attachable and off by default. It adds one section to `plan.md`, and every other renderer shows the block as plain code.

## Turn it on

Add the hook to `.specify/companion.yml`:

```yaml
commands:
  plan:
    hooks:
      after:
        plan-doc:
          - { type: node, ref: call-paths }
```

Then build, from the Pipeline Builder in VS Code. The build finds the node inside the extension and writes it into your plan command.

If you do not build, your assistant reads the hook at run time and looks for the node in your project, so copy [`presets/_parts/call-paths.md`](../presets/_parts/call-paths.md) to `.specify/companion/nodes/call-paths.md`. A copy in your project also wins over the shipped one, which is how you change its wording.

It attaches after `plan-doc` because that is where the investigation is freshest, and the section is in `plan.md` before the design documents are written from it.

## The grammar

````markdown
## Call paths

```calls A stock run's finished step lands in the record
  session.idle @ apps/copilot-canvas/extension.mjs:153
~   settle() @ apps/copilot-canvas/server.mjs:187
      reviewRuns() @ apps/copilot-canvas/server.mjs:117
~     didStep() @ apps/copilot-canvas/server.mjs:114
+     writeRecord() @ apps/copilot-canvas/server.mjs:160
+       recordStep() **new** @ apps/copilot-canvas/run-record.mjs
```
note: only a run the board sent, in a project with no context writer, is written.
````

The example is this repo's Copilot board, written the way a plan for adding its record writer would read. The line numbers are from the day this page was written.

| Part | Rule |
|---|---|
| Fence | ```` ```calls <title> ````, the title naming the behaviour in a few words |
| First line | The entry point, at no indent. One per block. |
| Column 0 | `+` new, `~` changed, `-` removed, a space for a function that is on the path and stays as it is. Column 1 is always a space. |
| Indent | Two spaces per level after that, and never more than one level deeper than the line above. No tabs. |
| Name | The function, with `()` if you like. Nothing else. |
| `@ path:line` | Where it lives, as a path from the repo root. A `+` in a file that exists cites the line it goes after. |
| `**new** @ path` | The file does not exist yet. Only on a `+` line, and with no line number. |
| `note:` | One optional line straight after the block |

The budget is 3 blocks a plan, 12 lines a block and one `note:` line. A change sized `simple` writes none, and a change inside one function or file says so in a sentence.

## The check

```bash
python3 .specify/extensions/companion/scripts/check_plan.py --feature-dir specs/<your-spec>
```

It reads `plan.md` (and `call-paths.md` beside it, if a project moved the section there) and opens every cited file. A plan with no `calls` block prints nothing.

| Level | What it found |
|---|---|
| ERROR | A cited file that does not exist, which covers a `-` line too |
| ERROR | A line number past the end of the file |
| ERROR | A `**new**` file that already exists |
| ERROR | A line it cannot parse: no mark column, no `@ path`, an odd or skipped indent, a tab, a second entry point, a path outside the repo, an empty or unclosed block |
| WARNING | The name is not within 8 lines of the cited line. Not checked on a `+` line, whose function is not there yet. |
| WARNING | An existing file cited with no `:line`, which is how the plan says "not verified" |
| WARNING | Over budget: more than 3 blocks, more than 12 lines, more than one `note:` line, or a block with no title |
| WARNING | A block in a spec sized `simple` |

It proves the files and lines are real. It cannot prove that one function calls another, and line numbers go stale once implement edits the files, so it belongs to the plan step. The result is recorded when the plan step closes, as a `plan blocks check out` verification with its exit code, and a later close replaces it, so it is still there after implement has moved the lines.

`--json` prints the same findings plus every declared path, for a bench or a script. `--plan <file>` checks one file, and `--root <dir>` says where cited paths resolve from.

**It always exits 0**, because a check never fails the step it runs in. The node has the assistant fix what it reports once and record anything left as a concern. To make it a gate, run it with `--strict`, which exits 1 on any error, from CI or from a `command` hook of your own. Warnings never change the exit code.

## Credit

The notation follows the call stacks in Thariq Shihipar's `html-plan` plugin for Claude Code, so a plan written by either tool reads alike. The node, the check and this page are our own.
