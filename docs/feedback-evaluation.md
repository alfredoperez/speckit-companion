# Pipeline Builder: evaluation of the two UI reviews

Inputs: `docs/claude-feedback.md` [C] and `docs/codex-feedback.md` [X], checked against the guide, the twelve captures, the narrow VR snapshots and the panel source. 2026-09-02.

## Verdict

Both reviews find the same two broken panels and the same hidden-controls problem; [C] also finds two more defects the screenshots show (a dangling CSS selector, a hero that contradicts itself) that [X] missed.

[C] is the more accurate and specific review: about forty file:line citations, all verified apart from three cosmetic slips. [X] cites a screenshot that does not exist and mis-describes the narrow state.

[X] earns its place on judgement: the "saved but not built" state model and the two unlabelled header dropdowns are the biggest first-time-user problems, and [C] under-weights the first and never raises the second.

Merged, the reviews give four P0s (each under an hour), fourteen P1s centred on discoverability, feedback and keyboard reach, and a polish pass. The disagreements are about words (Build vs Apply, Edit vs Customize) and one widget choice.

Ship order: the four defects and a recapture first; then header labels, a status line and one resting control per phase; then interface vocabulary; the guide last, after the reshoot.

## Scorecard

| Criterion | [C] | [X] | Why |
|---|---|---|---|
| Accuracy | 5 | 3 | [C]: every load-bearing claim checks out, three trivial slips. [X]: P0s and a11y claims right; names a missing file, calls a wrapping warning clipped, recommends two things that already exist. |
| Specificity | 5 | 2 | [C]: file, line, pixel and count throughout. [X]: one CSS file and two screenshots; otherwise "the component". |
| Actionability | 4 | 3 | [C]: mostly the exact rule to write; some items lean on "queued" work outside the doc. [X]: good acceptance checks, but every cause must be located. |
| Coverage | 5 | 4 | [C]: every surface, colour, a11y, copy, guide. [X]: adds the narrow panel and the state model; thin on forms and copy; misses two defects. |
| Judgement | 4 | 4 | [C]: defects first is right; ranks guide vocabulary above header labelling it never raises; headlines colour. [X]: state model first is right; the Build rename and the narrow P1 are over-weighted. |
| Total | 23 | 16 | |

## Claims found wrong or overstated

[C]: css:739 is cited for green counts; 739 is `.pb-yours` (purple), the green rules are 711 and 1394. "Sixteen phase labels" on the hero: fourteen. "`§` has no label at all": it has a tooltip (`Canvas.tsx:714`), no visible label. Section 1.1 blames the template note's stray gaps on the missing sheet styles; they come from defect 1.2 (`TemplateForm.tsx:40`). `Header.tsx:82` is off by two lines.

[X]: cites `narrow-panel--narrow.png`, which does not exist (snapshots live in `webview/src/pipeline-builder/__screenshots__/`). "The stale warning is visually clipped": in `build-is-behind--narrow.png` it wraps to three readable lines. "A sliver of the next lane": `shipped-default--narrow.png` shows one lane and blank space. New workflow does not offer "Current, Shipped, Classic, Brownfield at once": only one of Current/Shipped appears (`AttachForm.tsx:378`). "On creation, open the seeded node": already done (`builderPanel.ts:325`). "Give pinned nodes a visible label": the Order row already says "Held in place" with the reason. "Two panels are broken": four defects are visible.

## Merged suggestions

P0 visible bug or contradiction · P1 blocks a first-time user · P2 professional polish · P3 later.

