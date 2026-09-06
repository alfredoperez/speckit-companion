# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **A living spec's outline lists its requirements.** A 400-line capability meant scrolling to find anything, and the outline beside the document showed only its three section headings unless you went looking for the Subsections toggle. It now lists every requirement by default, each with a dot for whether its test coverage is known and a count of the files it claims. Click a row to jump to it.
- **It tells you when your spec-kit commands are behind.** The VS Code extension updates itself from the Marketplace; the spec-kit extension it pairs with is installed per project and never does, so the two drifted with nothing to say so. Now a **SpecKit commands out of date** item appears in the status bar the moment the commands installed in your project are older than the ones this release expects, the install banner in Create Spec and the Activity panel names both versions with a single **Update** button, and a notification tells you once per version with **Skip this version** to silence it. Every one of them runs the same one-click `specify extension add` update and disappears as soon as the versions match. The comparison is local, so it works offline and never guesses when a version can't be read. A project without the spec-kit extension keeps the existing install prompt.

### Changed

- **A hook row in the Pipeline Builder says where it came from and what it does.** A row read `Command  spe…` with `git` at the far end of the line: the name was cut on the `speckit.` prefix every one of them shares, the leading word named the mechanism rather than the work, and whose hook it was came last. Hooks are now grouped by whoever registered them, each group led by that source's mark — your own under the Companion mascot and the file they live in, an installed extension's under `via <extension>`. Only spec-kit's own `git` carries the GitHub mark; another publisher's extension gets a neutral one rather than somebody else's logo. Each row is left to name the work, so `speckit.git.commit` reads as `commit`. A block also reads top to bottom in the order it actually runs, which it did not before: an extension's before-hooks fire ahead of anything you attached and its after-hooks behind, so the two halves swap sides between `before` and `after`. Which hooks you can edit here is unchanged, and `asks first` still sits on the row it belongs to.
- **Expanding the spec tree is one click.** The Specs title bar had a `…` menu whose only everyday entry was Collapse All, so opening the tree cost two clicks and a menu you had to read. It is a normal icon now, showing whichever action the tree's state calls for, and the view no longer has an overflow menu of its own — the sidebar had two `…` buttons a few pixels apart with nothing to tell them apart. Install Companion Extension and Upgrade… moved to the Command Palette. Specs also gains the **Refresh** its two sibling views already had.
- **Fewer install prompts, and dismissing one now means something.** A fresh workspace without the spec-kit extension asked five times in the first minute, and three of those asks ignored every "don't show again" there was. Two remain: the activity-bar badge and the pinned row in the Specs tree, both ambient and neither interrupting anything. The prompt when you create a spec is answered once and then remembered, and the warning about falling back to standard SpecKit is said once per session instead of once per pipeline step.
- **Choosing a workflow is a dropdown, not a stack of cards.** The Create New Spec form spent about 230px on a single either/or and pushed the Feature Brief below the fold, so the box you came to type in was off screen. What Companion offers, whether it needs installing, and the offer to try it for one spec all moved into a banner under the picker.
- **Living Specs buttons say what they do.** Refresh and Sync were both circular arrows, so the instant local redraw looked identical to the button that starts an AI run and rewrites your spec files. The two that run the AI now carry a different glyph, and a drifted capability is marked by a different icon rather than the same icon in another colour.

### Fixed

- **A run's record survives the editor and the terminal writing at the same moment.** Two programs keep a spec's run record: the editor, and the commands you run in a terminal. Each one used to guard only against itself, so a write from one that landed while the other was mid-update was thrown away without a word — a finished step could quietly read as unfinished again, in a file that looked perfectly fine. Both now take turns on the same lock. A writer that crashes mid-update is noticed and its turn taken over straight away, a writer that is still working is waited for rather than talked over, and nothing waits forever. Reading a spec was never blocked and still isn't. ([#629](https://github.com/alfredoperez/speckit-companion/issues/629))
- **The Refine and Add Comment buttons are readable again.** Both were drawn with white text on the accent fill — about 1.5:1 against the dark theme's mint, so `✨ Refine (2)` and the comment editor's submit all but vanished. Refine now uses the same surface treatment as the other secondary actions beside it, and Add Comment takes the ink colour the accent fill is meant to carry. Both read clearly in the light and dark viewer themes.
- **The install is 1.7 MB, not 494 MB.** The extension package had been carrying every video render behind the README GIFs and the landing page, which nothing in the extension ever reads. They stay out of it now, so the download and the install are the size of the extension itself.
- **Clicking a document in the Specs tree opens that document.** Every document row — Research, Data Model, Requirements — opened the Overview instead, on any spec that had been run at least once. The deepest, most specific rows in the tree were the ones that did the least. Clicking the spec itself still lands where it did, and getting back to the Overview is still one click from inside the viewer.
- **The Living Specs fix for drift is on the row.** A drifted capability said `drift` and stopped there; the action that repairs it existed only in the right-click menu, so hovering the row showed nothing. It is now a button on the row itself.
- **The living spec header always has something to do.** It carried an action only once drift had been found, so it was emptiest in the state you are in most of the time. It offers a drift re-check otherwise, states where the spec lives once instead of twice in two near-identical forms, and the adopted-from note no longer outweighs the spec's own content.
- **The Create Spec buttons stay on one line at any panel width.** Docked narrow, "Create Spec" broke across two lines, the three buttons ended up three sizes and two heights, and Cancel overlapped the Attach image control above it.

