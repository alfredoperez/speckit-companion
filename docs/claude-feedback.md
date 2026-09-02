# Pipeline Builder: UI and UX review

Reviewer: Claude. Date: 2026-09-02. Scope: `docs/pipeline-builder.md`, its twelve generated screenshots, and the panel's source: `Canvas.tsx`, `Header.tsx`, `Inspector.tsx`, `AttachForm.tsx`, `TemplateForm.tsx`, `Menu.tsx`, `BrokenPipeline.tsx`, `index.tsx`, `pipeline-builder.css`, and `builderPanel.ts`. Review only; nothing was changed.

The panel has a strong idea: the run is a sequence, so draw it as one, and mark everything the project changed in one colour so "what did we change" needs no reading. What stands between that idea and a professional, intuitive tool is not the idea. It is four rendering defects the guide's own screenshots expose, a board where every way to change something is invisible until you hover, meaning that lives in tooltips, a vocabulary that says "block" in the guide and "node" in the interface, and a colour system that promises one hue and spends five.

## The short version

- **Four defects are visible in the published screenshots.** The template panel has no stylesheet at all, a dangling CSS selector breaks the inspector's facts, the Add hook footer paints over its last field, and the hero image contradicts itself. All four are one-line to one-hour fixes. Fix them before anyone else reviews from the pictures.
- **The board hides every affordance until hover.** Add hook, the phase tools, the seams, "Make it ours" and "Undo" are all `opacity: 0` at rest. In the hero screenshot there is not one visible control that changes anything. That is the single biggest reason the panel feels hard to learn.
- **Meaning is delegated to tooltips.** The changed dot, the § chip, the green file count, the lock, the + and − on a phase: nineteen `title` attributes in `Canvas.tsx` carry information the surface should carry.
- **Two vocabularies.** The guide teaches "block" (21 uses); the interface says "node" (227 uses, one "block" in a tooltip); the configuration file says `nodes:`. Ownership is said four ways: "Make it ours", "yours", "Use the shipped node", "Undo".
- **The colour promise is not kept.** The stylesheet says one hue means "the project changed this". The board uses purple for that, blue for the "Customised" chip that means the same thing, green for file counts, the accent for go and selection, amber for stale.
- **Nothing confirms success.** Every write redraws the board silently; only refusals speak. Build and Preview report in the Output channel and a VS Code toast, never in the panel that asked.
- **The guide is well written and mis-ordered.** Hooks are the most common change and the sixth section; the ownership model is a subsection of "Reading a block"; the hero is a 1560px board that becomes a thumbnail in a docs column; three tables have empty header rows.

## What to keep

- **The run drawn left to right with real sequence numbers.** The numbers encode something true. Keep them.
- **One colour for what the project owns.** The rule is right; the execution needs tightening (section 3).
- **The inspector renders the instruction, not the file.** Opening a node and reading what it tells the assistant, with frontmatter and fences stripped, is the panel's best moment.
- **The broken state.** Repairs as buttons, each saying what it costs, the destructive one drawn as destructive, the manual escape kept and made smaller. This is the most professional screen in the panel.
- **The panel's own menu.** Replacing the native selects with a list that has a label and a note per option was the right call. Finish the job: three forms still use native selects (section 5).
- **Hooks as one block per anchor with before and after in words.** Much better than arrows. The block's own header is the part to reconsider (3.3).
- **Forms say what they will write.** "Writes `.specify/companion/workflows/name.yml` and switches to it" is the kind of sentence every destructive-adjacent form should carry.

## 1. Defects the screenshots show

### 1.1 The template panel is unstyled

`builder-template.png`: the title sits at x=0 with no padding, the close control is a raw `×` button with a default border, the note's inline code has stray padding. `TemplateForm.tsx` renders `pb-sheet`, `pb-sheet-head`, `pb-sheet-title`, `pb-sheet-close`, `pb-sheet-note`. There is no rule for any of them anywhere in `webview/styles`. The form has been shipping with the browser's defaults.

Fix: render it in the `.pb-side` shell every other side panel uses (`pb-side-head`, `pb-side-title`, `pb-side-close` with the SVG close, `pb-side-where`). That also gives it the close button the other forms have and the narrow-panel behaviour at the end of the stylesheet.

### 1.2 A dangling selector breaks the inspector's facts