### Bugs

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 1 | Style the template panel in the `.pb-side` shell | both | `pb-sheet*` has no rule anywhere; the capture shows browser defaults | Swap to `pb-side`, `pb-side-head`, `pb-side-title`, `pb-side-close` (SVG), `pb-side-where`; recapture | P0 |
| 2 | Close the dangling `.pb-facts-mono,` selector | C | css:879 joins it to `.pb-doc`, so Writes, Needs, "Stitched in" and the template note get `flex-grow` and padding, never mono | Own rule: mono face, `--text-xs` | P0 |
| 3 | Let Add hook fields scroll under the footer | both | `.pb-form` is `1fr auto`, `.pb-form-fields` has `min-height: 0` and no overflow; the actions paint over the last field, When/Where unreachable | `.pb-form-fields { overflow-y: auto }`, opaque footer; recapture | P0 |
| 4 | Make the hero say what it shows | C | Chip says "no changes" beside two changed dots and "5 yours"; production derives `customised` from steps (`pipeline-graph.py:335`) | Derive the chip in `Header.tsx` from `graph.steps` like `changed(step)`, so a fixture cannot lie | P0 |

### Board

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 5 | One resting control per phase and step | both | Add hook, phase tools, Make it ours, node Undo and the seam `+` are all `opacity: 0`; the hero shows nothing that changes anything; touch never reaches them | A muted `+` at the right of each phase rule and step header, opening a labelled menu: Add hook · Add node · Rename · Split · Merge; seams stay as expert placement | P1 |
| 6 | Give the tail its own width | C | `.pb-outside` is a `.pb-run` grid child at `minmax(300px, 1fr)`, so a 72px button takes a lane and the board scrolls at 1280 | `grid-template-columns: repeat(var(--pb-steps), minmax(300px, 1fr)) max-content`; `--pb-steps` is already set on `.pb-run` | P1 |
| 7 | Words where glyphs guess | both | `§`, the 6px dot (no role) and the green pill mean nothing without a tooltip; three registers on one facts line | `§` → `template` chip, purple with a count once replaced; dot → the word `changed`, clickable; pill → `2 files`; one quiet mono register | P1 |
| 8 | Dashed means "add" only | C | Four meanings share one line style (css 409, 462, 788, 1262) | Solid quiet border on decisions; `auto` as a borderless card | P2 |
| 9 | Lift contrast and hit targets | X | Rules, seams and borders sit close in the light palette; phase tools are 20px, the seam 15px | Stronger phase rule; 24px minimum on icon controls; 2px ring on the open node | P2 |
| 10 | Narrow: the pane takes the body | X | Under 860px `.pb-side` is capped at `50vh` beneath a half board | The open pane replaces the board below the header, with a back control | P2 |

### Step header and phases

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 11 | Rename from the menu, or label the editable heading | C | `h3 contentEditable` (`Canvas.tsx:464`) has no role or label and looks like a label | Rename in the phase menu with a visible field; else `role="textbox"`, `aria-label`, pencil on hover | P1 |
| 12 | Phase names in `--text-label` | C | `.pb-phase-name` uses `--text-secondary` (70%), below AA on dark per `CLAUDE.md` | `color: var(--text-label)` | P2 |
| 13 | "Make it ours" becomes "Replace the whole step" in the side column | C | Hidden at rest, absent from the guide, fourth ownership phrase | Inspector action on the step with its consequence line | P2 |

### Nodes and hooks

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 14 | Replace hover "Undo" with a real revert plus in-panel undo | both | Deletes the project's copy with no confirm and no notice (`restoreNode` bypasses `write()`); not undo | "Use the shipped node" beside Edit in the inspector; the deletion posts a status line whose Undo restores the copy, held until the next write | P1 |
| 15 | Remove a node from the run | C | No way to stop running a node; the refusal at `builderPanel.ts:246` names an action the panel cannot do | Remove in the node menu; node stays under Add node; status-line Undo; reword the refusal | P1 |
| 16 | Move up, down, to phase from a menu | both | Drag is the only reorder; the grip is a non-interactive span | Node menu entries plus an `aria-live` line after each move | P1 |
| 17 | One line per hook, no arms, no HOOKS heading | both | The "Mark the spec complete" hooks block is about five times its card; `.pb-hook::before` arms read as stray `└`; text clipped at 52 chars into a tooltip | `▸ kind · name` rows under `before`/`after`, full text in the side column; delete `.pb-hook::before` | P2 |
| 18 | Non-colour cue on extension hooks | X | Stock hooks differ from yours by hue alone | A small `ext` label on stock hooks only | P2 |