- **A settings migration that hits a file it cannot write no longer skips the rest.** The one-time cleanup that turns retired and legacy settings into their current shape gave up on everything still to migrate as soon as one write was rejected — a settings file with a syntax error, for instance. Each write now stands on its own, so the rest still land, and the reason for the one that failed is written to the SpecKit Companion output. ([#632](https://github.com/alfredoperez/speckit-companion/issues/632))
- **A task is a line with an id on it.** Progress, the phase-complete notice and the check that implement has finished all count checkboxes in `tasks.md`, and they counted every checkbox — including the verification notes and prose checklists that sit among the tasks. The spec-kit half never counted those, so the two could disagree about whether a run was done. Both sides now require a task id (`T001`), which both task templates emit, and a shared set of cases holds them to it. A hand-written `tasks.md` whose items carry no id will read as no tasks; give them ids to have them counted.

- **Build now reaches your assistant.** Every customisation the panel made — a hook, a reordered step, a swapped node, a rewritten one — was written into the extension's own copy of the commands, and your assistant reads a separate copy the installer rendered once at install time. So Build reported five commands and changed nothing that would ever run. It refreshes those copies now, and says how many and where.
- **Swapping a node keeps the work attached to it.** A node's name is where a hook attaches, so replacing the node renamed it and every hook on it was warned about and skipped — the work stopped running while the panel still drew it. Hooks now follow the swap, the same way they already followed a renamed phase.
- **Replace works from the panel.** Swapping a node for one of its alternatives sent the grouping and the order as two writes, and each is checked against the other as it stands — so whichever went first was refused for disagreeing with the half that had not moved yet. It never worked outside the tests, which sent both together. Putting a dropped node back and handing a step to your own document had the same shape and the same fix.
- **A changed document section is followed, not just written.** Pointing a section at a different shape resolved a template correctly into a file the assistant had no reason to open, because Companion's nodes carry their shape in their own instructions. A step you reshaped now tells the assistant to follow the resolved file; a step you left alone is unchanged.
- **A refused edit can no longer empty `companion.yml`.** A hook index that was not there — a panel drawn before someone edited the file by hand — printed "there is no hook 6" and left the file at zero bytes, taking every order, phase and hook the project had written. Six writes had that shape; all of them now compute the whole file before touching it, and publish it in one move.
- **Removing a hook no longer removes another step's.** `handoff` is a node in every step, so `specify` and `plan` both have one as a hook anchor. Removing the last hook under one of them deleted the first block of that name in the file — another step's, hooks and all — and left the emptied one behind.
- **A step you added is one your assistant can run.** Its command was built into a file nothing could dispatch: the installer only knows the commands Companion ships, so no reinstall could ever register a step you wrote. The build now gives it a real agent command, in the same format the ones beside it use.
- **Moving a hook to another boundary is one change, not two.** It travelled as a removal and an addition sent separately, so both rewrote `companion.yml` at the same time and whichever finished last won — and if the addition was refused the hook was simply gone. It moves in one write now, and a refusal leaves it where it was.
- **Editing a document template marks the build out of date.** The panel watched a directory nothing writes, so reshaping a step's document left the header saying `current` and the board never redrew.
- **A step you add to the pipeline now appears in the spec viewer.** A step a project added built, got a real agent command and recorded its runs, but the viewer never drew it: the rail showed the four shipped steps and the step had no tab of its own. The rail, the sidebar, the forward button and the run's timing now all read the pipeline the project actually runs, so the step appears where its `after:` puts it, its document opens from the rail, the forward button dispatches it, and it counts toward the run's phase coverage. Nothing is written to your settings to make it visible.
- **A step you added records when it started.** Its finish was journaled and its start was refused, so the spec's history ended in a completion that never began and the run never left implement.

### Added
- **A Get Started walkthrough, so a fresh install tells you what to do.** VS Code opens a **Get Started with SpecKit Companion** page after install, and **Help → Get Started** reopens it any time. Six steps with their own buttons: open a project, read the bundled sample spec, install the Spec Kit CLI, set up the project, write your first spec, and read the Overview the run leaves behind. It appears even in a workspace with no specs and no setup, which the sidebar's empty states never reach, and the CLI steps tick themselves off once the CLI and the project are actually detected. Two of the steps ship a clearly marked "illustration under construction" panel until the real screenshots are shot.

- **Every phase says what it can do, without being hovered.** A `+` sits on every phase rule and opens the lot: add a hook, add a node, rename the phase, split it, merge it into its neighbour. All of that used to be invisible until the pointer arrived, so a board full of things you could change showed nothing that could change anything, and a touch screen reached none of it. A row that cannot run here is shown greyed with the reason — "one node here, so there is nothing to split off" — because a control you never needed still teaches you it exists.
- **Every write says what it did.** A line at the foot of the panel names the change, offers **Undo** where there is one, and says what it means next: a change is not in the pipeline until Build writes it. Before this, a hook attached at the bottom of a lane you had scrolled past changed nothing anybody could see, and only refusals spoke.
- **Build and Preview answer in the panel.** A build used to take the editor to tell you it had worked. It reports in the header now — "Built 14:02 · 5 commands written", or which commands a preview would change — with the whole log one click away and the output channel keeping it either way.
- **The first thing a new project sees is what the board is.** Nothing said that a change here writes a file, so a dismissible line now says it: this is the pipeline as it ships, and Build writes what you change to `companion.yml`.
- **The header says which dropdown is which.** Two menus stood side by side with nothing to say which was which. The first is labelled **Workflow** and names the configuration you are on; the second is a chip reading **No changes** or **2 steps differ from shipped**, and clicking it takes you to the first lane that does. Beside them, a chip counting the hooks opens onto what the pipeline holds — how many steps, phases and nodes, and whose hooks these are — which was a native tooltip nobody could reach from a keyboard or a touchscreen.
- **A node can be moved, removed and given back from its own panel.** **Move up** and **Move down** sit on the row that says the node can move; **More** holds what costs something — **Remove from the run** (which keeps the file, so it stays on offer under Add node) and **Use the shipped node**. Reordering used to be drag-only, there was no way at all to stop running a node, and handing one back was a hover control that deleted your copy with no notice and no way back.
- **A node card says what kind of node it is.** A mark down its left edge separates a node that writes a deliverable from one that only reads context or sets things up, and a node that can stop the run carries the word `gate`, as one that cannot be reordered carries `held`. The legend for the marks sits in the node's own panel.
- **The words on the board are words.** The bare `§` is a `template` chip, the unexplained dot is the word `changed`, and the green pill is a file count. Three of the marks that meant nothing without hovering now say what they are.
- **Start a workflow from something rather than nothing.** **New workflow…** now asks what to start from: what this project runs today, the pipeline as it ships, or one of two whole configurations Companion ships. **Classic spec-kit** puts the stock document shapes back — prioritized P1/P2/P3 user stories, the full Technical Context block. **Brownfield** is for changing a system that already exists: the spec says only what changes, the task list is attacked before it runs, and a person opens the thing before it counts as done. Picking one copies it in; everything in it is yours to change from there.
- **Add a step of your own.** **Add step** at the end of the board gives the run a turn it did not have — a review pass after implement, an audit you launch when you want it. Name it, say where it goes and what it writes, and the panel writes a step that already runs and opens the one node there is to edit. It gets its own command, its own place in the run, and every other thing a step has: nodes you can add and replace, phases you can name, hooks you can attach.
- **Pick a different node.** A node that has alternatives shows **Replace** in the panel: draft the spec as a delta against what exists, or as a fix contract; run the quality checklist as a gate that stops and asks instead of one that records and moves on; put each feature on a branch of its own. Picking one is the same write a drag makes, so the node stays editable and one click from the shipped one.
- **Change what a step writes, section by section.** The **template** chip on a step opens its document's shape — one row per section, each offering the alternatives written for it and "As shipped", with a line saying what each one gives you. Swap prioritized user stories for observable outcomes or numbered WHEN/THEN/SHALL requirements, put the stock spec-kit shapes back, or add a constraint block to the task list.
- **Add a node a step ships but does not run** — an adversarial gap review after tasks, a click-through checklist a person actually runs before a spec counts as done. They appear in the same picker that puts a dropped node back, each with a line saying which it is.
- **A whole step can be handed to one document of your own.** **Replace the whole step**, on the step's own instructions, writes a node holding everything that step currently tells the assistant — the frame and every node's instructions, frontmatter and fences stripped — and points the step at it. It says what it costs before you pick it. Replacing what a step *does* used to mean rewriting each of the nodes it happens to be made of.
- **Phases can be split and merged** from the panel, not only renamed. Merging a phase folds its nodes into its neighbour rather than dropping work, and splitting one hands its last node to the new phase, because a phase with nothing in it cannot be saved. Moving a whole phase is deliberately not offered: across every step the pipeline ships, not one such move survives the dependencies between its nodes, so the arrows that used to sit there could only ever be refused.
- **A node the recipe dropped can be put back**, into a phase you pick. The order and the grouping are written together.
- **A step's own instructions are readable.** Click the step's name. `_frame.md` — the preamble every node sits under — was the one piece of a step's text nothing could reach, and it can be replaced like any other node.
- **`plan` says it writes four files, not one.** `research.md`, `data-model.md` and `contracts/` were produced by a node that declared none of them, so the manifest, the builder and the verifier all had `plan` down for a single document. A node can now declare what it *may* write as well as what it always writes — the size budget is allowed to fold those away at `simple`, and a run that does is working, not failing.
- **A hook can be changed or taken out.** Every hook could be added and none could be touched again; getting one wrong meant opening `companion.yml`. Click any hook to edit it in place, or remove it — and the anchor it was the last hook on goes with it.
- **A hook is picked, not remembered.** The skill and node fields offer what this project actually has — 35 skills and 9 node files in this repository — rather than a blank box where a typo produces a hook that invokes nothing.
- **A shell hook reads as its command.** `python3 .specify/extensions/companion/scripts/doctor.py --chat` wrapped over three lines with the identifying part at the end; it shows as `doctor.py --chat`, with the path on hover.
- **The mark on a changed step says what changed** rather than being an unexplained dot.
- **Phases are yours to name and group.** The middle band was the one part of the pipeline you could see and not touch — the nodes were reorderable and replaceable, hooks attached anywhere, and the group they sat in belonged to the extension. Rename a phase in place in the panel, or drag a node from one phase into another; both write the whole grouping to `companion.yml`. A grouping that leaves a node homeless, names a phase twice, or breaks a `reads:` dependency is refused with the reason.
- **A step says what it produces at the top,** as a count you can hover for the filenames, next to the template it uses. It used to be a line at the bottom of the lane, below every node.
- **Hooks read as a list under what they attach to** — the words `before` and `after`, then one line per hook beneath each — instead of repeating the side and the anchor on every chip. A hook another spec-kit extension registers sits in the same place and the same shape, marked `ext`.
- **Every hook, not just ours.** The panel showed the hooks you wrote in `companion.yml` and nothing else — but a Companion run also fires the hooks your installed spec-kit extensions register in `.specify/extensions.yml`. This repository's own panel said 9 when the answer was 21. Both are shown now, the extension ones listed under the step they fire on, marked with which extension registered them and whether they ask first.
- **The panel does its own asking.** Attaching work and naming a new workflow used editor pop-ups that covered the thing you were pointing at; both are forms in the panel now, and a refusal comes back as a line in the panel rather than a toast. Nothing about the view depends on being inside VS Code any more.
- **The steps are a board.** Lanes keep a readable width and scroll sideways instead of squeezing to fit, and a lane is a column between hairlines rather than a card.
- **The pipeline reads left to right.** The steps are columns in run order — specify, plan, tasks, implement as shipped — instead of one tall stack sorted alphabetically. `auto` sits in the tail of the row under **Outside the run** and says what it is: the command that runs the others, not a step of its own. Narrow the panel and it folds to two columns, then one.
- **One colour means "yours".** Hooks, nodes you rewrote and template sections you replaced all carry the same mark, and nothing else in the panel does, so what your project changed is answerable at a glance.
- **A node opens in the panel.** Its instructions render beside the canvas, along with what it writes, what it needs, and whether it can be moved. "Open the file" is still there for when the editor is what you wanted.
- **A node says why it cannot be dragged.** Nodes free to move show a grip; ones held in place show a lock that names what holds them — and says the lock is only about order, since you can still rewrite the node, attach work to it, or drop it entirely. In the shipped pipeline that is two nodes out of twenty-four: everything else is free to move, including into another phase.
- **Several saved workflows.** A workflow is a whole named configuration in `.specify/companion/workflows/`; switch between them from the panel's header. Switching swaps everything at once — order, hooks, templates, routing — so a one-line fix and a client deliverable can run different pipelines from the same repository. "As it ships" is always offered as the thing to compare against.
- **A Pipeline Builder panel,** opened from the circuit icon at the top of the Specs sidebar or from the palette. It shows the pipeline your project actually runs — every step, the phases inside it, the nodes inside those, the hooks attached to either, where the classifier's verdict routes, and which files each step produces. A chip in the header says whether anything differs from the pipeline as it ships and expands to list what. It draws whatever your configuration resolves to, so a project that has changed nothing sees exactly what ships.
- **Clicking a node opens the node.** It used to open the whole assembled command and scroll to roughly the right place, which is the text the assistant reads but not the text anyone can edit. Now it opens the node file itself — your project's copy where you have one, otherwise the shipped source.
- **Drag a node to reorder its step.** The new order is saved to `companion.yml` with everything else in the file untouched, and an order the pipeline cannot honour — a node moved across a phase boundary, or before something it reads — is refused with the reason, leaving the file as it was.
- **Attach work at any boundary from the panel.** **Add hook** asks where it runs first, then what it is: a **skill** the project already has, an **instruction**, a shell **command**, or one of your own nodes. Pointing at a skill is the one to reach for — the instructions stay in the skill instead of being copied into the pipeline.
- **Rewrite a node in your own words.** **Edit** in a node's panel opens its instructions; saving is what writes your copy into `.specify/companion/nodes/`, so making it yours and doing the thing you came to do are one action. The node is marked `yours` until **Use the shipped node** hands it back. Rewriting how a step is written used to mean forking the extension.
- **Build your pipeline from the editor.** "Build Pipeline from companion.yml" applies your configuration; "Preview Pipeline Build" shows what would change and writes nothing. The output channel keeps the whole log.
- **A stale pipeline says so.** When `companion.yml` is newer than the commands built from it, the two disagree — the file says one thing and the command your assistant is handed says another, with nothing about a run looking wrong. The panel's header states it whenever the two are out of step, with **Build** a click away.

### Removed

- **Seven command-palette entries that did nothing have been removed.** The workflow-editor commands (edit source, refine section, remove section, add user story, approve and continue, regenerate, navigate to phase) were left over from an editor that no longer exists — running any of them wrote a line to an output channel and nothing else. Their right-click menu entries are gone with them.

## [0.32.0] - 2026-08-26

### Added

- **A live sample spec you can open before writing anything.** The Specs view's empty state now offers **Open a live sample** beside **Create your first spec**. It copies a small, finished-looking example spec into your workspace and opens it in the viewer, so a first run shows the actual reading surface — pipeline, phases, timing — instead of an empty tree. It is an ordinary spec after that: yours to read, edit, or delete, and clicking again reopens it rather than making a second copy. ([#597](https://github.com/alfredoperez/speckit-companion/issues/597))

- **Try the Companion pipeline on one spec without changing your default.** When your default workflow is stock SpecKit, the Companion option in Create New Spec now offers **Try Companion for this spec**. It applies to that one spec only; your configured default is untouched.

### Changed

- **One welcome in the empty Specs view instead of two stacked boxes.** A workspace with no specs used to show the welcome message and the Companion install prompt as two separate blocks. They are now a single welcome: one value line, both actions, and the install offer folded in when the companion extension is missing.

- **The workflow choice in Create New Spec explains itself.** The bare dropdown is now a set of cards, each showing what its workflow is for — with the Companion pipeline carrying its measured result, specs 60 to 68% leaner with the same correctness — so the choice can be made without leaving the form. A workflow that needs the companion extension shows as *Install to enable* rather than being hidden, and custom workflows are now validated and filtered the same way here as everywhere else, so no surface offers a workflow another one hides.

- **Anonymous usage telemetry moved to PostHog.** The Azure subscription behind the old analytics backend lapsed and took the pipeline with it, so every usage event had been silently discarded for months. Events now go to PostHog with the same event catalog and the same privacy contract: only enum-like values, versions, and counts, never prompt content, file paths, or spec names. Both opt-out switches keep their promise — turning off `speckit.telemetry` or VS Code's global telemetry setting stops all events immediately, mid-session, no restart needed. The retired backend's client library and its credential are removed from the shipped extension. ([#589](https://github.com/alfredoperez/speckit-companion/issues/589))

- **The anonymous usage counts now cover the whole path from install to a finished spec.** Three moments were previously unmeasured or undercounted: installing the extension, opening the Specs panel, and finishing a spec — the last one only counted when you finished from the sidebar, missing both the viewer's own action and the Companion pipeline's final step. All three are counted now, each exactly once, and a spec created from the terminal is no longer invisible. Everything stays anonymous and both opt-out switches still stop every event; the [telemetry disclosure](./docs/telemetry.md) lists each addition. ([#597](https://github.com/alfredoperez/speckit-companion/issues/597))

## [0.31.4] - 2026-08-24

### Changed

- **The marketplace listing now shows the product instead of describing it.** Both READMEs were rewritten for scannability: an animated tour of the Overview page leads the listing as its hero, every screenshot is captured from Storybook by a single regenerable command so the images cannot drift from the real UI, the spec-kit extension's page gets a new text-free hero image, and cross-install banners point each half of the project at the other. The depth that used to live in the README moved into `docs/`.

### Fixed

- **A node is edited where you clicked it.** Changing what a step tells the assistant meant pressing "Make it mine" first, which copied the node into your project and opened the raw `.md` in the editor — frontmatter, empty fences and all. Now clicking a node opens it in the panel and you edit it there; saving is what writes your copy, so the step you had to do first and the thing you came to do are the same action. The metadata the build depends on is carried across for you, and the markers showing where shared blocks get stitched in stay in the text so they cannot be deleted by accident. The shipped node is untouched and one click away.
- **A pipeline the panel cannot read is no longer a dead end.** The error screen offered one button — open `companion.yml` — which is the panel handing you the file it exists to replace, at the moment you are least equipped to read it. It now offers the ways out as actions, worked out from what your configuration actually contains: take out the empty phase, give one step back its shipped grouping or order, or reset every step. Each says what it will cost before you click, narrowest first, and your hooks are never among what a recovery drops. The file is still one click away when the panel cannot help.
- **Editing a second hook no longer saves it over the first.** The hook form filled its fields once when it opened, so clicking another hook left the previous one's values on screen — while the hook it would save to had already changed underneath. Saving then wrote one hook's contents over another's. The form now starts fresh on each hook.
- **The panel scrolls in the right place.** The whole page grew instead of the parts inside it, so reading a long node meant scrolling past all of it to reach the buttons at the bottom. The board and the node's text scroll now; the actions stay where they are.
- **Phases no longer offer a reorder that cannot happen.** The up and down arrows moved a phase's nodes with it, which breaks the order the steps depend on — across every step this ships with, not one such move was possible. They fired, the write was refused, and the panel redrew unchanged, which reads as a button that does nothing. They are gone; splitting a phase, merging it into its neighbour, renaming it, and dragging a node between phases all still work, and now say which they are.
- **"How do I add a node here?" has an answer on screen.** The control for putting a node back only appeared when a step had one to put back, so in most steps there was nothing to find and nothing explaining why. It is always there now, and says the three ways a node gets into a phase when it has none to offer.
- **Every place a hook can attach is on the board.** Only the hooks a project had already written were drawn, so the places work *could* go were invisible unless you happened to hover them. Each empty anchor is a dotted slot now, named and clickable to attach something there.
- **Hooks from your other spec-kit extensions run in the lane, not beneath it.** They were an unlabelled list at the foot of each step, with nothing saying what they were or why they could not be edited — a fair thing to be puzzled by. They now appear as ordinary hook chips at the point in the step where they actually fire, marked with the extension that registered them and left plainly uneditable here.
- **One set of buttons, in one order.** The panel had two near-identical button styles depending on which pane you were in, and the actions came in a different order in each. They are one style now, always in the same order: the forward action, then anything else, then the destructive one, with cancelling or leaving at the far end.
- **The handoff can no longer be dragged off the end of a step.** It is the node that starts the next step, so anything ordered after it runs once the step has already moved on — a real project ended up with a `specify` that handed off to planning before it recorded that it had finished, and nothing in the panel objected. It is now held in place in every step, with the reason on the lock, and an order that moves it is refused rather than saved.

- **The viewer's on-screen copy drops its em dashes.** The Overview's sizing line now reads "Sized simple: 6 files projected", the verified-checks heading reads "What was checked, and what happened", and the footer's running and archived labels read "Step running, actions unlock when it settles" and "Archived, read-only". Small strings, but they render for every user on every spec.

## [0.31.3] - 2026-08-20

### Fixed

- **"View Changelog" on the update notification now opens the version it just offered you.** Both this extension and its spec-kit companion publish their releases into one shared list, so the link — which asked GitHub for whichever release was newest — could land on the spec-kit extension's notes instead: a different product, a different version number, and changes that had nothing to do with the update you were being offered. The link now points straight at the offered version's own release. Which version you're told about was always correct; only the link was wrong. ([#585](https://github.com/alfredoperez/speckit-companion/issues/585))

## [0.31.2] - 2026-08-19

### Fixed

- **A spec you just wrote now offers Plan next, instead of jumping straight to Tasks.** On a freshly specified SpecKit Companion spec the viewer footer said "Next: Tasks" while the step strip correctly showed Plan as still pending — and clicking the button ran task generation against a spec that had never been planned. Two things were going wrong at once: the SpecKit Companion pipeline was being mistaken for a workflow you wrote yourself, which switched on a fallback that guesses progress from whatever files are on disk; and that guess then counted the specification's own quality checklist as if planning had already produced something. The footer and the step strip now always name the same next step. Workflows you define yourself keep guessing progress from their files exactly as before. ([#582](https://github.com/alfredoperez/speckit-companion/issues/582))

- **File watching no longer eats your system's watch budget.** The two watchers that keep an eye on your global Claude settings and CLAUDE.md were pointed at your home directory in a way VS Code reads as "watch everything underneath, recursively" — so every window recursively watched your entire home folder. On Linux that meant roughly 454,000 inotify watches against a 524,288 limit, which exhausted the budget and broke file watching everywhere, including source-control auto-refresh. Both watchers now look only inside `~/.claude`. Measured on Linux with four windows open, total watches dropped from 456,300 to 27,116. Thanks to [@amgsk](https://github.com/alfredoperez/speckit-companion/pull/579) for the report and the fix. ([#578](https://github.com/alfredoperez/speckit-companion/issues/578))

- **Creating a global CLAUDE.md now always lands in your home directory, so the Steering view actually shows it.** The create action worked out the home directory from the `HOME` environment variable, and when that variable wasn't set — which is common on Windows — the file was written to a `.claude` folder relative to whatever directory the editor started in. The extension watches and reads your real home directory, so the new file simply never appeared. Home directory resolution is now the same everywhere the extension looks, writes, and watches. ([#580](https://github.com/alfredoperez/speckit-companion/issues/580))

## [0.31.1] - 2026-08-01

### Changed

- **Open a spec-kit project without the Companion extension and you'll now get a one-time prompt to install it — whatever AI provider you use.** The old install reminder only appeared for terminal-based providers, and only after you dispatched a command through the extension's buttons — so anyone running `/speckit.*` by hand, or using an in-editor chat provider, never saw it. Installing the extension is a terminal command that works the same for every provider, so the prompt is now provider-agnostic and fires when you open a project that already uses spec-kit. It's a single quiet **Install** notification with a **Don't show again** that shares one dismissal with the in-editor nudges, respects the `speckit.companion.installPrompt` setting, and never blocks activation.
- **Companion becomes the default workflow once its spec-kit extension is installed.** If you haven't explicitly chosen a workflow, Create New Spec and per-feature resolution now pre-select **SpecKit Companion** whenever the companion spec-kit extension is present. An explicit `speckit.defaultWorkflow` setting at any scope still wins, and without the extension the default stays stock SpecKit.

### Fixed

- **Every finished spec shows real timing now, even one you ran entirely from the CLI.** A spec driven start-to-finish in the terminal used to report "Timing coverage: 0 of 4 phases" despite the hooks recording real per-step timestamps; a coherent CLI run now derives its full per-phase timing and total elapsed.
- **The viewer's step strip no longer overlaps itself when the pane is narrow.** In the folded layout each step now sits inline with its file chips and the strip scrolls sideways instead of colliding; empty coverage is hidden rather than shown as a bare header, and spec names render acronyms correctly instead of title-casing them.

## [0.31.0] - 2026-07-24

### Added

- **The path to SpecKit Companion is now visible where you actually look.** When the Companion spec-kit extension isn't installed, the sidebar surfaces a one-click upgrade instead of hiding it: a dot on the SpecKit activity-bar icon, a pinned **Get Companion** row atop the Specs tree, a dismissable **Install SpecKit Companion** button in the empty Specs view, and **SpecKit Companion** always offered in Create New Spec — picking it shows the benefits and installs in one click first, then falls back to standard SpecKit if you decline. Every nudge disappears the moment the extension is installed, with no reload, and the old buried "Not installed" badge in the Steering view is retired. ([#543](https://github.com/alfredoperez/speckit-companion/issues/543))
- **Antigravity joins the provider list.** You can now pick **Antigravity** — Google's agentic coding agent — under **Settings > speckit.aiProvider**, and SpecKit commands run in its `agy` command-line tool inside an integrated terminal, opened interactively so you can approve edits as they happen. If `agy` isn't installed yet, the extension offers its one-line install command. ([#546](https://github.com/alfredoperez/speckit-companion/issues/546))

### Changed

- **A step's artifact files now nest directly under it in the spec viewer's side rail.** The rail used to list the workflow steps under a Pipeline heading and then repeat each step's files in separate "Plan files" / "Specification files" groups below — so a file was visually decoupled from the step it came from. Now Data Model, Living Components, and Research sit indented under **Plan**, Requirements sits under **Specification**, and so on, so "where does this file come from" is answered in place. Every file is still one click away, the Overview stays at the top, and a file whose step isn't shown in the rail keeps a labeled fallback group so nothing goes missing. ([#504](https://github.com/alfredoperez/speckit-companion/issues/504))

### Fixed

- **Fast-path folded phases now read "folded into Specify" instead of a misleading "<1s".** A small change run through the fast path does its planning and task work inside the specify run, so the Plan and Tasks phases have no duration of their own — but the Overview's run timing strip showed them as `Plan <1s` / `Tasks <1s`, which looked like a bug. Those phases now carry a "folded into Specify" note and a hollow dot instead of a duration; genuinely measured phases, coverage counts, and the run's elapsed total are unchanged. ([#523](https://github.com/alfredoperez/speckit-companion/issues/523))

- **A phase no longer flips to "untrusted timing" at random when a spec advances.** Advancing a step fired two context updates at once, and if they overlapped, the later one could overwrite the step's start marker — which is what made a phase's duration occasionally read as untrusted. Updates to a single spec's context now happen one at a time, so both always land and the start marker is never lost. Updates to different specs still run in parallel, so nothing gets slower. ([#527](https://github.com/alfredoperez/speckit-companion/issues/527))

## [0.30.0] - 2026-07-22

### Added

- **Telemetry now sees the engagement the extension can actually observe — spec opens, living-spec runs, steering opens.** Specs created in the terminal never fire a "spec created" signal, so five new anonymous events measure what happens inside the extension instead: opening a spec in the viewer, opening a living/capability spec, running a living-spec drift report, running a living-spec sync, and opening a steering doc. Every one is a bare event — no spec name, path, or capability name is ever attached — and spec/living-spec opens are counted once per session so re-renders don't inflate them. All still gated on `speckit.telemetry`. The README's Telemetry section adds the new signals, sample Azure queries, and a pointer to a ready-to-paste workbook (`docs/telemetry-workbook.json`). ([#531](https://github.com/alfredoperez/speckit-companion/issues/531))
- **Telemetry now measures the spec-kit extension install rate and whether the install banner converts.** Each activation reports whether the companion spec-kit extension is installed, and the install banner reports when it's shown and when its Install button is clicked (per surface — Create New Spec vs. the spec viewer). Together they answer "how many installs have the extension, and does the prompt work?" without any new personal data — the fields are booleans and fixed labels only, still gated on `speckit.telemetry`. The README's Telemetry section lists the new signals and a sample query. ([#506](https://github.com/alfredoperez/speckit-companion/issues/506))
- **Sync living specs from my changes — one click in the Living Specs view.** A new title-bar action dispatches `/speckit.companion.living-sync` to your AI assistant: it groups your current working-tree changes — uncommitted and untracked files included — by capability and updates every affected living spec in one pass, leaving the spec edits uncommitted so they ship in the same commit as the code. It sits next to the existing Adopt Code Area… action and appears only when the companion spec-kit extension is installed.

### Changed

- **The spec viewer's side rail now lists only documents.** Implement and Mark Complete used to sit in the rail as entries that opened nothing readable; they're gone from the rail (the same goes for any custom workflow step that produces no document). Their actions were always in the footer, which keeps working unchanged, and while implementation runs the live task percent now shows on the Tasks tab. ([#500](https://github.com/alfredoperez/speckit-companion/issues/500))
- **The SpecKit Companion workflow is now available to everyone — no beta setting to turn on.** The workflow picker in Create New Spec and the Continue/Resume button on active specs used to appear only after you enabled a beta toggle. That toggle and its "Beta Features" heading are gone. Both now show out of the box whenever the companion spec-kit extension is installed. Bench results showed the Companion pipeline matches stock SpecKit on correctness while producing specs 60–68% leaner, so it graduates from beta. If you'd turned the old beta setting on, nothing changes for you; the retired setting is quietly removed from your settings on upgrade.

### Added

- **The Living Specs sidebar is now a directory tree, not a flat list.** Capabilities are grouped by where their specs actually live, so the view's shape mirrors your codebase — capabilities in the same area sit together under their folder path instead of scrolling past as one long list with a grey `central`/`colocated` word on each row. The tree conveys location now, so that word is gone.
- **Living Specs rows have the standard right-click file actions.** A capability, its Architecture/Coverage tiers, and orphan specs now offer **Copy Name**, **Copy Path**, **Copy Relative Path**, **Reveal in VS Code Explorer**, **Reveal in File Manager**, and **Delete** — the same set the Specs tree has. Delete removes only the spec file (with a confirmation), never the surrounding code folder.
- **Update a drifted living spec in one click.** When a capability has drifted, a new **Update to Match Code** action — in the sidebar right-click menu and next to the `drift` marker in the spec viewer's header — asks your AI assistant to fold the changed code back into the spec. It updates rather than regenerates, so every clarification, requirement, and scenario you already wrote is preserved and only what the code changed gets revised.

### Fixed

- **A finished SpecKit Companion spec now shows its full timing, instead of being stuck one phase short.** The run overview counted the final Mark Complete step as a timing phase, but that step only marks the spec done — it has no duration to measure. So even a perfectly-captured run maxed out at "4 of 5 phases" and never showed the total elapsed time. Mark Complete is no longer counted, so a completed Companion run reads "4 of 4" and shows its Started / Elapsed / Ended summary like it should. Stock SpecKit specs are unchanged.
- **The run log's Living specs section is a scannable list again, not a wall of text.** Opening a finished run used to reprint the entire text of every living spec it loaded — the purpose and every requirement, in full — so the useful signal (which specs were loaded) drowned in content you can already read in the Living Specs viewer. It now shows one compact chip per capability, right under the phase timeline, and clicking a chip opens that capability in the Living Specs viewer.

- **A broken `living-specs.yml` no longer looks like an empty one.** If your capability registry had a typo in it, the Living Specs sidebar showed `Living Specs are off` and suggested you set `enabled: true` — advice that couldn't help, because the file already said that and simply wasn't parsing. The sidebar now shows `Can't read living-specs.yml` with the parse error in the tooltip, so you go fix the file instead of hunting for a setting.

### Improved

- **Opening a living spec now tells you something about it.** The header for an adopted capability used to show a name and a badge and nothing else. It now shows how many requirements and scenarios the capability declares, how many of them have a mapped test, a `drift` marker when the code has moved on since the spec was last committed, the file patterns the capability claims, and where its spec file lives. The claimed patterns are the point: you can finally answer "why did this spec load for this change?" without opening the capability registry by hand. Coverage and drift are the same numbers the Living Specs sidebar shows — one computation feeds both, so they cannot disagree.

### Fixed

- **The Living Specs sidebar now lists unregistered central specs too.** Its Orphans group only ever showed specs kept next to the code they describe. A spec kept centrally, under `capabilities/<name>/`, was invisible — so one you never registered simply didn't appear anywhere in the view, and an empty Orphans group looked like everything was accounted for when it wasn't. Both layouts now show up. A repository inside your repository that keeps its own registry is still treated as a separate project and stays out of the list.

- **Your capability registrations survive routine cleanup.** The Living Specs view now reads your capabilities from `living-specs.yml` at the root of your project instead of from inside `.specify/`, so the ordinary housekeeping that re-creates that folder — a local install, a hard reset after a merge — can no longer wipe them without saying a word. Registrations you already have keep working from where they are, and move across on their own the next time you register or relocate a capability. The sidebar refreshes as soon as you edit the new file, and a repository inside your repository that keeps its own registry is still treated as a separate project.

- **A living spec's title is the one its author wrote.** The viewer was building the title from the folder name, so a document headed "SpecKit Extension Capture — Living Spec" appeared as "Speckit-Extension-Capture". It now reads the document's own heading and only falls back to the folder name when there isn't one. Product names keep their capitalization.
- **DRAFT is no longer said three times.** A draft capability announced itself in the badge, in a banner in the body, and a third time in a tooltip that repeated the badge word for word and covered the title while it was showing. The tooltip is gone; the badge and the banner stay.

- **Post-implement checkpoints in a multi-folder workspace now use the right branch.** The branch name handed to a checkpoint was always taken from the first repository in the window, so in a workspace holding more than one repository a checkpoint could stamp a commit message with a branch from a completely different project. It now uses the repository the spec actually lives in. Single-repository workspaces are unaffected.

- The Living Specs view's **Orphans** group now stops at nested projects. If your repo contains sample apps, fixtures, or sandboxes that carry their own capability registry, they are separate projects and their spec files no longer show up as strays in the parent repo's sidebar.

## [0.29.0] - 2026-07-14

### Fixed

- **The Companion commands now actually reach Codex.** Picking Codex as your assistant and running a Companion step quietly did nothing useful — the extension piped raw text the CLI couldn't act on, with no error to tell you. It was looking for the commands in a location spec-kit no longer writes to, and it couldn't read a namespaced command name in the first place. Codex now runs the whole Companion pipeline like every other assistant.
- **Codex and Wibey users see their own skills in the sidebar.** The Skills group listed Claude's skills no matter which assistant you had selected, and it watched a folder that didn't exist, so editing a skill never refreshed the tree.
- **A finished spec no longer spins forever.** A completed spec kept showing its Implement step as if it were still running, stuck a few percent short of done. The progress number was counting the example checkbox in the task file's own formatting legend as an unfinished task, so it could never reach 100% — and the spinner never checked whether the spec had actually finished. Task progress now counts only real tasks, ignoring examples inside code blocks, and a finished step stops moving. Phase-completion notifications were miscounting the same way and now fire correctly.

### Changed

- **More Actions opens a proper menu.** The `…` button in the Specs toolbar used to throw a picker to the top of the window, away from the button you clicked. It now opens a normal menu right under it.

- **Review comments annotate a line instead of interrupting it.** Every saved comment used to plant a full-width strip in the middle of the document, complete with a delete `×` that never went away — five comments meant five permanent interruptions that shouted louder than the lines they were about. A comment now rests as one quiet line: a glyph, the comment truncated to a single line, and its state. Open it (click it, or press Enter when it has focus) to read it in full and act on it — **Refine** hands that document's pending comments to the AI, **Edit** reopens the composer with the text already in it, **Delete** removes it. A document under review stays a document you can read.
- **Pending and applied comments now look different.** A comment awaiting refinement reads as live; one the AI has already been asked to act on carries a check and stays on its line as a record of what was asked — quiet, and never counted in the Refine badge. Comments you already refined come back on reopen too, instead of disappearing.
- **You can revise a comment instead of deleting and retyping it.** Editing keeps the same comment — its place in the document and when you left it are preserved.
- **Commenting a line no longer needs a mouse.** The `+` control on a line now appears when it takes keyboard focus, so a line can be commented from the keyboard alone.

- **Clicking a spec's name opens the spec.** It used to do nothing but expand the row — to see a spec you had to guess a document, open it, and then find the Overview. Now the name opens the viewer on that spec's **Overview**: why it exists, what constrained it, what was verified, the decisions, and how its requirements map to tests. A spec with no recorded run has no Overview, so it opens on its first document instead. The click still expands the row, and the chevron still expands it *without* opening the viewer when you only want to browse.
- **The sidebar reads as one product now.** Four views, one icon language, and a toolbar you can take in at a glance. Nothing about how specs behave changed — the same commands, lifecycle, filter, sort, multi-select, and Resume rules — but the sidebar stopped looking like four features that grew separately.
- **The sidebar opens calm instead of flooded.** Individual spec rows now start collapsed, so a project with two hundred finished specs shows you a short, readable list rather than every document of every spec. Active stays expanded, Completed and Archived stay collapsed, and **Expand All** still opens everything when you want it.
- **Views are named for what they hold.** **Spec Explorer** is now **Living Specs** (it was too easy to confuse with Specs), and **Settings** is now **Settings & Feedback**, which is what it actually contains.
- **The Specs toolbar shows at most four buttons**: **Filter…**, **Sort…**, **More Actions…**, and **New Spec**. The filter box opens prefilled with your current query and clears when you submit it empty, so the separate clear icon is gone. Collapse/Expand All, Install Companion Extension, and Upgrade… moved into **More Actions** — and every one of them is still in the Command Palette.
- **Hover and right-click finally agree.** A spec row offers **Resume** (when eligible) and **More Actions** on hover; both that menu and the right-click menu present the same items in the same order — Set Status…, the lifecycle action, Copy Spec Name / Path, both Reveal actions — with **Delete alone in its own danger group** at the bottom.
- **Your provider's logo is the right one.** The provider row's name and its mark are now resolved together, so the host editor's built-in chat in an unrecognized editor shows a neutral chat icon instead of a competitor's branding. Wibey gets an intentional, documented neutral mark rather than an accidental fallback.
- **One icon language.** The detailed illustration-style icons are gone from the tree; every functional and status concept uses VS Code's own themed icons, so the sidebar stays legible in light, dark, and high-contrast themes. The only custom artwork left is the product mark and the official provider logos, and no status depends on color alone.
- **Expanding a finished spec shows something.** A completed or archived spec's documents used to render as an iconless list; they now carry their own status — a green check for a completed step, a blue dot for the current one, a hollow circle for the rest. A document that doesn't exist yet says `not created` and offers no action that would fail.
- **The Steering tree has an obvious shape.** It's built in one explicit order (Companion, your provider, Steering Docs, SpecKit Project Files, References), and the "create a rule file" actions moved out of the root and into the Project or User group they belong to — naming *your* provider's real filename instead of always saying `CLAUDE.md`.
- **Companion → Configuration opens the configuration.** Clicking it opens `.specify/companion.yml` directly; expanding it still lists the setting groups underneath.
- **Reveal works everywhere it should, and nowhere it shouldn't.** Every file-backed row in Living Specs and Steering — including orphan living specs — offers **Reveal in VS Code Explorer** and **Reveal in File Manager**. Rows with no file behind them offer neither.
- **Tooltips say what they mean.** A spec's tooltip now reads as a short card (name, friendly status, last activity) instead of a run-on line with a raw internal status key in it, and a document's tooltip shows its real path rather than one reconstructed from its label.
- **The spec viewer got its redesign.** The viewer now runs the design that won the multi-provider redesign investigation: a spec with recorded activity opens on its **Overview**, documents live on a left rail where the highlight shows what you're reading and separate marks show how far the run is, and the footer becomes a floating action pill led by a context line naming the next step, with workflow-provided commands under **Other actions**.
- **The Overview is now a durable-context dossier.** Instead of an activity feed, the Overview leads with what a future session needs: why the spec exists, the constraints and deliberately-excluded work, what was verified (with the evidence command), the decisions with their rejected alternatives, and a requirement→test traceability table. The run log and task records stay one click away, collapsed at the bottom.
- **The Overview is a place on the rail, not a toggle.** It sits at the top of the document rail as the first destination, and it only appears when the spec actually has a recorded run — a spec created outside the Companion pipeline is simply its documents, with no empty Overview to explain. A spec whose run notes are just a work log opens on its documents too.
- **The run facts became a strip.** The permanent run-facts column is replaced by a one-line strip above the content (phase, tasks, traced requirements, checks, active time, PR link). The status isn't repeated there — the header badge already carries it.
- **One header, not two.** The spec's identity (name, status, branch, date) and its run facts (phase, tasks, traceability) now share a single header band instead of stacking as two full-width rows, and the status is stated exactly once. The facts only say what nothing else already says: no repeated status, and no phase either (a completed spec announcing "implement" tells you nothing, and a running one is already named by the badge and the spinning step). As the pane narrows they step aside — the checks and elapsed time first, then all of them in a split editor — while the title and status never yield. There's no "Run details" link, because the Overview is an entry on the rail at every width.
- **A stale-document warning now sits over the document it's about.** It used to stretch across the whole window, behind the navigation rail, even though it describes one file and its Regenerate button acts on that one file. It's now a notice inside the reading column, and it names the document ("Plan may be stale").
- **The table of contents moved to the right**, so the rail and the outline stop crowding the same edge and the document sits between them. It also reads like an index again rather than a second column of prose: smaller type, long headings clipped to two lines (full text on hover), and subsections hung off a guide rule so they're clearly children of their section instead of look-alike peers. And it only takes a column when the pane can spare one — below roughly 920px it becomes a collapsible "On this page" list above the document instead of squeezing the text you're reading. That threshold is set for laptops: a 13" MacBook with the sidebar open keeps its outline column, while a split editor correctly falls back to the list. The ambiguous `+` button now says what it does ("Subsections"), and repeated entries like the five "Implementation" headings announce which section they belong to.
- **Task lines read as tasks, not as bracket soup.** The task id and the `[P]` / `[US1]` markers are labels *about* a task, so they now sit ahead of the description as small chips instead of raw brackets in the middle of the sentence. File paths and inline code inside a task quieted down too — a path is a reference, so it no longer shouts louder than the task it belongs to, and it picks up the accent only when you hover it.
- **A theme you can actually read, in both modes.** The viewer now ships its own tested light and dark palette (statuses, surfaces, syntax) instead of inheriting whatever the editor theme happens to define — every text/surface pair clears WCAG AA in both modes, and code blocks render on a dark surface that stays readable even in light themes. Typography follows your editor font.
- **Narrow panes now collapse by pane width, not window width.** The layout responds to the viewer's own pane (the rail folds to a horizontal strip around 900px), so a VS Code split behaves correctly even in a wide window.
- Custom workflows, living specs, inline review comments, and every lifecycle state behave exactly as before — the redesign changes how the viewer looks and lands, not what it does.

### Added

- **Action-only workflow steps now show on the rail.** A step with no output file of its own — stock **Implement**, or a custom workflow's Discuss / Execute / Verify — renders in its true position in the pipeline, marked as an action and showing done/current/running state, instead of silently disappearing. Selecting one opens the document it actually runs from (Implement opens Tasks), so no rail entry is a dead click. Custom commands scoped to such a step surface in the footer while the workflow sits at that step.

### Fixed

- **You can open a document from the Overview again.** Clicking Specification, Plan, or Tasks while the Overview was showing did nothing: those clicks rebuilt the whole panel, which reset the view and landed you right back on the Overview. Navigation is now a true single-page swap, so every rail entry is reachable from every other one.
- **A finished spec no longer nags about being out of date.** The "Plan was generated before the current specification — consider regenerating" banner (and the matching warning mark on the step) kept showing on completed and archived specs, where there is no regenerating left to do. Staleness now goes quiet once a spec settles.
- **A completed run no longer suggests a next step.** The footer used to read "Next: Reactivate" on a finished spec; reactivating is a deliberate reversal, not forward motion. It now simply says the run is complete.
- **"Continue Run" now dispatches the step it says it will.** In a custom workflow with action steps between documents, the forward button could say one step (e.g. "Execute") but run another (the workflow's first action step). The button's label and its dispatch now derive from the same next-step walk, so they can never disagree.
- **The spec editor and workflow editor got their host theming back.** The redesign's owned palette had leaked into the shared token file and repainted both editors; the palette is now scoped to the spec viewer only, and the other webviews follow your VS Code theme again.

## [0.28.1] - 2026-07-11

### Fixed

- **Wibey CLI: "Invalid command format" error on macOS.** The previous dispatch used `wibey -p "$(cat "path")"`, which breaks when the temp-file path contains spaces (macOS stores VS Code extension storage under `~/Library/Application Support/…`). Switched to interactive TUI mode: SpecKit now starts `wibey` in an interactive session, waits for the TUI to initialise, then sends the command as typed text — no shell expansion, no quoting issues.
- **Wibey CLI: new terminal opened on every dispatch.** Each SpecKit action was creating a fresh terminal instead of reusing an existing Wibey session. The provider now scans `vscode.window.terminals` for a live "SpecKit - Wibey" terminal and reuses it; a new one is created only when none is found.
- **Wibey CLI: TUI closed after each task.** Running `wibey -f/-p` in headless mode caused Wibey to exit once the task finished. The interactive approach keeps Wibey running after each task so the developer can continue working in the same session.
- **Wibey (VS Code): provider appeared to do nothing.** The URI-handler dispatch path (`vscode.env.openExternal` with a `vscode://` scheme) returns `true` even when the target extension has no registered URI handler, silently swallowing the dispatch. This blocked the clipboard fallback (the only path that works today) from running. The URI-handler path is now disabled until `genaica/wibey-vscode-extension#442` ships.

## [0.28.0] - 2026-07-10

### Added

- **Hands-off runs now finish on their own.** Auto mode used to run everything and then stop at the very end, waiting for you to click "Mark Completed." Since an auto run is unattended by definition, it now carries the spec all the way to completed with no clicks. Manual, step-at-a-time runs are unchanged and still keep that final confirmation for you.
- **Pick a model and effort per step.** A custom workflow step can now say which Claude Code model and reasoning effort to use, so an easy step can run cheap and fast while a hard one gets the heavier model. Set it on the step in your settings; it applies only when Claude Code is your assistant.
- **Reference docs that are not specs finally have a home.** A workflow can now point at folders it reads for context (for example a planning or codebase folder) as "reference" sources. Those show up under the Steering view instead of cluttering the Specs list, and they no longer get mistaken for an un-started spec with a phantom progress bar.
- **A gentle nudge when a run goes quiet.** If a step looks like it is running but nothing has changed on disk for a while, the spec view shows a small "still running?" strip with Resume and Set status buttons. It never changes anything on its own, it just gives you a quick way to pick things back up.
- **Reveal and reach files from more places.** "Reveal in File Explorer" and "Reveal in Explorer View" now work from the Spec Explorer and Steering trees, not just the Specs list. Each spec row also gets a single "..." menu that gathers status, lifecycle, copy, reveal, and delete instead of a crowded row of icons.

### Changed

- **The Specs toolbar is easier to scan.** Install sits on the far left, the view controls (filter, sort, collapse) group in the middle, and the "new spec" plus button moves to the far right.
- **Plainer wording in the Spec Explorer.** A capability that lives next to its code now shows its folder instead of the word "colocated," with the full detail moved to the tooltip.

### Fixed

- **A slash in a custom step command no longer breaks it.** Writing a step command as `/to-spec` used to turn into `//to-spec` and fail. A leading slash is now handled cleanly, so both forms behave the same.
- **The "Install spec-kit Extension" button works again.** It was passing a `--force` flag the current spec-kit CLI does not accept, so the install failed. That flag is gone.

## [0.27.0] - 2026-07-10

### Added

- **Wibey joins the AI provider list (CLI + VS Code panel).** You can now pick Wibey — Walmart's built-in AI coding assistant — as your provider, in two shapes: the `wibey` command line (dispatches SpecKit commands to a terminal) and the Wibey VS Code chat panel. The panel doesn't wait on any pending Wibey feature: it tries the in-editor send command first, then a deep link, then falls back to copying the command onto your clipboard, so it works today and gets smoother as Wibey adds support.
- **Living specs open in the rendered viewer.** Clicking a capability in the Spec Explorer used to dump you into raw markdown, lint squiggles and all. It now opens the same rendered reading experience as feature specs — minus the workflow stepper and footer, because a living spec has no phases — with the capability's tiers (Spec, Architecture, Coverage) as tabs when they exist.
- **Custom workflows start from their own first step.** The Create Spec dialog assumed every workflow begins with `specify` and quietly dispatched the stock command for workflows that don't. A workflow shaped `discuss → plan → execute → verify` now dispatches its own first command from the dialog.

### Fixed

- **No fake timestamps in the activity summary.** A custom workflow whose progression is reconstructed from files on disk has no real run clock, but the Phases summary was rendering the placeholder start as a literal date ("Started Dec 31, 07:00 PM · 1s active"). The wall-clock summary now appears only when a step carries an extension-stamped time; otherwise the phase names show without invented timing.
- **Custom workflows are recognized even when a step reuses a built-in name.** A workflow whose only navigable step happens to be called `plan` (like GSD: discuss → plan → execute → verify, where discuss/execute/verify are action-only) was misread as a built-in workflow, so its progression never ran and the next-step button never appeared. Custom detection now considers every step, including action-only ones, so these workflows advance correctly.
- **A related-docs step reads as created in the sidebar.** The Specs tree showed "not created" next to a step whose output isn't a fixed filename (GSD's plan phase writes `01-01-PLAN.md`), even while that document hung right beneath it. The row now reflects that the step is created, and stays expandable to its documents.
- **Custom workflows advance on related-doc output too.** A step that produces numbered or free-named files instead of a fixed one (GSD's plan phase writes `01-01-PLAN.md`, not `plan.md`) was never seen as "done," so the forward button to the next step never appeared. When a step is marked to include related docs, Companion now counts any spec-folder document it produced as its output — the Execute step surfaces once the plan is written.
- **Colocated living specs render their content.** The living viewer anchored tier lookup on `spec.md` in the file's directory, which only exists in the centralized layout — a colocated spec like `src/lib/storage.spec.md` opened to a header with an empty body. The viewer now anchors on the file that was actually clicked, so both layouts render, and two colocated capabilities sharing a folder each open their own family of tiers.
- **Custom workflows keep advancing after the extension's own bookkeeping.** The file-driven progression now compares the files on disk against the recorded position instead of bailing whenever any history exists — so clicking the forward button once no longer freezes the workflow at its previous step.
- **The forward button now works for your own workflows too.** Bring-your-own workflows wired through `speckit.customWorkflows` (Matt Pocock's skills, GSD, anything that runs commands and writes markdown) never advanced in the viewer: after the first step, the button to run the next one simply never appeared, and the spec sat stuck at "specify." The reason was that a custom workflow's commands don't emit the capture context the built-in pipeline relies on, so the extension couldn't tell the run had progressed. Companion now reconstructs a custom workflow's position from the step output files on disk — the spec it wrote, the tickets folder it filled — so the forward button lights up and dispatches the right next command, step after step, exactly like the built-in flow. Built-in and context-emitting workflows are unaffected.

### Examples

- Added runnable demo projects under `examples/` for custom and mixed workflows (Matt Pocock skills, GSD × Superpowers) and for living specs in both the default folder and colocated next to the code, each on a full spec-kit + constitution + Companion base.

## [0.26.1] - 2026-07-10

### Fixed

- **The Implement button comes back after an interrupted run** (#414): if the AI died partway through implementation (a network drop, a closed terminal), the dead run's leftover "started" record permanently hid the Implement button — forcing the status back with the sidebar gear looked like it did nothing, and the only workaround was deleting `.spec-context.json` and losing the spec's history. Forcing an earlier status now genuinely rewinds the workflow position: the forward button (Implement, or Tasks when rolling back to planned) reappears, the interrupted step stops falsely showing as completed, and the aborted attempt stays visible in the spec's history. No files to delete, recovery in two clicks.

## [0.26.0] - 2026-07-06

### Changed

- **Activity panel polish from a design review** (#405): the active tab no longer draws a broken-looking box after a mouse click (keyboard users still get a clear focus ring), each number appears exactly once (one coverage donut in the hero, no counts repeated in section headings), and the Proof/Notes tabs badge only what needs attention — uncovered requirements and open concerns, warning-tinted — instead of summing unrelated things. Checks render as compact pills that pack like tags rather than a grid with holes, section headings read in Title Case so the hierarchy is visible again, coverage rows drop their doubled bullet markers, the tiny metadata labels are more legible on every theme, and the viewer header shows the spec name in Title Case instead of a lowercase slug.
- **Step timers only show durations that were actually measured** (#392): some timestamps in a spec's history are journaled by the AI after the fact — they put events in the right order but say nothing about how long the work really took. The viewer's derived timing now distinguishes measured spans from journaled ones, so elapsed-time displays can stop presenting bookkeeping as effort. Alongside this, the spec context schema now declares the new reasoning-trail fields the spec-kit extension records (the goal, out-of-scope list, decisions, verifications, and requirement coverage), so the viewer can read them.

  ![The Work tab: phases strip with measured durations and journaled tasks](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity-work.png)
  *What happened, with receipts: the phases strip shows only genuinely measured durations, and every task is journaled as it finished with the files it touched.*

- **A colorful sidebar** (#389): the Steering view now uses full-color icons instead of flat monochrome glyphs — steering docs, the constitution, and section headers each get a recognizable icon, and the provider node shows your AI provider's actual brand logo (Claude, Gemini, GitHub Copilot, Codex, Qwen, OpenCode, Cursor, or Windsurf). The spec list keeps its familiar color-tinted beakers (blue in progress, yellow implemented, green done), and the Active/Completed/Archived group headers are now colorful too. Repeated leaf icons (every script, template, agent, and skill row) and the dimmed file paths on SpecKit Files rows were dropped to cut visual noise. Icons come from the open-source Fluent Emoji and Lobe Icons sets.
- **Companion commands now open, and the Companion node moved up** (#389): in the Steering view, the entries under Companion → Commands used to do nothing when clicked — each now opens the command's prompt body. The Companion node also moves to the second spot in the Steering view so it's easier to find.

### Added

- **The living specs a feature touches are now readable inside the viewer** (#394): the Activity panel's Notes tab used to list only the names of the capability specs a feature loaded or folded back into — reading their content meant opening raw files. Each capability now renders inline: its one-line purpose, its requirements as readable rows, and — for completed specs that folded changes back — the change counts (added/modified/removed). Old specs and workspaces where the content can't be found keep the simple name list with a quiet "content unavailable" note. A new committed demo spec (`specs/_03_demo-living`) lets you see the card without configuring living specs.
- **The Activity panel now shows the reasoning, not just the timeline** (#397): open a spec and the panel leads with a **Goal** card — what the spec is for and what it deliberately isn't — followed by richer **Decisions** (each choice with its why and the rejected alternative; a regression that hid newly-captured decisions entirely is fixed), a **Verified** card (the checks that proved the work, including warnings that were seen and dismissed), and a **Coverage** card answering "is this requirement tested?" per requirement with a covered/total rollup. The Approach card also shows how the pipeline sized the change. Old specs without the new data render exactly as before.

  ![The Decisions tab: each choice with its why and the rejected alternative](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity-decisions.png)
  *The road not taken: every decision with its WHY and the alternative it REJECTED.*

- **The Activity panel became a brief, not a scroll** (#400): it now opens with a hero strip — status, sizing, honestly-measured active time, and stat chips (tasks, coverage with a donut, checks, concerns) that jump to their detail — followed by an always-visible plan block showing the spec's goal, the context it worked from, its out-of-scope fence, and the approach. Everything else moved into four keyboard-navigable tabs (Decisions, Work, Proof, Notes) with count badges; when requirements are uncovered or concerns are open, Proof opens first. Verifications render as green/amber pills, requirement chips are tinted by covered state, decisions are numbered, and the phase timeline gained duration bars for genuinely measured spans. Older specs render gracefully with only what they have.

  ![The Activity panel brief: hero stats and the Plan section](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity.png)
  *The brief: status, honest active time, and stat chips up top; the Plan states the intent, the context the run worked from, and what was out of scope.*

- **The Spec Explorer can now act, not just list** (#393): right-click a capability in the Spec Explorer to run a **drift check** or a **requirement-coverage check** — each is sent to your AI assistant scoped to that capability, the same way every other Companion command dispatches. The view's title bar gains an **Adopt Code Area** action (the brownfield wizard, handy from the empty state) and a **Refresh** button. Capability rows also show their health at a glance: a `3/5 covered` count when a coverage file exists, and a `● drift` marker (with a warning-colored icon) when code has changed since the living spec was last committed. Health is computed quietly by the extension itself and simply stays absent when it can't be determined — the tree never errors or stalls.
- **Support the project from inside the editor** (#388): if SpecKit Companion saves you time, there's now an easy way to chip in. A "Sponsor" button appears on the Marketplace listing and the extension details view, the Specs sidebar welcome screen has a "Support this project" link, and there's a "Sponsor SpecKit Companion" command in the Command Palette. All of them open the project's GitHub Sponsors page. Nothing changes if you'd rather not — it's entirely optional.
- **Companion templates in the Steering view** (#389): the Companion node now has a **Templates** group listing the prompt templates the Companion preset ships (the per-step command bodies it layers over stock SpecKit), the same way SpecKit Files lists its templates. Click one to open it. It appears only when the installed Companion extension actually carries templates.
- **Recover a stranded spec with "Set status…"** (#347): an out-of-order or double click could leave a spec in a state where the lifecycle buttons wouldn't let you continue, and the only fix was hand-editing a JSON file. Every spec in the sidebar now has a **Set status…** action — on the right-click menu and as a hover gear — that lets you force the spec to any lifecycle status (specifying through completed) after a `"Force status to X?"` confirm. The override is recorded just like any other lifecycle change and the sidebar updates immediately, so a mis-click is no longer a dead end.

### Fixed

- **Stock-workflow specs no longer get stuck, and their Activity panel fills up** (#408): when you dispatch a standard SpecKit command from the GUI without the companion spec-kit extension installed, the instructions the extension sends along used to reference a helper that didn't exist in your workspace — so progress recording silently failed and specs could freeze at "specifying" forever. The helper now ships inside the editor extension itself, so it always exists. And stock runs now record the same reasoning trail the Companion pipeline does — the goal and out-of-scope fences, working context, decisions, checks, and per-requirement coverage — so the Activity panel is a real brief on stock workflows too, not just a bare timeline. Verified end-to-end by a new committed sandbox eval that replays the exact GUI-dispatched instructions against a real model in a companion-free workspace.

  ![The Proof tab: verified checks with their commands and a requirement coverage map](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity-proof.png)
  *Proof, not self-report — captured on a plain stock spec-kit run: six checks with the exact command each ran, and every requirement mapped to the tasks and tests that satisfy it.*

- **The sidebar Resume button no longer clicks into the void without the spec-kit extension** (#407): with the SpecKit Companion Workflow enabled but the companion spec-kit extension not installed, Resume used to stay visible and a click silently sent a command your AI CLI couldn't resolve — nothing happened, no explanation. The button now hides when the extension is missing, and if the command runs anyway you get the standard warning with an **Install spec-kit Extension** action instead of a dead dispatch.
- **The "Install spec-kit extension" banner no longer hides behind the beta setting** (#369): the prompt that offers to install the companion spec-kit extension used to appear only after you'd turned on the SpecKit Companion Workflow beta — which meant the people most likely to want the extension never saw the nudge to get it. The banner now shows on its own merits: whenever the extension is missing and you haven't dismissed it or turned its setting off, no matter how the workflow toggle is set. Installing the extension, dismissing the banner, and turning off its `speckit.companion.installPrompt` setting all still hide it exactly as before.

## [0.25.0] - 2026-06-23

### Changed

- **A cleaner, more readable spec viewer.** Body text is bigger and section headings stand out, so long specs are easier to scan; the top step nav is refreshed and clearly marks the step you're on; the Activity "Phases" timeline is now a vertical timeline; and badges and callouts are calmer and higher-contrast. The viewer's font also renders correctly now (text had been silently falling back to a system font).
- **The "Install spec-kit extension" prompt is smaller and you can dismiss it for good** (#353): the prompt that suggests installing the companion spec-kit extension used to be a tall card — a rocket icon, a heading, two lines of text, and a button — sitting at the top of Create Spec and the Activity panel on every visit, with no way to make it go away. It's now a single compact line with an Install action, a Learn more link, and an "×" to dismiss it. Dismissing hides it right away and remembers your choice everywhere, so it won't come back in any project or after a reload. It still only appears when the extension isn't installed.
- **Leaner instructions sent alongside SpecKit Companion commands** (#352): when the editor runs a SpecKit Companion step, the bookkeeping instructions it prepends are now trimmed to just the parts that change each run — the dispatch time, the spec folder, and the "don't get ahead of yourself" note — because the Companion command already carries the full recording protocol. This removes a duplicated block of text that wasted space and could occasionally cause a step to be logged twice. Plain SpecKit steps are unchanged in scope but now use a single, more reliable instruction to mark a step done and move the status forward, instead of a two-step manual edit. You won't see a difference in the spec timeline; runs are just a bit tighter and less error-prone.

### Added

- **Specs render as rich, structured pages.** Instead of plain markdown, the viewer now lays specs out for fast reading: requirements and success criteria become labeled rows, acceptance scenarios read as clean Given/When/Then sentences, key entities and research decisions show as cards, the spec-quality checklist groups into pass/fail cards, tasks gather under their phases, and the plan's Technical Context and Constitution Check render inline as a grid and pass/fail rows.
- **An Auto button builds the whole spec hands-off, right from Create Spec.** Select the **SpecKit Companion** workflow and an **Auto** button appears next to Create Spec: describe what you need and walk away while it runs specify → plan → tasks → implement → completion on its own, with no approval pauses. **Create Spec** still does the normal step-by-step flow, so you choose per spec. Auto only shows for the Companion workflow (it needs the companion spec-kit extension); with stock SpecKit selected, only Create Spec appears, and the step-by-step flow always stays available.

## [0.24.0] - 2026-06-15

### Fixed

- **The "Install spec-kit extension" banner stays readable in a narrow panel** (#327): when the Create-Spec or Activity panel was slim, the banner's heading and body got crushed into a thin column of one- and two-word lines while the buttons clung to the right edge. The banner now adapts to its own width — the install button and "Learn more" link drop onto their own row below the text when space is tight, the body always wraps across the full width, and an over-long heading is trimmed with an ellipsis you can hover to read in full. At comfortable widths it looks exactly as before.
- **Stock specs no longer get stuck after the Specify step** (#332): in a plain SpecKit project — without the companion spec-kit extension — running Specify from the editor's chat panel used to finish writing the spec but leave it showing "specifying" forever, with the next-step button hidden, so the only way forward was hand-editing a file. Specify now advances to "specified" on its own and the next-step (Plan) button reappears. Specs running the Companion pipeline are unaffected — they already advanced on their own.
- **The spec viewer's footer now follows the spec's own workflow** (#317): the next-step button in the open spec used to always reflect the default pipeline, even for a spec running a different workflow. It now resolves each spec's own workflow (the same way the sidebar does) and falls back to the default only when none is set, so the button you see and click matches the spec in front of you.
- **Task checkboxes line up with their labels, including long multi-line tasks** (#331): a wrapping or completed task used to drop its whole label onto a line below the checkbox, and the checkmark drifted as you changed the editor font size. The checkbox now sits next to the first line with the rest of the label hanging-indented, and it stays aligned at any font size.
- **The Create Spec placeholder reads as faded guidance** (#330): the description field's placeholder used the full body text color, so an empty field could look like it already had text typed in. It's now a muted gray — clearly a placeholder, still legible.

### Changed

- **One switch turns on the whole SpecKit Companion experience** (#170): a single Beta Features setting now enables both the Create-Spec workflow picker and the Continue/Resume button — no more separate resume toggle. With the setting on (and the companion extension installed), Create Spec offers the SpecKit / SpecKit Companion picker and the sidebar shows the resume button; with it off, you're on stock SpecKit only. The picker no longer appears when the companion piece isn't installed, so you'll never see a Companion choice that silently does nothing — and the install prompt stays reachable so you can add it. Upgrading is seamless: if you'd already turned the old resume toggle on, that choice carries over automatically and the old setting is cleaned out of your settings.
- **The Completed group now lists only specs you've actually finished** (#306): a spec that reaches the end of implementation but hasn't been marked done yet stays in the **Active** group instead of dropping into **Completed**. This keeps the "still needs your Mark as Completed" state visible — which matters most for stock specs that never auto-complete — and the Completed group's count now reflects only the specs you've truly confirmed. Filtering and sorting work the same on the regrouped specs; archived specs are unaffected.
- **Create Spec page polish — clearer guidance, bigger type, tidier layout** (#296): the **Workflow** picker now sits on its own right-aligned row just above the description field, so nothing crowds it. The field's text is bumped to a comfortably readable size, and the empty field's placeholder does the teaching — it lists what helps (what the feature is, the problem it solves, who it's for, key requirements), shows a sample Jira link and a sample GitHub link to copy the shape of, and makes clear you can paste a reference link on its own and skip writing a description entirely. The redundant on-page "Specification" label and helper paragraph were removed from view (kept for screen readers) now that the title, subtitle, and placeholder carry the guidance.
- **One workflow choice replaces three beta toggles** (#168): you now make a single decision — run the stock **SpecKit** pipeline or the **SpecKit Companion** pipeline — from one setting (`speckit.defaultWorkflow`) and the **Workflow** dropdown in Create Spec, which pre-selects it. The three former toggles — the template profile, the per-spec turbo workflow picker, and the complexity fast-path flag — are gone; the leaner output they used to enable now comes from the Companion workflow itself, and right-sizing small vs. large changes happens automatically inside that workflow with nothing to flip. Picking SpecKit Companion in a project that doesn't have the companion spec-kit extension safely runs the standard flow instead, with a one-click install prompt. Upgrading is seamless: the default stays SpecKit, existing specs keep running the commands they started with, and any leftover values for the removed settings are cleaned out of your settings automatically.
- **The Create Spec page is easier to use and accessible** (#272): the form now sits in a centered, readable-width column instead of stretching across the whole editor, with persistent writing guidance below the field (it stays visible while you type) and a primary button that reads **Create Spec** and stays disabled until you've written something. The attachments area collapsed into a compact "Attach image" control beside the field, and the character counter stays out of the way until you near the 50,000 limit. It's now usable without a mouse or sight: errors, "creating your spec…", and image attach/remove are announced to screen readers; every button has a meaningful name; every control shows a visible focus ring when you tab to it; the limit is communicated beyond color and over-limit content can't be submitted; the keyboard hint shows Cmd on macOS; and pressing Esc with typed content asks before discarding your work.

### Added

- **Mark implemented specs complete from the sidebar, and tell them apart at a glance** (#271): a spec that finishes the pipeline sits in the **Active** group as "implemented" but still needs your confirmation. You can now right-click it and choose **Mark as Completed** — previously the only way to confirm was the spec viewer's footer. Implemented specs also get a distinct **yellow** beaker icon (vs. the green icon for confirmed-completed specs), so you can see at a glance which specs are done and which are still awaiting your sign-off.
- **Opt-in anonymous telemetry** (#129): a new `speckit.telemetry` setting (default on) sends anonymous, PII-free usage signal that helps prioritize which AI providers and pipeline features to invest in — the selected provider, the default workflow (speckit/companion), which workflow phase was dispatched, spec lifecycle counts (created / completed / archived), and the on/off state of beta flags. It honors VS Code's global telemetry setting too: if either switch is off, nothing is sent. It never collects prompt content, file paths, spec names, or custom workflow names — only enum-like values, booleans, versions, counts, and a random per-spec id that correlates one spec's events without revealing which spec it is. See the Telemetry section in the README.

## [0.23.0] - 2026-06-12

### Added

- **Resume button is now an opt-in beta** (#140): the sidebar resume (▶) button ships under the "Beta Features" group and defaults to off. Enable `speckit.companion.resumeBeta` to show it on active specs (active / tasks-done); toggling it on or off updates visibility immediately, with no window reload. Resume now also dispatches the command family the spec has been running — a turbo spec resumes with `/speckit.companion.<step>`, a stock spec with `/speckit.<step>` — across every step it can advance.
- **Complexity fast-path** (#137): an opt-in beta (off by default) that, in `turbo` mode, fast-tracks small changes straight from specify to implement, skipping the separate plan and tasks stages. When a change projects at or under 5 files / 10 tasks (and reads as a small change), specify writes a single combined `spec.md` — the usual sections plus an inline Approach and Implementation Tasks list — and lands the spec at the implement step in one run. Larger changes keep the full pipeline; a change that crosses the 5-files / 10-tasks guardrail warns and runs the full pipeline rather than fast-tracking silently. Enable it with the `speckit.companion.complexityFastPath` setting. See `docs/template-profiles.md`.
- **Template profiles** (#132, #134): a new `speckit.companion.templateProfile` setting (`standard` | `turbo` | `off`, default `off`) picks the shape of the spec-kit pipeline. `standard` runs the stock commands; `turbo` produces a trimmed shape — a spec with no user-story section, tasks grouped by files/dependencies, and a smaller spec folder; `off` falls back to plain upstream spec-kit. **Both command sets stay installed at all times** — switching the setting is non-destructive: it only routes which one a spec uses and never deletes either, so creating a spec never fails with "Unknown command", in any mode or after any number of switches. Each spec pins the project default the moment it's created, so changing the setting reshapes only new specs, never one already in flight. See `docs/template-profiles.md`.
- **One-click install and graceful degradation for the spec-kit extension** (#234): the GUI now detects whether the companion spec-kit extension is installed and works fine without it. When it's missing, an **Install spec-kit extension** banner appears in the Create-Spec and Activity panels and an install icon appears in the Specs sidebar — clicking either runs the install in an integrated terminal, no copy-paste. Already-installed projects never see the banner.
- **Pick the leaner pipeline per spec at create time** (#247): when the companion spec-kit extension is installed, the Create-Spec **Workflow** dropdown offers a choice that pins the leaner companion pipeline on just that spec, regardless of the project default. Opt-in beta.

### Changed

- **The per-spec Workflow picker choice is now labeled "SpecKit Companion"** (#284): in the Create-Spec **Workflow** dropdown, the choice that pins the leaner turbo `/speckit.companion.*` pipeline on a single spec now reads "SpecKit Companion" instead of "Turbo", so the picker names the real contrast — stock SpecKit vs. the companion pipeline — directly. Label-only: the choice still pins the same turbo pipeline, the `speckit.companion.templateProfile` setting still lists Standard / Turbo / Off, and no settings or existing specs are migrated.
- **Beta Features are ordered by adoption, and dependencies are explicit** (#275): the six Beta Features settings now appear in funnel order — install prompt, template profile, turbo workflow picker, complexity fast-path, resume button, activity panel — instead of alphabetically, so it's clear what to enable first. Every toggle except the install prompt now states that it needs the companion spec-kit extension and links to the install instructions, so a toggle that looks inert is clearly waiting on the extension. Defaults and behavior are unchanged — only the ordering and descriptions differ.
- **Clearer Beta Features descriptions** (#140): the four Beta Features settings (Activity panel, template profile, complexity fast-path, resume button) now lead with what they do before how they work, reading at about two lines each in the settings UI. No setting keys or values changed.
- **Template profiles and the complexity fast-path are now opt-in beta** (#137): both ship under a "Beta Features" settings group and default to off — `speckit.companion.templateProfile` now defaults to `off` (plain upstream spec-kit) and `speckit.companion.complexityFastPath` defaults to `false`. Turn template shaping on by selecting `standard` or `turbo`; existing projects that already pinned a profile are unaffected.
- **The trimmed profile is named "turbo"** (#226): the trimmed pipeline shape ships under the `turbo` value of `speckit.companion.templateProfile`; its pre-release working name "lean" was dropped before any release, so there is no old value to migrate.
- **More accurate timing in the activity panel** (#215): per-task and per-substep durations are now measured from single finish events rather than reconstructed from start/complete pairs. This removes the `0s` ticks, the unattributed gaps between tasks, and the substep "bursts" that previously showed up in the timeline, so per-step and per-task durations read accurately. See `docs/capture-and-timing.md`.
- **The in-flight indicator now lives on the step tab, not the footer** (#277): a running step used to show two competing cues — a "Generating…" pill at the bottom and the step tab. The footer pill is gone; the step tab is now the single "AI is working" signal, and during implement it shows a spinning indicator next to the live task percentage instead of a static "Tasks 0%". While a step is still in flight the footer no longer offers the next-step button (there's nothing to advance yet). Reduced-motion users get a static indicator.
- **Finished specs read as done** (#257): a fully-implemented spec is now a first-class "implemented" state — the Resume action is hidden on finished specs, and they're shown distinctly in the sidebar. Marking a spec completed by hand still works.
- **Beta toggles are a simple on/off** (#259): the Beta Features settings collapsed from a three-way (off / beta / on) control to a plain on/off switch, and the redundant "beta" badges were dropped — less to reason about for the same behavior.
- **Sidebar polish** (#258, #238): a distinct install icon plus grouped, consistently-ordered sidebar actions, and spec rows no longer repeat the status text next to the spec name.
- **More readable text on dark themes** (#254): secondary and muted text and ghost buttons were brightened to meet accessibility contrast minimums on dark backgrounds.
- **Richer Activity panel** (#256): the panel now shows per-task summaries and a live implement percentage that advances as tasks complete.

### Fixed

- **In-editor "Install / Update spec-kit Extension" now pulls the newest build** (#283): the in-editor install action — the banners, the Upgrade… → Update spec-kit Extension row, and the install command — was hardcoded to an older pinned version, so "Update" silently installed a build older than the one you were already running. It now points at a stable address that always serves the latest published spec-kit extension, so install and update both land the newest build and no longer drift out of date between releases.
- **A finished implementation reliably shows as done** (#277): when every task was checked and the work committed, the viewer could keep spinning and the timer keep counting indefinitely. Completing any step — specify, plan, tasks, or implement — now updates the open viewer on its own within a second or two, the spinner stops, and the next action appears, with no need to switch steps. This works wherever your specs live, including the configured spec directories rather than only the legacy location.
- **Newly-created specs appear instead of stranding on the welcome screen** (#270): a spec created under the SpecKit CLI's `.specify/specs/` layout was never discovered, so the sidebar stayed stuck on "Welcome to SpecKit / Create your first spec". `.specify/specs` is now scanned by default, and a freshly-created spec clears the welcome screen and lists itself without reloading the window.
- **In-app update notifications fire again, and install links resolve** (#274): the extension referenced a retired publisher handle, which silently disabled the "a new version is available" notification and pointed every Marketplace/OpenVSX install and listing link at a dead (404) page. The update check now reads your installed version reliably and the links resolve to the live listing. The check also compares only against the VS Code releases, so a spec-kit-side release no longer masquerades as a newer GUI version.
- **Switching modes no longer deletes your commands** (#134): selecting the trimmed shape used to swap command bundles in a way that could leave a project with no usable pipeline commands — creating a spec then failed with "Unknown command: /speckit-specify". The mode is now a non-destructive routing choice: both command sets are always present, and a project left without its stock commands by an earlier version recovers automatically on the next reload.
- **A running step's tab no longer gets stuck spinning** (#229): when a step settled, its tab could keep showing an "in progress" looping-arrows indicator; the tab now stops on the settled state and shows a clear sync glyph while genuinely running.
- **OpenCode: images in the spec editor load again** (#208): spec-editor images now resolve under OpenCode, staged in a self-contained workspace location so they render instead of failing to load.

## [0.22.0] - 2026-06-07

### Added

- **Live per-task journaling on implement** (#130): the implement-step context preamble now instructs the AI to append a `history[]` entry as it finishes *each* task (`substep`/`task` = the task id, `by: "ai"`, real `date -u` timestamp), so the activity log shows real per-task timing instead of one end-of-run burst from the `after_implement` hook. The live entries carry the `task` id, so the hook's `--tasks-file` sync dedupes against them and becomes a no-op backstop (it still journals everything when the preamble is disabled). Applies to single-step `/speckit.implement` and multi-step/auto lifecycle runs.
- **Status + Resume in the sidebar** (#130): each active spec row now shows its current step and a one-line **last transition** (e.g. `plan — Plan started · 2h ago`, derived from the canonical `history[]`), plus an inline **Resume** action (`$(play)`). Resume dispatches `/speckit.companion.resume` for the spec via your configured AI provider — continuing the pipeline from the recorded step with prior decisions in scope, and at the next unchecked task when mid-implementation. The action is gated to active specs (not completed/archived) and the row updates live once the dispatched step records its state. Backed by two new Companion spec-kit commands (`speckit.companion.status` / `speckit.companion.resume`) and a `status-context.py` resolver that reads `.spec-context.json` or derives state from on-disk files when it's missing. Resume works on the stock spec-kit version (no `specify workflow resume` subcommand required).
- **Recovery for a malformed `.spec-context.json`** (#144): when a spec's context file exists but is not parseable JSON (truncated write, hand edit, merge-conflict markers), the viewer now surfaces an error notification naming the JSON parse error and the offending file path — instead of silently falling back to a read-only draft render. The notification offers a **Reset context** action that moves the broken file aside to a timestamped backup (`.spec-context.json.bak-<timestamp>`) and writes a fresh minimal skeleton in its place, then reloads the viewer. The original bytes are never overwritten in place (they survive in the backup); dismissing the notification leaves the broken file untouched and reopening the spec re-offers the reset. The reader now throws a typed `SpecContextParseError` (carrying `filePath` + `reason`) so the corrupt-file case is distinguished from a missing file without sniffing message text. JSON-syntax failures only — semantically-off-but-parseable files are still tolerated and coerced.

### Fixed

- **`upgradeProject` / `upgradeAll` sent an invalid `--ai claude-code`** (#195): the upgrade actions ignored the configured AI provider and always passed `--ai claude-code`, which the spec-kit CLI rejects with `Unknown agent 'claude-code'`. A pure resolver now maps `speckit.aiProvider` (and the host editor, for `ide-chat`) to a valid CLI agent; both dispatch sites route through it, and an unrecognized provider falls back to `claude`. The three upgrade commands are consolidated behind a single **Upgrade…** picker, and a stale `speckit.workflowEditor.enabled` doc reference was removed. (#190 — thanks @JLanders96)
- **Spec viewer footer/step buttons appeared or disappeared after clicking other controls** (#197): the footer and step tabs are now a deterministic function of a single `ViewerState`, so a still-valid button never vanishes and an expected one never fails to appear when you click an unrelated control — it reads as intentional progressive disclosure, not a glitch. (#193, #190 — thanks @JLanders96)
- **Approve could re-dispatch an already-completed phase** (spec 116, #186): the Approve action now dispatches off `ctx.currentStep` instead of the viewed document type, so viewing an earlier step's doc can't re-run a phase that's already done.
- **Ordinary prose with dots rendered as bogus file-reference pills** (#187): file-reference pills are now gated on the extension allow-list rather than a "contains a dot" heuristic, so text like `e.g. 1.5x` no longer turns into a fake clickable file link.
- **`analyze` and `clarify` left viewer stuck on "needs regeneration"** (#194): `buildPrompt` short-circuited for these two steps because `CANONICAL_SUBSTEPS` only listed `specify` / `plan` / `tasks` / `implement` — so the bookkeeping preamble was never injected and the AI had no instruction to flip status or append a completion history entry. Added `analyze` and `clarify` to the substep table (single-pass — empty arrays), wired their completed status (`ready-to-implement` / `specified`) and done phrase, and guarded the substep-line renderer for empty arrays. Works in isolation: no edits to `.specify/extensions.yml` or user-local skill files required.
- **`.spec-context.json` wipe on tab click**: a transient read failure (concurrent CLI write → partial JSON → `JSON.parse` throws) used to be conflated with "file doesn't exist" at every layer — `readSpecContext`, `getFeatureWorkflow`, and `writeSpecContext` all silently treated read errors as `null`. The spec viewer's `ensureSpecContext` would then write a fresh `backfillMinimalContext` (raw-basename `specName`, empty `history`, `status: 'draft'`) over the real file, destroying lifecycle history. Fixed across the stack: the readers now return `null` only for `ENOENT` and throw on parse/IO errors; `writeSpecContext` stat-guards the target and refuses to write when an existing file is present-but-unreadable; the spec viewer's `updateContent` only calls `ensureSpecContext` on the first open of a panel (subsequent tab clicks are strictly read-only); `saveFeatureWorkflow` only emits a minimal context on `ENOENT`. New regression tests (`specContextWipeGuard.test.ts`) pin the on-disk file-unchanged invariant.

### Changed

- **Spec viewer in-flight footer** (spec 115): `Generating <Step>…` is no longer rendered as a disabled primary button — it's now a non-clickable accent-tinted status chip (pill + spinner) on the **right** with `role="status"` / `aria-live="polite"`. The `Mark step complete` manual override moves to the **left** styled as a quiet secondary action, communicating "one thing is happening, one thing is a fallback override." Applies uniformly to specify / plan / tasks / implement. No behavior change to the override click handler; approve / inline-comment / post-completion footer modes are unchanged.
- **Create Spec moved to the Specs title bar; manual refresh dropped** (#189): the **Create Spec** action now lives as the rightmost Specs view title-bar action, and the redundant manual **Refresh** button was removed — the file watcher already keeps the tree current.
- **Removed the CLI path override settings** (#200): provider CLI paths are now resolved automatically instead of being hand-configured, so the per-provider path settings were dropped from the configuration.

### Docs

- **New "Setup & Components" README section** (#198): clarifies which components are required, how the VS Code extension relates to the CLI spec-kit, and which workflows are supported — addressing the onboarding confusion reported in #192. (#192, #190 — thanks @JLanders96)

## [0.21.0] - 2026-05-27

### Added

- **Brand-name provider labels** (spec 108): the AI provider dropdown now shows disambiguating brand names alongside the technical slugs (e.g. "Claude Code", "GitHub Copilot CLI", "Gemini CLI"), so the selection isn't ambiguous when multiple CLIs share a vendor.

### Changed

- **`.spec-context.json` schema migration**: collapsed the separate `stepHistory{}` map and `transitions[]` array into a single canonical append-only `history[]` log; added an explicit `kind: "start" | "complete"` field on each entry, replacing the self-loop `from.step === step` convention. Legacy files normalize transparently on read; the writer always emits the new shape. `stepHistory` is now derived in-memory by the viewer.
- **Per-spec history is the single source of truth**: viewer panels and the stepper derive their per-step state from `history[]`, eliminating the prior dual-source drift that produced phantom "Generating <step>…" states.

### Fixed

- **State machine end-to-end** (15 findings, F1–F16): no more duplicate completion entries on phase-button clicks; the Approve button is hidden on backward-viewed stepper tabs so it can't re-dispatch already-completed phases; status closes at `implemented` rather than skipping straight to `completed`. The `Mark Completed` button is now the single user-owned closure gate for the implement step.
- **Stepper visual sync**: the per-step stepper now re-derives `stepHistory` on filesystem-watcher updates, not just on user clicks — the badge and the orange progress ring stay synchronized after the AI completes a step (closes F16).
- **Wrapping task line rendering** (spec 112): wrapping tasks no longer reserve a phantom flex row beneath the text, and the `+` comment-button slot stays reserved through hover so the text doesn't reflow.
- **Sidebar empty rows** (spec 114): child step rows in `'empty'` state no longer attach an open command — clicking them stays inert until the AI generates the doc, replacing the prior file-not-found error toast.
- **Inline-comment persistence**: comments now persist on any document (`spec.md`, `plan.md`, `tasks.md`, child docs), not only `spec.md`.
- **Comment line-height parity** (spec 110): adjacent task lines render at the same height as commented lines, removing the inline-comment-induced jitter.
- **Preamble hardening**: every preamble now pins a real dispatch-time UTC for the seed entry (no more midnight placeholders), fences the seed-write block to override schema proposals in the feature description, and splits `by: "extension"` (extension-dispatched) from `by: "ai"` (AI-appended). A unicode-fenced closure checklist reinforces "MUST DO BEFORE ENDING" so the AI doesn't drop completion entries.
- **Install pipeline**: `vscode:prepublish` now chains `npm run compile` before `npm run package-web`, ensuring extension-side TypeScript always recompiles into `dist/` before `vsce package` bundles. Previously webpack-only prepublish silently shipped stale `dist/` when only extension code changed.
- **Viewer typography**: header bottom-margins increased for breathability (h1 16→20, h2 8→16, h3 6→10 px) and markdown content font size +1 px overall; the wrapping task line line-height tightens for visual cohesion.

## [0.20.0] - 2026-05-25

### Documentation

- **Fix broken Marketplace screenshots**: The "lean image set" refactor renamed/deleted screenshots while README image URLs stayed pinned to the `main` branch, so the published Marketplace listing resolved several images to files that no longer existed (404). Republishing carries the corrected README (all referenced images exist on `main`), and a new stable-filename policy (documented in `CLAUDE.md` and `docs/screenshots/CAPTURE.md`) prevents recurrence — screenshots are now overwritten in place, never renamed.
- **Fix heading/caption mismatch**: the `Visual Workflow Editor` feature heading sat above a spec-viewer screenshot; renamed to `Visual Spec Viewer` so heading, alt text, and caption agree.
- **Marketplace-safe links**: converted in-page anchor links (`#configuration`, `#activity-panel`) to absolute GitHub anchors, since same-page anchors don't navigate on the VS Code Marketplace.
- Added `docs/readme-content-review.md` — an audit of where the README carries too much implementation detail (for a future trim).

## [0.19.0] - 2026-05-25

### New Features

- **Claude in VS Code provider — drive specs from the Claude Code panel instead of a terminal**: A new `claude-vscode` value for `speckit.aiProvider` opens the Claude Code GUI panel (the `anthropic.claude-code` extension) and pre-fills the assembled prompt, rather than spawning the `claude` CLI in a terminal. The full prompt — including the `.spec-context.json` bookkeeping preamble — is written to a workspace file and `@`-mentioned so the panel receives the whole instruction, while the visible command is cleaned for readability. **Known limitation:** the panel pre-fills but does not auto-submit — press **Enter** to send. Falls back to the default provider for an unrecognized `speckit.aiProvider` value (#171).

- **Workflows hide themselves when the active provider can't run them**: A workflow can declare `supportedAiProviders`; when set, it is hidden from selection unless the active `speckit.aiProvider` is in that list (e.g. the Claude-only SDD workflow now surfaces only for `claude` / `claude-vscode`). Existing specs keep their real steps under any provider — `getWorkflow()` resolves against the unfiltered list, so only the selection menu is filtered (#172).

### Improvements

- **README refresh**: Screenshots re-shot against the current viewer UI with a leaner image set and an AI hero image; retired the deferred `VIDEO-PROMPT.md` (#174).

## [0.18.0] - 2026-05-22

### New Features

- **IDE Chat provider — route prompts to your editor's built-in AI chat**: A new `ide-chat` value for `speckit.aiProvider` dispatches the assembled prompt to the host editor's built-in chat instead of spawning a terminal CLI. It auto-detects the host (VS Code/Copilot, Cursor, Windsurf, Antigravity), resolves the right chat command, strips the bookkeeping preamble, shortens the spec path to just the spec name, inlines the new-spec description, and formats the command per host (dot `/speckit.tasks` for Copilot/Windsurf, dash `/speckit-tasks` for Cursor/Antigravity skills). Requires spec-kit initialized for the host editor (`specify init --ai <agent>`); when it isn't, the prompt is prefilled (not sent) with an actionable warning.

  > **⚠️ Cursor and Windsurf support is work-in-progress.** Only **VS Code / GitHub Copilot** is fully supported end-to-end (prefill **and** auto-submit). **Cursor** prefills the command but you must press **Enter** to send it (Cursor exposes no callable "submit prompt" command). **Windsurf** drops the prompt on open, so the command is **copied to your clipboard** and Cascade is opened for you to paste (⌘V) and press Enter. **Antigravity** is best-effort. These forks' chat commands are proprietary/undocumented and may change.

- **Optional SpecKit commands surface as per-tab buttons in the spec viewer**: SpecKit's three optional refinement commands now appear as one-click footer buttons on the tab where each is most useful — **Clarify** on the Spec tab, **Checklist** on the Plan tab, and **Analyze** on the Tasks tab (right before implementing). They are built-in and workflow-agnostic (no `customCommands`/`customWorkflows` entry required), sit alongside any custom-command buttons, and dispatch the same registered command you'd run from the Command Palette (provider formatting and step tracking included). A user-defined command with the same id takes precedence so overrides always win (#156).

- **Activity view & PHASES timeline overhaul**: Reworked the spec-viewer Activity tab and the `.spec-context.json` pipeline behind it. The PHASES card now reports active time (idle gaps capped) with an overall Started / Total / Ended header and per-substep timing; completion timestamps finalize correctly, sub-second durations no longer all read `<1s`, the Implement phase no longer repeats a generic `phase1` label, the repeated author badge is de-noised, and the Activity tab no longer shows the previously-selected tab's sub-navigation. Skill-authored context fields are now declared in the schema (#169).

### Bug Fixes

- **Spec documents render correctly on Windows and CRLF checkouts**: The spec viewer's markdown renderer now normalizes CRLF / lone CR to LF before parsing, so documents checked out with Windows line endings (git `autocrlf`) or opened in a Windows-mounted dev-container render as formatted markdown instead of raw text (literal `#`, `---`, and `-` prefixes). It also strips spec-kit's leading YAML frontmatter and the tasks.md `## Format:` notation legend so that authoring boilerplate no longer leaks into the rendered output on any platform (#170, closes #158).

## [0.17.0] - 2026-05-21

### New Features

- **Inline comment composer is now a single GitHub-style card**: The line composer reads as one cohesive bordered card — a context header (what you're commenting on), the comment textarea, and a single footer row — instead of a textarea with a secondary action floating above it. The secondary line action (Remove Line / Remove Story / Remove Section / Remove Scenario / Toggle + Remove Task) sits left-aligned in the footer, with Cancel / Add Comment right-aligned. Acceptance-scenario rows show the scenario context in the same header. Visual restructure only — anchoring, submission, scratchpad persistence, keyboard shortcuts, auto-focus, and every action's outcome are unchanged (#162).
- **Inline review comments now persist to a per-document scratchpad**: When you submit a batch of inline comments via the source-tab **Refine** button, the AI gets the direct-edit prompt as before *and* the same batch is appended to a matching `<doc>-extra.md` history file (`spec-extra.md`, `plan-extra.md`, `tasks-extra.md`). Each entry records the exact source line, the nearest preceding heading, and the full source block (paragraph or list item, walked from the actual source markdown) so the trail stays meaningful even after the source file is edited and line numbers shift. Entries render as a labeled `## Refinement batch · TIMESTAMP` → `### Line N · Section` → **Original** quote → **Comment** layout, newest batch on top, with `---` rules between batches. The scratchpad sub-tab appears in the children rail only once the file exists (no manual create path) and is a read-only history with only an Edit affordance for manual cleanup. Scratchpads are non-core: never gate phase transitions, never count toward task completion, committable to source control.

### Bug Fixes

- **Activity panel tolerates non-array task_summaries fields**: The viewer no longer blanks out when a `.spec-context.json` has `task_summaries[*].concerns` or `.files` stored as plain strings instead of arrays; such values are coerced so Phases and Tasks render cleanly (#159).
- **Multi-line blockquotes render as one card**: The viewer's markdown renderer now groups consecutive `>` lines into a single `<blockquote>` element instead of fragmenting them into one card per line.
- **Sidebar green check no longer contradicts "not created"**: The pass icon on Spec / Plan / Tasks sub-items in the explorer tree is now gated on the file actually existing on disk, so a hand-crafted or out-of-sync `.spec-context.json` can't show "completed" next to a missing document.

## [0.16.0] - 2026-05-12

### New Features

- **Viewer Footer State Machine**: Reshaped the spec-viewer footer to match the actual workflow state. Noisy controls hide while a step is in flight; the forward button dynamically labels itself per workflow step (Plan / Tasks / Implement / Complete) so the next action is self-describing. Adds a new `implemented` status as the final approval gate before `completed`. Storybook now covers the full lifecycle plus Refine variants. `docs/viewer-states.md` is the new source of truth for footer matrix and step-tab visuals (#157).
- **Per-Spec Timeline Panel**: A Timeline toggle in the spec-viewer nav bar swaps the markdown pane for a chronological view of every transition in `.spec-context.json`. Entries are grouped by step (oldest-first) with substep, actor badge (`extension` / `cli` / `sdd` / `ai` / `user`), and relative timestamps; absolute ISO is in the tooltip. Updates live when external `/sdd:*` skills append rows — piggybacks on the existing watcher, no new polling (#152, closes #110).
- **Beta Features settings section**: Split extension settings into two groups in VS Code's Settings UI — the main "SpecKit Companion" group and a new "SpecKit Companion: Beta Features" group. The Activity panel toggle (`speckit.viewer.activityPanel`, values `off` / `beta` / `on`) now lives in the Beta group so users can find and change it instead of relying on its undeclared default.

### Bug Fixes

- **Refine No Longer Wipes plan.md**: The Refine button used to dispatch the per-step slash command (e.g. `/speckit.plan`), whose first action copies the plan template over the existing file. Refinement now sends a direct-edit prompt that names the target file and forbids running setup scripts or regenerating from a template, applied uniformly to spec / plan / tasks (#155).

### Documentation

- **Contributing Guide + PR Template**: Fleshed out the contributing guide with concrete development, testing, and PR-flow guidance; new pull request template ensures every PR includes a summary, test plan, and screenshot checklist where applicable (#151).

## [0.15.0] - 2026-04-27

### New Features

- **Copy Spec Path / Copy Spec Name**: Right-click a spec in the sidebar to copy either the workspace-relative path or just the slug, ready to paste into PRs, chat, or external tools (#149)
- **Group Header Bulk Actions**: Right-click the Active, Completed, or Archived group header in the Specs sidebar to apply a lifecycle transition to every visible spec at once (Mark all as Completed / Archive all / Reactivate all). Gated by a confirmation dialog with the post-skip count (#148)
- **Group-Aware Right-Click Menu**: Per-spec right-click actions now hide options that don't apply to that spec's lifecycle group, so you only see actions you can actually run (#147)

### Bug Fixes

- **Diff View No Longer Hijacked**: Removed the custom editor that auto-redirected every `specs/**/*.md` open to the SpecViewer panel. Source Control diffs now show VS Code's text diff editor and the regular File Explorer opens raw markdown — the SpecKit sidebar remains the canonical entry point for SpecViewer (#150)
- **PowerShell + Copilot Auto-Approve**: Codex provider now uses PowerShell-compatible command substitution; Copilot CLI auto-approve flag is forced so commands no longer hang waiting on a prompt that can't be surfaced (#145)

## [0.14.0] - 2026-04-27

### New Features

- **Pinned Viewer Header + Responsive TOC Sidebar**: Spec viewer header stays pinned while scrolling, and a responsive table-of-contents sidebar links to each H2/H3 for fast navigation in long specs (#139)
- **Onboarding Card for Zero-Spec Workspaces**: Replaces the silent empty welcome view with a "Create your first spec" card that links to docs and triggers the spec editor in one click (#137)
- **Always-Show SpecKit Icon + Empty-State Welcome**: The activity-bar icon now appears whether or not a workspace is open, and shows a contextual empty state instead of disappearing — fixes the "extension didn't load" confusion on first install (#134)
- **Reveal in Finder + Explorer View from Tree**: Tree view file items now expose "Reveal in OS Finder" and "Reveal in Explorer View" context-menu actions (#132)

### Improvements

- **README Refresh**: Top-of-page positioning rewritten, latest features documented, factual gaps fixed, and a maintenance rule added so the README stays current per release (#143)
- **Sample Specs Section in README**: Points to in-repo example specs so new users have a clear "what does good look like" reference (#136)
- **Polished Related-Tab Styles**: Related-tab styling now matches the step-tab chip language for visual consistency in the spec viewer (#133)

### Bug Fixes

- **Viewer State Display**: Fixed branch chip rendering, in-flight `%` pill, and substep label in the spec viewer (#131)
- **Current-Step Chip Contrast**: Improved current-step chip contrast on purple themes so the active step stays readable (#130)

## [0.13.0] - 2026-04-24

### New Features

- **Color-Coded Badge Statuses**: Every canonical spec status (draft, specifying, specified, planning, planned, tasking, ready-to-implement, implementing, completed, archived) now has a distinct color treatment — accent in-progress tier with gentle border breath, success-subtle intermediate-done tier, muted draft tier — so header badges read at a glance (#125)
- **Spec Header Layout Refresh**: Spec viewer header moves the created-date to a small right-aligned muted pill in row 1, drops the "Created:" prefix, gives the branch tag a purple treatment with a `git-branch` codicon, and promotes the title to its own line (#125)
- **Live Elapsed Timer on Step Tabs**: Step tabs for running work now show a live elapsed timer (`12s` / `3m 22s` / `2h 15m`) next to the in-flight pill, derived from `stepHistory.startedAt` so it survives webview reloads. A step-complete notification fires when `completedAt` transitions (#120)
- **Specs Tree Fuzzy Filter**: Fuzzy filter input over the specs tree for quick navigation (#121)
- **Specs Tree Sort Options**: Sort the specs tree by name, date, or status (#122)

### Improvements

- **Step Tab Visual Polish**: Brighter completed-step labels, inset accent ring + tinted fill on the current step (wraps the whole tab even when in-flight), harmonized label colors (icons/rings carry state), extra breathing room on in-flight tabs so the working pulse doesn't crash into the connector (#125)
- **Storybook Coverage**: One story per canonical status for `Primitives/Badge` and `Viewer/SpecHeader`, plus `Viewer/StepTab` stories for current+in-flight, elapsed-timer bands, and a 4-step `AllStates` row (#125)

### Bug Fixes

- **Codex Cross-Shell Command Pipe**: Codex provider now uses PowerShell-compatible command substitution instead of Unix `<` input redirection, and honors the `script` setting from `.specify/init-options.json` so Windows PowerShell users can run SpecKit commands without parser errors (#124)

## [0.12.1] - 2026-04-22

### New Features

- **Two-Row Viewer Header**: Spec viewer header now renders in two rows — status/branch badges above the title — instead of a single cramped flex row; the redundant `spec.md` / `plan.md` / `tasks.md` pill under the divider is gone (#119)
- **Tree Group Counts**: Spec tree group headers now display the count of specs in each group (#101)
- **Live Viewer Repaint**: Viewer repaints automatically on approve/regenerate and forces an AI completion marker for snappier feedback (#117)
- **Unified Webview Tokens + Undo Safety**: Webview design tokens unified, assets bundled, and undo safety added for editor actions (d902ad4)

### Improvements

- **Quieter Viewer Colors + Larger Mermaid**: Title/heading colors softened, and flowchart/sequence mermaid diagrams render at natural width with larger text instead of shrinking to the container (#118)
- **SDD Branch Auto-Creation**: `.sdd.json` now supports a `branchStage` + `branchNameFormat` to auto-create feature branches at specify or implement (#100)

### Bug Fixes

- **Viewed-Step Checkmark Preserved**: Clicking a completed step tab no longer hides its ✓; the accent outline marker around the currently viewed tab has been restored (#119)

## [0.12.0] - 2026-04-20

### New Features

- **Canonical `.spec-context.json`**: `.spec-context.json` is the single source of truth for workflow state, derived by the extension and consumed by the viewer (#83, #84, #86)
- **Context Preamble for AI Prompts**: AI prompts automatically include a context-update preamble so providers keep `.spec-context.json` in sync through the lifecycle (#85)
- **Provider Registry & OpenCode Support**: AI providers moved to a registry pattern; OpenCode joins Claude Code, Gemini, Copilot, Codex, and Qwen (#87)
- **Multi-Select Bulk Status Commands**: Select multiple specs in the tree and change status (archive, complete, reactivate) in one action (#88)
- **Locked Future Steps**: Workflow tabs lock future steps while a step is running and expose tooltips to explain each action (#90)
- **Collapse/Expand All**: Spec tree now has a collapse/expand toggle with reduced flicker and tighter sub-file indentation (#95)
- **Reveal Spec Folder**: New tree context menu to reveal a spec's folder in Finder / Explorer (#98)

### Improvements

- **Step Completion Inference**: Completion is inferred from file state when `stepHistory` is missing, so older specs render correctly (#87, #92)
- **Cleaner Slash Command Routing**: Preamble is passed via `--append-system-prompt` so slash commands arrive cleanly to the AI CLI (#96)
- **Hidden Launch Prompts**: Prompt content is dispatched via a temp file to keep the terminal view clean (#82)

### Bug Fixes

- **Numeric Spec Sorting**: Specs sort by numeric prefix so `069` appears above `068` and `067` (#97)
- **Incomplete Spec-Context Reconciliation**: Viewer now reconciles partial `.spec-context.json` files and keeps lifecycle buttons enabled correctly (#93)
- **Tab Clicks No Longer Mutate Workflow**: Clicking a step tab in the viewer no longer changes `currentStep` in `.spec-context.json` (#89)

## [0.11.0] - 2026-04-10

### New Features

- **Floating Toast Notifications**: Upgraded terminal toast to a floating notification with slide-in/fade-out animations, positioned at bottom-right with auto-dismiss (#81)
- **Command Format Setting**: Added `speckit.commandFormat` setting to switch between dot (`speckit.plan`) and dash (`/speckit-plan`) command formats for compatibility with different speckit versions (fixes #73, #76)
- **Transition Logging**: `.spec-context.json` now logs step transitions with timestamps for debugging and audit (#75)
- **Archive Button Repositioned**: Archive button moved to left side of footer for better UX flow (#77)

### Improvements

- **Preact Migration**: Spec-viewer webview migrated from vanilla DOM to Preact with Storybook support (#74)

### Bug Fixes

- **Bullet Point Rendering**: Fixed bullet points not rendering correctly in lists containing code blocks (#79)
- **List Item Spacing**: Reduced excessive spacing between list items in spec viewer (#80)
- **Storybook Preact Aliases**: Added Preact aliases to resolve "React is not defined" errors in Storybook

## [0.10.0] - 2026-04-05

### New Features

- **Spec Context as Source of Truth**: `.spec-context.json` is now the single source of truth for workflow state, replacing scattered markdown-based heuristics. Badge text, created/last-updated dates, and step progress are all derived from context data (#61, #62)
- **Redesigned Spec Viewer Header**: Structured metadata layout showing badge, status, created date, and last-updated date from spec-context (#64)
- **Workflow Command Buttons**: Workflow-defined `commands` now render as action buttons in the spec-viewer footer alongside primary CTAs (#69)
- **Mermaid Diagram Zoom**: Mermaid diagrams in the spec viewer now include zoom controls (+, −, Reset) for navigating large diagrams
- **Provider Config Tree**: Steering sidebar restructured with Project/User groups for clearer organization of AI provider config files (#55)
- **Provider-Aware Commands**: AI provider prompts now include spec-context instructions and use provider-specific command formatting

### Bug Fixes

- **Step Completion Badges**: Working/active indicator no longer shows on completed steps — uses `stepHistory.completedAt` for accurate status (#67)
- **Workflow Persistence**: Workflow selection persists correctly across spec lifecycle; default renamed to "speckit" to prevent accidental overwrites (#60)
- **Explorer Status Icons**: Prefer SDD `step` field for explorer status icon; checklists now appear under Specify phase (#65)
- **Plan Sub-Files**: Combined `subFiles` and `subDir` in `getStepSubFiles` so Plan children display correctly (#68)
- **Read-Only Tree Rendering**: New `resolveWorkflow()` avoids writing `.spec-context.json` during tree rendering and viewer init
- **Disabled Step Tabs**: Step tabs for non-existent files are now disabled instead of being silently clickable
- **Completed Status**: Uses explicit `next=done` for completed status instead of fragile substep heuristics (#57)
- **Spec Directory Discovery**: Directories with `.spec-context.json` (SDD in-progress specs) now appear in explorer even without markdown files

### Improvements

- **Sorted Completed/Archived Specs**: Completed and archived specs now sort by creation date (newest first), matching active spec behavior
- **Unified Step Context Schema**: Simplified step context field names for consistency (#66)
- **Centralized Constants**: Magic strings extracted into named constants (#59)
- **Green Working Pulse**: Active step animation uses green (success) color instead of accent blue
- **Inline Code Styling**: Removed heavy box styling from inline code highlights for cleaner appearance
- **Editor Comment Area**: Inline editor comment section has a visible border for better visual separation
- **Smaller Line Actions**: Reduced add-button size for less visual clutter

### Documentation

- Updated architecture docs, how-it-works guide, and CLAUDE.md to reflect current codebase (#63)

## [0.9.3] - 2026-04-02

### New Features

- **Unified Permission Mode**: New `speckit.permissionMode` setting replaces per-provider settings (`claudePermissionMode`, `copilotPermissionMode`, `qwenYoloMode`). Values: `"interactive"` (default, recommended) and `"auto-approve"` (YOLO). Applies to Claude, Copilot, and Qwen. (#7)

### Improvements

- **Spec Viewer Lifecycle Buttons (BETA)**: Overhauled lifecycle buttons and simplified status system in the spec viewer. Status-based sidebar grouping with colored step indicators.
- **Safe Default**: Extension no longer defaults to bypass-permissions mode. New installs start in interactive mode.
- **Removed Permission Gate**: Removed the PermissionManager/PermissionWebview startup dialog — no permission prompt on extension activation.
- **Specs View Always Visible**: Specs sidebar view is no longer gated behind a visibility setting — always shows when a workspace is open.

### Breaking Changes

- Per-provider permission settings removed: `speckit.claudePermissionMode`, `speckit.copilotPermissionMode`, `speckit.qwenYoloMode`. Use `speckit.permissionMode` instead.
- Setting `speckit.views.specs.visible` removed — Specs view is always visible.

## [0.9.2] - 2026-04-01

### New Features

- **Active/Earlier Grouping**: Specs in the explorer tree are now grouped into "Active" (modified today, expanded) and "Earlier" (older, collapsed), with active specs sorted newest-first (#48)
- **Spinning Indicator**: Spec node shows a spinning icon when a workflow step command is running
- **Missing File Indicator**: Steps with no file show "not created" in dim text for clear visibility

### Improvements

- **Cleaner Tree View**: Removed static circle status indicators and step-specific icons for a less cluttered appearance
- **Label Rename**: Default workflow step "Specify"/"Specs" renamed to "Specification" for clarity

### Bug Fixes

- **Dimmed Tree Items**: Fixed git-ignored spec files appearing grayed out by removing `resourceUri` from tree items (#47)

## [0.9.1] - 2026-03-31

### New Features

- **Workflow Commands**: Workflows can now define `commands` — extra action buttons that appear next to the primary action for a given step (e.g., an "Auto Mode" button next to Submit in the spec editor) (#45)
- **Action Toast & Auto-Navigate**: Spec viewer now shows a toast notification after running an action and automatically navigates to the next workflow phase (#44)

### Bug Fixes

- **Terminal Timing**: Replaced fixed 800ms `setTimeout` with VS Code's shell integration API (`onDidChangeTerminalShellIntegration`) for detecting terminal readiness before sending commands — prevents commands from being lost on slow shell startup (#46)
- **Extension Host Cleanup**: Audited all disposables in `activate()` to ensure clean shutdown without "closing extension host" warnings

### Improvements

- **Shell Integration Fallback**: Terminals on VS Code versions below 1.93 (lacking shell integration events) gracefully fall back to a 5-second timeout
- **Shared Utility**: New `waitForShellReady` utility used consistently across all 5 AI providers and steering manager

## [0.8.0] - 2026-03-26

### New Features

- **Scoped Related Docs**: Related documents in the spec viewer are now scoped to their parent workflow step (#38)
- **Welcome Buttons**: Conditional welcome buttons for init and constitution setup in sidebar views (#37)

## [0.7.0] - 2026-03-26

### New Features

- **Optional SpecKit CLI**: Extension now works without SpecKit CLI initialization (#35)
- **Copilot permission mode**: New `speckit.copilotPermissionMode` setting to control auto-approval (`yolo`/`default`)

### Bug Fixes

- **Copilot CLI command**: Replaced `ghcs` (shell suggestion tool) with `copilot` CLI — the correct coding assistant executable (#36)
- **Copilot non-interactive mode**: Added `-p` flag for prompt mode and `--yolo` for auto-approving shell actions
- **Copilot slash commands**: Strip leading `/` from prompts since Copilot CLI doesn't use slash commands

### Improvements

- **Steering sidebar consolidation**: Merged agents, skills, and hooks into the steering view (#34)
- **CLI defaults constant**: Added `CLIDefaults` constant for centralized provider executable names

## [0.6.0] - 2026-03-22

### New Features

- **Configurable Spec Directories**: New `speckit.specDirectories` setting with glob pattern support for flexible project layouts (e.g., `openspec/changes/*/specs/*`). Empty directories auto-hidden from sidebar (#31)
- **Action-Only Workflow Steps**: Workflow steps now support an `actionOnly` flag for commands that don't produce output files (#31)
- **Flexible Workflow Steps**: Added `includeRelatedDocs` support for surfacing related documents in the workflow viewer (#30)
- **Feedback Entry Points**: Settings panel now shows Report a Bug, Request a Feature, and Rate on Marketplace items with dedicated icons (#29)
- **Inline Spec Delete**: Trash icon appears on hover for spec rows in the sidebar (#29)

### Bug Fixes

- **Status Bar Messages**: Replaced noisy info popup notifications with unobtrusive status bar messages (#27, #28)

### Improvements

- **README Overhaul**: Updated documentation with blog screenshots and refreshed configuration guide (#32)
- **Spec Viewer Overhaul**: Document scanner, phase calculation, and navigation rebuilt for custom workflow steps and configurable directories
- **Explorer Deduplication**: Spec explorer now deduplicates spec names across multiple directories

## [0.5.0] - 2026-03-01

### New Features

- **File Reference Buttons**: Smaller, more compact pill buttons using VS Code's native codicon font instead of custom SVG icons
- **Short File Names**: File-ref buttons now show basename only for paths with directories, with full path in tooltip
- **Source File Button**: Always-visible source file button and new sidebar "Open Source" action (#25)
- **Custom Workflows UX**: Dynamic sub-commands and output channel logging for custom workflows (#24)
- **Spec Editor CTA**: Simplified create spec footer call-to-action (#23)
- **Clickable File References**: Code spans referencing files are now clickable buttons in the spec viewer (#22)
- **Qwen Code CLI**: Added Qwen Code as a new AI provider (#21)

### Bug Fixes

- **MCP Panel**: Resolved infinite spinner when Claude CLI is unavailable
- **Spec Viewer**: Brighter text, tighter layout, and cleaner navigation

### Improvements

- **SDD Worktree**: Strengthened worktree entry instructions with `pwd` verification and branch rename checks
- **SDD Commands**: Added AskUserQuestion to checkpoints and fixed minimal mode state
- **Project Structure**: Updated CLAUDE.md to reflect current codebase layout

## [0.4.0] - 2026-02-13

### Bug Fixes

- **Markdown Rendering**: Fixed underscore (`_`) in code and identifiers being rendered as italic in spec viewer (#14)
- **CLI Pre-flight Checks**: Added install checks for Copilot and Gemini CLI providers — users now see a helpful error with install instructions instead of a cryptic shell error (#19)
- **Provider-Aware Init**: Built-in agents (`.claude/agents/kfc/`) and system prompts are no longer created when using non-Claude providers (#19)
- **Permissions**: Simplified permission system and silenced agent init errors

## [0.3.5] - 2026-01-27

### Bug Fixes

- **Settings**: Fixed `speckit.defaultWorkflow` setting placement - was incorrectly defined outside `configuration.properties`, causing VS Code to report "Unknown Configuration Setting"

### New Features

- **Light Tasks Command**: Added `/speckit.light-tasks` command for simple flat task list generation without phases or dependency analysis

## [0.3.4] - 2026-01-27

### New Features

- **Default Workflow Setting**: New `speckit.defaultWorkflow` setting to auto-select a workflow for new features without prompting
- **Step-Tasks Support**: Added `step-tasks` as a workflow-configurable step alongside specify, plan, and implement
- **Dynamic Footer Buttons**: Approve button in spec viewer now dynamically updates based on document type and workflow progress

### Improvements

- Footer button text contextually shows "Generate Plan", "Generate Tasks", or "Implement Tasks" based on current phase
- Validates `defaultWorkflow` setting on extension activation with warning if configured workflow doesn't exist

## [0.3.1] - 2026-01-27

### New Features

- **Custom Workflows**: Define alternative workflows with custom commands for each step via `speckit.customWorkflows` setting
- **Workflow Selector**: Dropdown in spec editor to choose between default and custom workflows
- **Light Workflow Commands**: New streamlined commands (`light-specify`, `light-plan`, `light-implement`) for rapid development
- **Git Commands**: New `/speckit.commit` and `/speckit.pr` commands for workflow automation

### Improvements

- **Custom Commands**: Added `step` property to show commands in specific phases (spec, plan, tasks)
- **Custom Commands**: Added `tooltip` property for hover descriptions
- Simplified `customWorkflows` schema by removing `checkpoints` (handled by AI CLI)

## [0.3.0] - 2026-01-25

### New Features

- **Claude Permission Mode Setting**: New `speckit.claudePermissionMode` setting to choose between YOLO mode (bypass all permissions) or interactive permission prompts
- **Codex CLI Support**: Added OpenAI Codex CLI as a new AI provider with prompt template support

### Improvements

- **Spec Viewer**: Improved UX with inline line actions (refine, remove) on hover
- **Spec Viewer**: Refined typography and visual polish
- **Spec Viewer**: Modularized codebase for better maintainability
- **Steering**: Recursive document scanning for nested steering files
- **Steering**: Fixed refine button functionality

### Housekeeping

- Internal code refactoring and modularization

## [0.2.28] - 2026-01-02

### Improvements

- **Spec Editor**: Replace drag-and-drop with clipboard paste (Ctrl+V / Cmd+V) for image attachments
- **Spec Editor**: More reliable image thumbnail display
- **Workflow Editor**: Research tab now correctly appears under Plan phase
- **Workflow Editor**: Related docs sorted alphabetically for consistency
- Updated screenshots with higher quality images

### Housekeeping

- Removed unused legacy assets

## [0.2.26] - 2025-01-02

### New Features

- **Spec Editor**: New rich webview for creating specifications
  - Multi-line text editor with formatting preservation
  - Image attachments via file picker or drag-and-drop
  - Load existing specs as templates
  - Keyboard shortcuts (Ctrl+Enter to submit, Esc to cancel)
- Plus button in Specs view now opens the Spec Editor

### Improvements

- Automatic temp file cleanup for submitted specs
- VS Code theme integration for Spec Editor

## [0.2.21] - 2025-01-02

### Improvements

- Internal refactoring for better code maintainability
- Add architecture documentation (`docs/HOW_THIS_WORKS.md`)
- Add `/install-local` command for developers

## [0.2.11] - 2025-01-02

### New Features

- Add configurable Gemini CLI initialization delay setting (`speckit.geminiInitDelay`)
- Add setting to disable phase completion notifications (`speckit.notifications.phaseCompletion`)

### Improvements

- Increase default Gemini CLI init delay from 5s to 8s for better reliability

## [0.2.10] - 2025-01-02

### New Features

- Add SpecKit Files section to Steering view showing `.specify/` directory contents
- Display constitution, scripts, and templates from SpecKit project configuration
- File watcher for `.specify/` directory with automatic refresh

### Improvements

- Fixed contextual initialization message - only shows when valid workspace is open
- SpecKit files organized into collapsible categories with appropriate icons

## [0.2.9] - 2024-12-30

### New Features

- VS Code theme integration for workflow editor
- All hardcoded colors replaced with CSS custom properties mapped to VS Code theme variables
- Theme-specific fallbacks for light, dark, and high-contrast modes

### Improvements

- Compact layout with reduced header margins (~30% vertical space reduction)
- Typography uses VS Code font settings

## [0.2.0] - 2025-12-09

### New Features

- Improved Gemini CLI support with proper interactive mode handling

### Fixed

- Fix extension reload prompt when changing AI provider

## [0.1.7] - 2025-12-08

### New Features

- Add Skills view with YAML frontmatter support for Claude Code skills

### Fixed

- Remove Claude Code as automatic reviewer in PRs

## [0.1.3] - 2025-12-03

### New Features

- Add `autoExecute` parameter to `executeSlashCommand` for flexible CLI control

### Improvements

- Simplify permission setup flow (terminal only, no WebView popup)
- Make "Don't Ask Again" for init popup global across all projects
- Implement command now triggers when approving tasks phase

### Fixed

- Fix remove button only showing on removable lines (checkbox, bullet, numbered, user-story)

## [0.1.2] - 2025-12-02

### Fixed

- Fixed OpenVSX namespace to match publisher ID (alfredoperez)

## [0.1.1] - 2025-12-02

### Improvements

- Added OpenVSX publishing support for Cursor IDE users
- Updated acknowledgment section with project source

## [0.1.0] - 2025-12-02

### Initial Release

SpecKit Companion - VS Code companion for GitHub SpecKit, enabling spec-driven development with AI assistants.

### Features

- **Spec Explorer**: Visual tree view for managing feature specifications
- **Workflow Editor**: Custom markdown editor with action buttons for spec workflow
- **SpecKit CLI Integration**: Full support for SpecKit CLI commands (specify, plan, tasks, implement, clarify, analyze, checklist, constitution)
- **Steering Documents**: Manage user and project rules for AI context
- **Agents View**: Display and manage Claude Code agents
- **Hooks View**: View configured Claude Code hooks
- **MCP Servers View**: Monitor MCP server connections and status
- **Multi-AI Support**: Foundation for Claude Code, Gemini CLI, and GitHub Copilot CLI
- **Auto-detection**: Automatic detection of SpecKit CLI installation and workspace initialization
- **Install Guidance**: Welcome views guiding users through CLI installation and workspace setup