`pipeline-builder.css:879` reads `.pb-facts-mono,` followed by two blank lines and then `.pb-doc { flex-grow: 1; padding: ... }`. The comma joins them, so every `pb-facts-mono` span gets `flex-grow: 1` and 12px by 16px of padding, and never gets the mono face the class name promises. `builder-read-block.png` shows the result: `spec.md` and `resolve-dir` float to the right in a proportional face with extra height. The same class in the Edit view's note ("Leave the `speckit-companion:part` lines") is affected.

Fix: give `.pb-facts-mono` its own rule (`font-family: var(--font-mono); font-size: var(--text-xs)`), closed with a brace.

### 1.3 The Add hook footer paints over the form

`builder-attach.png`: the "Add hook" button overlaps the "Anything to add" input, and the When and Where controls plus the "Adds to companion.yml" line are nowhere. `.pb-form` (line 1059) is a grid of `1fr auto` with `overflow: auto`; `.pb-form-fields` (1069) has `min-height: 0` and no overflow of its own. The fields track shrinks below its content, the content overflows the track, and the actions row is laid out after the track and painted on top of the overflow.

Fix: `.pb-form-fields { overflow: auto; }` so the fields scroll inside their track and the footer stays clear. Then the form is still too tall for what it asks (section 5.1).

### 1.4 The hero contradicts itself

`builder-board.png`: the header chip says "Shipped default · no changes"; the same header says "5 hooks · 5 yours"; two steps carry the changed dot. The story sets `customised` by hand while the per-step changes come from the fixtures. In production `pipeline-graph.py:335` derives `customised` from the steps, hooks included, so the real panel would say "Customised". The picture the guide opens on is one the product cannot produce.

Fix: set `customised: true` in the story. Better: derive the chip in the webview from `graph.steps` the way `changed(step)` already does, so there is one truth and a fixture cannot lie.

## 2. Intuitive: what a first-time user can find

### 2.1 Nothing at rest says "you can change this"

`pb-attach` (614), `pb-phase-tools` (1552), `pb-step-replace` (550, 1608), `pb-node-action` (713) and the seam's `+` (1244) are all `opacity: 0` until hover. The seams between nodes are visible, but as dashed separators, which is what a dashed line between two cards reads as. Result: the board looks like a diagram. A reader who does not already know to hover a phase header cannot discover that hooks exist, that phases split and merge, or that a node can be added.

Recommendation: one resting affordance per phase header, not four hidden ones. A quiet `+` at the right edge of the phase rule, always present at `--text-muted`, brightening on hover, opening a small menu: Add hook, Add node, Split phase, Merge into phase above. The seams stay as the precision placement for people who know. The step header gets the same single `+` for step-level hooks. Fewer controls visible, but visible.

### 2.2 Meaning lives in tooltips

`Canvas.tsx` carries nineteen `title` attributes. The ones doing real work: the changed dot (693) explains what changed only on hover; `§` (the template chip, css 1407) has no label at all, which the user already had to ask about; the green pill with a file icon (css 1394) says "produces" only on hover; the lock says why the node cannot move only on hover; the phase `+` and `−` are split and merge only on hover.

Recommendation: text where a glyph is guessing. `§` becomes a chip that says `template` (purple with a count once a section is replaced). The dot becomes a word: `changed`, in purple, clickable, opening the same summary the header chip opens. The file count reads `2 files`. The phase tools become labelled entries in the menu from 2.1. Tooltips stay as the second layer, never the only one.

### 2.3 Phase names are secretly inputs

`Canvas.tsx:464` makes the `h3` `contentEditable`. At rest it looks like a label. On hover it gets a background; only then does the cursor say "text". It has no `role`, no `aria-label`, and Enter and Escape are the only keys handled. The guide never mentions renaming a phase.

Recommendation: rename from the phase menu (2.1), which opens the name for editing with a visible field and a Save. If inline editing stays, give the heading `role="textbox"`, an `aria-label`, and a pencil that appears with the hover state so the affordance is announced before the click.

### 2.4 "Undo" is not undo, and nothing can be removed

The hover control on a replaced node (`Canvas.tsx:391`) says "Undo" and its tooltip says "Delete your copy and go back to the shipped node". It is a destructive revert, not an undo of the last action; it deletes the project's file with no confirmation; and `restoreNode` in `builderPanel.ts:243` bypasses `write()`, so it produces no notice either way. Meanwhile there is no way to remove a node from the run at all: the `−` on a phase merges it into its neighbour, and the only path to "stop running this node" is "Open companion.yml".

