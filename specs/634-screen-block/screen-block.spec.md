# Plan screen block

Step 5 of #896. A `screen` fence in a plan is a rough wireframe, drawn by the viewer as a card with numbered notes, and held to its grammar by `check_plan.py`.

## Decisions

- Notes are the numbered lines after the fence, `1: Bold lead. Rest.`, and are consumed only when the whole block draws.
- Dot and note pairing is pure CSS (`:has`), so no listener is added to `index.tsx`.
- The whole card is one commentable line at the first body line.
- Over-budget parts or dots fall back to code in the viewer and are errors in the check; more than 2 screens is a warning.
- Changelog entries link issue #896, because no pull request is opened.
- Not collapsed: the issue's "start small, open on a click" note is left to the states block.
- Not hooked in `.specify/companion.yml`; step 6 turns the blocks on.