### Inspector (node pane)

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 19 | Edit stops wearing purple; facts in one grammar | C | `pb-inspector-action--yours` on Edit puts the state colour on an intent button; Order is a sentence among fragments | Plain outlined Edit; purple stays on the pill, the border and "Use the shipped node"; fragments throughout | P2 |

### Add hook form

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 20 | Placement first, kind as segments | C | About 1,100px for one sentence; placement is decided last; four help texts at once | `Runs [before ▾] [Draft the spec ▾]` on top; four-segment Kind with one help line; note; consequence line | P2 |
| 21 | Rename the note field, fix the Writes placeholder, Menu for Where | C | "Anything to add optional"; placeholder mixes example and instruction; native selects remain | "Note to the assistant (optional)"; placeholder `review.md` with help text; Menu with anchor names | P2 |

### Template and other forms

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 22 | Template picker as Menu with the fragment's summary | C | Fragments have summaries the select cannot show; the empty-state line reads as an apology | Menu per section, summary under the row; "Only the shipped version exists" | P2 |
| 23 | Presets as radio cards | both | The choice is consequential and the summary appears only after picking | Reuse `pb-choice` cards with summaries | P2 |
| 24 | New step: display name derived, Writes rules, consequence under the button | both | "Reads as" is opaque; Writes states no delimiter; the consequence sits above the fields | "Display name" derived from Name; say how several files separate; move the Writes line under the button | P2 |

### Header, build and feedback

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 25 | Label the two header dropdowns | X | "This project ▾" (workflow switcher) and "Shipped default · no changes ▾" (change summary) read as peer selects | `Workflow: This project ▾`; chip reads `No changes` / `Changed · 2 steps` | P1 |
| 26 | A status line for every write | both | `write()` redraws and only refusals speak; a hook added off-screen changes nothing visible | A strip under the header: `Hook added before Draft the spec · Undo · Build to apply`; `N changes not built` while stale | P1 |
| 27 | Build and Preview report in the panel | both | `outputChannel.show(true)` steals the editor; success is a toast; Preview shows nothing in the panel | Header line `Built 14:02 · 5 commands` or `Preview: 2 commands would change`, diff in the side column by step; Output keeps the log without focus | P1 |
| 28 | A first-run line for `unconfigured` | C | `buildNotice` returns null; nothing says a change creates `companion.yml` | "This is the pipeline as it ships. Change anything and Build writes it to companion.yml." Dismissible | P1 |

### Vocabulary and copy

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 29 | Node, not block | C | Guide "block" 21 times, interface "node" 227, config `nodes:` | Retire "block" from the guide and the `Inspector.tsx:262` tooltip | P1 |
| 30 | One ownership vocabulary | both | Make it ours, yours, Use the shipped node, Undo | State `yours`; in is Edit and Save; out is "Use the shipped node"; step is "Replace the whole step" | P1 |
| 31 | Menu notes answer "what do I get" | C | "Adversarial gap review" beside "this project took it out" | "Attacks the task list for gaps before it runs" · "Creates the feature branch · removed from this run" | P2 |

### Accessibility

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 32 | Give the menu its keys | both | `role="menu"` with only Escape and click-away; no focus on open, no arrows, no return focus | Focus first item on open; arrows, Home, End, Enter; return focus; or downgrade to a listbox | P1 |

Touch and keyboard reach at rest, and announcing the changed mark, are covered by items 5 and 7.

### The guide