Recommendation (already agreed in the queue): a trash on node hover that removes the node from the run and keeps it offered under "+ node", with an in-panel notice that carries a real Undo. Rename the current "Undo" to "Use the shipped version" and move it into the inspector beside Edit, where its consequence can be read.

### 2.5 Reordering is drag-only

Drag and drop is the only way to move a node, and a pinned node explains itself only on hover. There is no keyboard or menu path, which also means no path on a trackpad-hostile day and no path for a screen reader.

Recommendation: "Move up" and "Move down" in the inspector's action row, or in the node's hover menu. The same menu is the natural home for Remove (2.4), which gives one gesture for everything that happens to a node.

### 2.6 Build and Preview answer somewhere else

`pipelineBuildCommands.ts:81` calls `outputChannel.show(true)` on every Build and Preview, so the Output panel takes over the editor; success is a VS Code toast (line 94); the builder panel itself never says "built". "Preview" implies the panel will show something. It shows nothing; the dry-run text lands in the Output channel.

Recommendation: the header keeps a build line under the chip: `Built 14:02 · 5 commands · 7 emissions` or `Preview: 2 commands would change`. Preview's result belongs in the side column as a list of the commands that would change, with the diff behind a click. The Output channel stays for the full log, without stealing focus.

### 2.7 Success is silent

`write()` in `builderPanel.ts:347` redraws and speaks only when refused (line 360). After Replace, Add hook, a drag, a rename, a template pick, the board redraws and that is the whole feedback. When the write is small (a hook added at the bottom of a lane that is scrolled away) nothing visible changes at all.

Recommendation: a status line at the foot of the header, or a transient strip at the bottom of the board: `Hook added before Draft the spec · Undo · Build to apply`. One place, one sentence per write, with Undo where it is cheap. This is also the vehicle for the queued "remove with notification".

### 2.8 First run explains nothing

The `unconfigured` state shows the shipped pipeline with no notice (`Header.tsx:82` returns null). "Reading the pipeline…" is the whole loading state. Nothing says what the board is, that changing anything will create `companion.yml`, or that Build is the step that makes changes real.

Recommendation: one dismissible line for the unconfigured state: "This is the pipeline as it ships. Change anything here and Build writes it to companion.yml." Say it once and never again.

## 3. Professional: the visual system

### 3.1 One hue promised, five spent

