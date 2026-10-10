# Screens in the plan

A screen block sketches what a person sees, before it is built: the parts on the page, which of them the change adds or alters, and a short note on each part that needs one. A reviewer sees the change the way a user will.

It is a rough wireframe, not a design. Parts are boxes with words in them, never HTML, sizes or colours.

The Companion plan step writes this block when the change needs it: one deciding step, `pick-blocks`, picks the blocks and records the choice as `planBlocks`. A project on the stock pipeline, or one that always wants the block, can still attach the part with the hook below. It adds one section to `plan.md`, written only when the change alters what a person sees, and every other renderer shows the block as plain code.

## Attach it by hook

Add the hook to `.specify/companion.yml`:

```yaml
commands:
  plan:
    hooks:
      after:
        plan-doc:
          - { type: node, ref: screens }
```

Then build, from the Workflow Builder in VS Code. If you do not build, copy [`presets/_parts/screens.md`](../presets/_parts/screens.md) to `.specify/companion/nodes/screens.md`, where your assistant looks for it. A copy in your project wins over the shipped one, which is how you change its wording.

## The grammar

````markdown
## Screens

```screen settings The settings page, with a way to save
title: Settings
row:
  field: Display name (changed) (1)
  field: Email
row:
  chip: Draft
  button: Save changes (new) (2)
text: Changes apply the next time you open the page.
list: General | Account | Billing (changed) (3)
```
1: **The name is editable.** It was read only before.
2: **Save is the only new control.** It writes the record and closes the page.
3: **The list gains Billing.** General and Account are untouched.
````

| Part | Rule |
|---|---|
| Fence | ```` ```screen <name> <title> ````. The name is one word that other blocks can refer to; the rest is the title. |
| One part a line | `kind: text`, with exactly these kinds: `title`, `row`, `text`, `chip`, `button`, `field`, `list` |
| `row:` | Lays its children out side by side. It holds no text, and only a row has parts under it. |
| Indent | Two spaces a level, never more than one deeper than the line above. No tabs. |
| `field: label` | A labelled empty input |
| `list: a \| b \| c` | Items split on `\|` |
| `(new)` `(changed)` | A suffix for what the change touches: green and amber edges. A part takes at most one. Marks and dots belong to the whole part and go at the end of the line: written in the middle of a `list:` they are plain text. |
| `(1)` | A numbered dot, as a suffix, on any part line. A part takes at most one, and a number is used once. |
| Notes | After the fence, one line per dot: `1: Bold lead. Rest of the sentence.` The first sentence is drawn bold. |

The budget is 2 screens a plan, 14 parts a screen and 5 dots. A change sized `simple` writes none.

## What the viewer does

The spec viewer draws the block as a card. The header carries an outlined `screen` badge, the title and a quiet count of the notes. The body is the wireframe in a dashed frame, with the notes as a numbered list underneath. A dot sits outside the top-right corner of its part and never covers its text.

Hover or focus a note and its dot lights up. Hover or focus a dot and its note lights up. Dots are buttons you can tab to, and each is labelled with its note. There is no popover. The Copilot board has no hover layer, so there the dots and notes are shown as they are.

A line comment works on the block as a whole. Every string is shown as text, so a note that contains markup shows the markup.

**The viewer falls back to the plain code block** when anything breaks the grammar: an unknown part, a bad indent, a dot with no note, a note with no dot, or a block over budget. Nothing is lost, and the check below names the cause.

A `states` block can point at a screen by its name with `shows <name>` on a state line. Picking that state draws the screen's wireframe, with its dots, under the caption of the states card. The screen block can sit before or after the states block. The notes list is not repeated there, and the Copilot board shows nothing extra.

## The check

```bash
python3 .specify/extensions/companion/scripts/check_plan.py --feature-dir specs/<your-spec>
```

It reads `plan.md` (and `screens.md` beside it, if a project moved the section there). The same script checks call paths, and a plan with no `screen` block prints nothing about screens.

| Level | Rule | What it found |
|---|---|---|
| ERROR | `unknown-part` | A part kind outside the seven |
| ERROR | `bad-indent` | A tab, an odd indent, a skipped level, a part under a part that is not a row, or an indented first line |
| ERROR | `dot-without-note` | A `(n)` dot with no `n:` note under the block |
| ERROR | `note-without-dot` | An `n:` note with no `(n)` dot in the block |
| ERROR | `duplicate-screen` | Two screens with the same name |
| ERROR | `over-budget` | More than 14 parts or 5 dots in a screen |
| ERROR | `malformed` | A line that is not `kind: text`, a row with text, a part with none, an empty list item, a repeated dot or note, no name or a name that is not one word, an empty or unclosed block |
| WARNING | `over-budget` | More than 2 screens in a plan |
| WARNING | `no-title` | A screen with a name and no title |
| WARNING | `simple-size` | A screen in a spec sized `simple` |

It reads no code, so it proves the block will draw, not that the screen is right.

**It always exits 0**, because a check never fails the step it runs in. The result is recorded when the plan step closes, as a `plan blocks check out` verification with its exit code, and a later close replaces it. Fix what it reports once and record anything left as a concern. `--json` prints the same findings, and `--plan <file>` checks one file.