| # | Do | From | Why | Change | Pri |
|---|---|---|---|---|---|
| 33 | Quick start and a "before you change anything" note first, then reorder for the reader | both | Hooks are the commonest change and section six; ownership is a subsection; scope and reversibility come last | Six-step happy path (open, edit, save, preview, build, confirm), four sentences on scope, then What you see · Attach a hook · Edit and revert · Replace or add · Templates · Add a step · Workflows · Build · Broken · Where things live | P2 |
| 34 | Hero as a two-lane crop with a legend | both | A 1560px board in a docs column is a thumbnail | 760px crop of specify and plan with a legend; full board below, click to zoom | P2 |
| 35 | Add the missing states | both | No image of the changes popover, edit → yours, revert, broken state, Preview or Build result | Capture each after the fixes | P2 |
| 36 | Table headers, em-dashes, contributor note, "four steps", hover sentences | C | Three empty header rows; 27 em-dashes; a capture note in a user doc; a fifth step appears later; hover taught as the interface | Headers; full stops; note to `visual-assets.md`; "four as shipped"; drop hover sentences once item 7 lands | P2 |

Later (P3): a per-kind tick on node cards with a legend in the inspector [C]; segmented `before | after` for When [C]; "Add node", "Add step" and one phrase for "as shipped" [both]; generate the alternatives and fragments tables from `pipeline-graph.py` and capture a dark set [both].

## Where the reviews disagree

**Build vs Apply.** [X] renames Build to "Apply changes"; [C] keeps Build and reports in the panel. Keep Build: the guide, palette command, script and changelog all say build; a rename adds a third vocabulary. Take [X]'s unbuilt count beside the button.

**Action words.** [X]: Customize instructions, Switch variant, Restore shipped node; [C]: Edit, Replace, "Use the shipped node". Take [C]: "variant" is a word the user never meets and "Use the shipped node" is already in the guide. Take [X]'s "Add node" and "Add step".

**Hook rows.** [C] drops the HOOKS heading and relies on the purple rule; [X] keeps headings and badges every hook with type and owner. Take [C]'s one-line rows, plus [X]'s non-colour cue on the minority extension hooks only; a badge on every row is the noise [C] is removing.

**Destructive revert.** [X] wants a confirmation; [C] wants Undo. Take an Undo that restores the deleted copy: a modal is the wrong idiom in a VS Code panel and a node file is small enough to hold until the next write.

**Presets.** [C] wants a Menu with inline summaries; [X] wants cards. Take cards: three options to compare at once, and `pb-choice` already exists.

**Hidden controls.** [C]: one `+` menu per phase; [X]: an overflow button per phase and step, Add hook kept visible. Take one `+` at phase and step; a second permanent button per phase re-creates the clutter the stylesheet was fleeing.

**Add hook height.** [C] compacts it now; [X] makes it scroll. Scroll now (P0), segments later (P2).

**Narrow panel.** [X] makes it P1 with a stepper; [C] is silent. P2, pane-takes-body only; the warning wraps and the sliver is not in the snapshot.

**Order of work.** [C] puts vocabulary and guide reorder in "now"; [X] puts docs last and the state model first. Defects, then header labels and the status line, then interface vocabulary, then the guide after the reshoot.

## What neither review caught

1. The header's workflow dropdown (`Header.tsx:128`) has no Escape, no click-away and no role; only `Menu` has those. The most-used menu on the screen is the least finished. P1.
2. The code's own discoverability rationale is broken twice: css:1275 hides the seam `+` because "every phase carries an explicit Add hook button", and `Canvas.tsx:478` says "+ node" is "shown even with nothing to offer"; both sit in groups that are `opacity: 0`. Item 5 restores the design's intent.
3. `--pb-steps` is set on `.pb-run` (`Canvas.tsx:808`) and never read by the stylesheet, so item 6 is one line.
4. Defect 2 reaches further than [C] says: the template panel's "What  specify  writes" gaps and the inspector's "Stitched in here at build time" gap (`Inspector.tsx:228`) are the same rule; styling the template shell alone leaves them.
5. The seam is a 15px-tall target (css:1253), the smallest interactive element on the board; [X]'s size note covers only the 20px phase tools.