Purple (`--review`) marks what the project owns. Blue (`--info`) fills the "Customised" chip, whose whole meaning is "the project changed things". Green (`--success`, the host's tests-passed colour) fills the file-count pill and colours every filename under a node. The accent carries the primary button, focus rings, the selected node and the selected radio card. Amber carries the stale notice. Five hues on a board whose stylesheet says one.

Recommendation: the Customised chip goes purple, because it means "yours". Filenames and file counts go neutral mono; the name is the information, the colour was decoration. Green is retired from the board, or reserved for a single "build is current" mark. That leaves purple for ownership, the accent for action and selection, amber for warnings. Three hues, each meaning one thing.

### 3.2 The facts line has three registers

Under a step name: `9 nodes` in muted mono, a green pill with an icon and `2`, and a bare `§`. Three facts in three treatments on one line.

Recommendation: one register. `9 nodes · 2 files · template`, all quiet mono text, each a hover target, `template` becoming a purple chip once a section is replaced. The line then reads as a line instead of as three widgets.

### 3.3 Mono uppercase is doing too many jobs

On the hero board: sixteen phase labels, `HOOKS` in every hooks block, `OUTSIDE THE RUN`, counts, ids. Inside one hooks block the heading is uppercase while `before` and `after` are lowercase mono two lines under it: two registers in three lines. Uppercase tracked labels are the most common tell of template chrome; here they are the deliberate metadata voice, which is a defensible choice, but a voice used everywhere stops being a voice.

Recommendation: phases keep the treatment, because they are structural bands and the treatment is what separates a phase from a node at a glance. The hooks block drops its heading: the purple left rule and the words `before` and `after` already say what it is, and the hook icon can sit beside the word `before`. "Outside the run" becomes sentence case, since it is a label for one box.

### 3.4 Hook blocks outgrow the nodes they belong to

In `builder-board.png`, "Mark the spec complete" is a 44px card; its hooks block is 200px. A command hook wraps to three lines (`doctor.py --chat || true`), a prompt hook is cut at 52 characters with the full text in a tooltip (`clip`, `Canvas.tsx:103`), everything is set at `--text-xs`. The most text-heavy element on the board is in the smallest type and takes the most room.

Recommendation: one line per hook. A kind glyph, a name, an ellipsis: `▸ create-pr`, `▸ doctor.py --chat`, `▸ Read the doctor report above…`. Full text on click, in the side column, which is already where a hook opens for editing. The block becomes a list of what runs, not a reproduction of it.

### 3.5 The connector arms contradict the panel's own rule

`.pb-hook::before` (css 1475) draws an L-shaped arm on every hook row. The stylesheet's header says "containment over connectors". At xs size the arms read as stray glyphs (the `└` visible in every chip in `builder-hooks.png`).

Recommendation: remove them. The block's left rule and indentation already contain the rows.

### 3.6 "Outside the run" takes a full lane

`.pb-run` (css 427) sets `grid-auto-columns: minmax(300px, 1fr)`, and `.pb-outside` is a grid child, so a 72px dashed button gets a 300px column. This is why the board at 1280px scrolls and "cuts Outside the run in half" (the story's own comment) and why the hero had to be shot at 1560px.

Recommendation: give the tail its own width: `grid-template-columns: repeat(var(--pb-steps), minmax(300px, 1fr)) max-content`. Or move "+ step" into the header beside Build, where "add a step to the run" reads as a board-level action, and keep the tail only for `auto` and steps launched by hand.

### 3.7 Node cards do not say what kind of node they are

`investigate`, `author`, `gate` and `control` render identically. A gate that can stop the run ("Review for gaps", "Check against the constitution") looks the same as a note that reads context. The kind is visible only in the inspector's facts. Structure should encode information; here it encodes nothing.

Recommendation: a 3px left tick on the card in a per-kind neutral (one grey for investigate, the text colour for author, a dashed edge for gate), or a small glyph before the name the way the lock already marks pinned. Legend in the inspector, once.

### 3.8 "Edit" wears purple before anything is yours

`Inspector.tsx:247` styles Edit with `--yours`. The colour means "this project changed it"; the button is the thing you press to make that true. State colour on an intent button reads as "this is already changed".

Recommendation: Edit is the plain outlined button, or the accent primary in the inspector. Purple stays on the `yours` pill, the replaced node's border, and "Use the shipped version".

### 3.9 Three forms still use native selects

`TemplateForm` (the fragment picker), `AttachForm` (When, Where), `NewStepForm` (Runs after), `NewWorkflowForm` (Start from). `builder-template.png` shows the OS chevron. The mixed look the earlier review flagged is gone from the board and alive in the side column.

Recommendation: `Menu` everywhere a choice has a note worth showing (fragments have summaries; presets have summaries; anchors have names). Native selects only for When, which has two values and no notes, and even there a segmented `before | after` pair is clearer.

### 3.10 Dashes mean four things

Dashed borders mark the seam between nodes, the "+ step" box, the decisions box, and the `auto` card. Add, boundary, routing, and outside-the-run share one line style.

Recommendation: dashed means "a place to add" and nothing else. The decisions box gets a solid quiet border; `auto` gets the same card as a step without a border.

## 4. Words

### 4.1 Block versus node

The guide: "block" 21 times, "node" 33 times, often in the same section ("Click any node" under "Reading a block"). The interface: "node" 227 times, "block" once, in a tooltip (`Inspector.tsx:262`). The configuration file: `nodes:`. The word the reader will meet in the file they are asked to trust is "node".

Recommendation: node, everywhere. Retire "block" from the guide and the one tooltip.

### 4.2 Ownership has four names

"Make it ours" (step header), "yours" (pill), "Use the shipped node" (inspector), "Undo" (node hover). Four words for two states and one transition.

Recommendation: the state is `yours`. The transition into it is Edit and Save. The transition out is "Use the shipped version". "Make it ours" becomes "Replace the whole step" when it moves into the sidebar (already queued). "Undo" is reserved for the status line (2.7).

### 4.3 Hooks are called three things

Heading `HOOKS`; button "Add hook"; guide section "Attaching your own work"; form title "Add hook" with first field "What should happen".

Recommendation: hook is the noun in every label. The guide may explain a hook as "work you attach", once, in prose.

### 4.4 Menu notes are not parallel

`builder-add-node.png`: "Adversarial gap review" (a title) next to "this project took it out" (a lowercase past-tense aside). The two notes are answering different questions.

Recommendation: every note answers "what do I get". `Attacks the task list for gaps before it runs` next to `Creates the feature branch · removed from this run`. Sentence case, a verb first, the provenance after a separator.

### 4.5 Form labels

- "Reads as" (`AttachForm.tsx:273`) is the label for the step's display name. Say "Label", with help "how the step is named in the viewer". Better, derive it from the name and hide the field behind "Change".
- "Anything to add optional" (165) for a skill hook's note. Say "Note to the assistant (optional)".
- The Writes placeholder mixes an example with an instruction: `review.md — leave empty if it writes nothing`. A placeholder is an example; the instruction goes in help text under the field.
- "nothing else written for this one yet" (`TemplateForm.tsx:56`) reads as an apology. Say "Only the shipped version exists".
- "Held in place — ..." and "Free to move, including into another phase." (`Inspector.tsx:171`) are full sentences in a facts grid whose other rows are fragments. Either all sentences or all fragments.
- "The pipeline as it ships", "As it ships", "Shipped default", "Ships with Companion" are four phrasings of one idea. Pick "as shipped".

### 4.6 A refusal that points nowhere

`builderPanel.ts:246`: "To stop running it, remove it from specify." There is no way to remove a node from specify in the panel (2.4). A notice that names an action the panel cannot do is a dead end with a friendly face.

### 4.7 "Preview"

Preview of what, shown where? See 2.6. "Preview build" as the label, and the result in the panel, or the button goes.

## 5. Forms

### 5.1 Add hook is a 1,100px form for one sentence

Four radio cards of two lines each, then a field, then an optional field, then When and Where, then a preview line, then actions. The first decision a person makes (where, and before or after) is at the bottom. The kinds' help text is shown for all four at once.

Proposed shape, roughly 360px tall at 400px wide:

```
Add hook                                              ×
in specify

Runs   [before ▾]  [Draft the spec ▾]

Kind   [ skill | instruction | command | node ]
       The instructions stay in the skill, so editing it later changes what runs.

       [ verify-code-review                        ]
       4 in this project · start typing to filter

Note   [                                           ]   optional

Writes to companion.yml. Build to apply.
────────────────────────────────────────────────────
[Add hook]                                     Cancel
```

Kind as a four-segment control with one help line for the selected segment. Where and When as one readable clause at the top, because that is the sentence the form is writing. The field's placeholder changes with the kind, as it does today.

### 5.2 New step

Sound. Two changes: derive the label from the name (4.5), and move the "Writes `.specify/companion/nodes/name/`" explanation under the button as the consequence line, the way New workflow does it.

### 5.3 Template

After 1.1: `Menu` instead of the select, and the chosen fragment's summary under the row. The Replace menu already argues that what an alternative does is the whole basis for choosing; the template picker offers the alternatives without the basis.

### 5.4 New workflow

Good. Start from as a `Menu` with the preset summaries inline rather than only after selection.

## 6. Accessibility and input

- **Reorder is mouse-only** (2.5). Add a keyboard path.
- **The menu has `role="menu"` and no menu keys.** `Menu.tsx` handles Escape and outside-click; arrow keys, Home, End, focusing the first item on open, and returning focus on close are missing. A `role="menu"` that does not behave like one is worse for a screen-reader user than a plain list.
- **The phase heading is an unlabelled editable region** (2.3).
- **Hover-only controls have focus states, not resting states.** `focus-visible` is wired for the seams, the phase tools, "Make it ours" and the node action, so keyboard users can reach them. Nothing reaches them on touch. The resting affordance in 2.1 fixes both.
- **The changed dot** is a 6px `span` with an `aria-label` and no `role`. Announce it with `role="img"` or make it text (2.2).
- **Contrast.** `--text-muted` is 50% alpha and carries counts, the phase tools, `§`, and "Outside the run". `--text-secondary` is 70% and carries every phase name. The project's own `CLAUDE.md` says both are below AA on dark and are for metadata. Phase names are navigation. Use `--text-label` for them.
- **Reduced motion** guards only the seam transitions. The other 150ms opacity and background transitions are harmless; fine as is.

## 7. The guide

`docs/pipeline-builder.md` is 1,890 words, clearly written, and the right length. The problems are order, vocabulary, and pictures.

- **Vocabulary** (4.1). "Block" out, "node" in, including section titles.
- **The hero is unreadable at docs width.** A 1560px board in a 700px column is a thumbnail with 5px type. Lead with a two-lane crop at 760px (specify and plan) and put the full board below it, or make it click-to-zoom.
- **Three tables have empty header rows** (`| | |`). Most renderers draw an empty header band. Give them headers ("Fact", "Meaning") or use a definition list.
- **Order follows the code, not the reader.** Hooks are five of five changes in the hero and section six of twelve. The ownership model, which is the concept everything else depends on, is a `###` under "Reading a block". Proposed order: What you are looking at · Attach a hook · Edit a node, and go back · Replace or add a node · Change what a step writes · Add a step · Workflows and presets · Build · When the panel cannot read your pipeline · Where everything lives.
- **Missing pictures.** The changes popover, a node in edit mode with the resulting `yours` pill, the revert, the broken state with its repairs, a pinned node's explanation, and the Build result. The scariest state and the most important transition have no image.
- **A contributor note in a user doc.** "Every image below is generated… never hand-edit" belongs in `visual-assets.md` or an HTML comment.
- **Twenty-seven em-dashes in 1,890 words.** Sentences like "Under it, quietly: how many nodes it runs, how many files a run of it produces (hover for their names), and § — the template it writes into, which you can change." carry a colon, a parenthetical and a dash. Full stops.
- **Tooltips are taught as the interface.** "Hover it for what changed", "hover for their names". Fix the surface (2.2) and delete the sentences.
- **Two tables will drift from the code.** "Shipped alternatives today" and "Shipped fragments" list content the extension ships. Generate them at capture time from `pipeline-graph.py`'s choices, or link to `template-profiles.md` and keep one copy.
- **Light theme only.** A docs site with a dark mode will show light screenshots. Capture both if the site can serve a `<picture>` by colour scheme; otherwise match the site's default.
- **"Four steps"** in the first sentence, then a fifth appears in "Adding a step of your own". Say "the steps your run has; four as shipped".
- **"Make it ours" is on the board and not in the guide.** Either document it or let it move to the sidebar first (queued) and document what lands.

## Recommended order

**Now, hours.** 1.1 template stylesheet · 1.2 dangling selector · 1.3 form overflow · 1.4 hero fixture · 3.6 tail width · 4.1 node not block · 4.2 rename "Undo" · 4.4 and 4.5 copy.

**Next, the queued UX work, which this review confirms.** Step actions into the sidebar with "Use the shipped steps" · node remove with a status line and Undo (2.4, 2.7) · one resting `+` per phase with a menu (2.1) · `§` becomes `template` and the dot becomes a word (2.2) · the compact Add hook form (5.1).

**Later.** Kind encoding on node cards (3.7) · Build and Preview reporting in the panel (2.6) · keyboard reorder and menu keys (6) · the three-hue colour system (3.1, 3.8) · one-line hooks (3.4) · the guide reordered and reshot after the above lands (7).

## Overlap with what is already queued

So that other reviewers do not re-raise them: step actions moving into the sidebar with a real revert, node remove via hover trash with an undo notice, the `§` label, the Add hook form's height, the decisions block attaching to the node that decides, phases as free frames, and a line of guidance in the sidebar about editing a frame. This review agrees with all of them and adds the status line (2.7) as the mechanism the undo notice needs.

## Evidence

| Finding | Where |
|---|---|
| Template panel unstyled | `TemplateForm.tsx` classes `pb-sheet*`; no match in `webview/styles` |
| Dangling selector | `pipeline-builder.css:879` |
| Form overflow | `pipeline-builder.css:1059`, `1069`, `1077` |
| Hero fixture vs derivation | `Guide.stories.tsx:59`; `pipeline-graph.py:335` |
| Hover-only controls | `pipeline-builder.css:614`, `713`, `1244`, `1552`, `1608` |
| Tooltip-borne meaning | `Canvas.tsx:693`, `700`; `pipeline-builder.css:1407`, `1540` |
| Editable phase heading | `Canvas.tsx:464` |
| "Undo" and silent revert | `Canvas.tsx:391`; `builderPanel.ts:243` |
| Silent success | `builderPanel.ts:347`, `360` |
| Build reports elsewhere | `pipelineBuildCommands.ts:81`, `94` |
| Tail lane width | `pipeline-builder.css:427`, `386` |
| Connector arms | `pipeline-builder.css:1475` |
| Purple on Edit | `Inspector.tsx:247`; `pipeline-builder.css:985` |
| Customised chip in blue | `pipeline-builder.css:166` |
| Green for counts and files | `pipeline-builder.css:1394`, `739` |
| Native selects | `TemplateForm.tsx`, `AttachForm.tsx` When/Where, `NewStepForm`, `NewWorkflowForm` |
| Vocabulary counts | `grep -o -i` over `docs/pipeline-builder.md` and `webview/src/pipeline-builder/*.tsx` |
