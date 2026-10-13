# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.37.0] - 2026-10-13

A plan that draws what a change touches, and a Workflow Builder that works on plain Spec Kit.

### Highlights

#### A plan draws its blocks
A plan can now carry four kinds of block, and the viewer draws each one as a card: call paths as a tree, a lifecycle as boxes you can click through, a screen as ==a rough wireframe with numbered notes==, and code with a note pinned under the line it explains.
<!-- area: spec-viewer; pr: 898, 904, 905; media: plan-calls, plan-states, plan-screen, plan-code -->

#### The Workflow Builder opens on stock Spec Kit
Renamed from Pipeline Builder, the board now draws a plain Spec Kit project's own workflow and edits ==what Spec Kit owns==: extension hooks, document templates and the constitution command. A decision block opens one row per answer so a verdict skips the steps you choose, and a header chip turns living specs on or off.
<!-- area: pipeline-builder; pr: 883, 888, 889; media: builder-hooks -->

#### Plain Spec Kit stays plain
A project that still carries the retired Companion wrapper around the stock commands is ==cleaned up on the next start==, and the Steering view no longer lists its files.
<!-- area: pipeline; pr: 906 -->

### Added
- **Hover a spec to see its branch.** The sidebar tooltip names ==the branch the work is on==, beside the status and the assistant. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: sidebar -->

### Fixed
- **The Run log reads cleanly.** Each task line in the Overview's Run log has ==space between its parts== and a badge for who recorded it. ([#912](https://github.com/alfredoperez/speckit-companion/pull/912)) <!-- area: overview -->
- **Plan cards work on the Copilot board.** A `states` block is drawn as a diagram where ==a click shows that state==, and the buttons that did nothing are gone. ([#911](https://github.com/alfredoperez/speckit-companion/pull/911)) <!-- area: copilot-app -->
- **A file link opens its own file.** A path in a spec opens ==the file it names== at its line, not a same-named file elsewhere. ([#897](https://github.com/alfredoperez/speckit-companion/pull/897)) <!-- area: spec-viewer -->
- **The header and the Tasks tab agree.** The header counts ticked boxes out of every task in `tasks.md`, the same read the tab's percentage uses. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **A finished task never reads as in progress.** The chip shows only on an open task while the run is still implementing. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **A line action reaches the line you clicked.** Comments, edits and ticked boxes use the line's place in the file, so Refine names the right section. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
- **The Copilot board unlocks the next step.** A step the agent wrote the document for but never closed in the run record is closed when the turn ends. ([#881](https://github.com/alfredoperez/speckit-companion/pull/881)) <!-- area: copilot-app -->

## [0.36.0] - 2026-10-06

Follow a Spec Kit run from inside Claude Code, and meet the moss mascot.

### Highlights

#### Follow a Spec Kit run from inside Claude Code
A new Claude Code mod pins your spec ==above the prompt== and ticks off steps and tasks beside the transcript. Press Enter on a step to read its document, or `o` to open it in your editor.
<!-- area: assistants; pr: 832, 852, 866; media: mod-run, mod-document -->

#### The Copilot app board works with any Spec Kit project
The board reads each step from your files, so it follows a stock Spec Kit run ==without Companion installed==. Its buttons send the command your project registers, and each step shows as running until the chat turn ends.
<!-- area: copilot-app; pr: 854, 869; media: copilot-board, copilot-next-step -->

#### A bug reads as a story, and a decided idea as a decision
A bug opens on a Story tab: ==where it stands==, then what broke, what changed and how it was verified. A decided idea shows its verdict, the rationale, a scorecard and a closing section that fits the verdict.
<!-- area: spec-viewer; pr: 847; media: bug-story, bug-story-failed, idea-decision -->

#### Bugs and ideas have their own panes, and start without a command
The sidebar gains a Bugs pane and an Ideas pane under Specs, grouped by ==where each stands==. Press **+** to describe a new one and send it to your assistant, then follow the next-step button on its page.
<!-- area: sidebar; pr: 842, 843; media: bugs-ideas-panes, new-bug -->

#### Answer an open question from the report
Every open question on a bug report or idea stage has an **Answer** button. Type your reply and the report ==comes back settled==: your assistant reruns the command that wrote it with your answer.
<!-- area: spec-viewer; pr: 850; media: answer-question -->

#### Run Converge from Companion
A spec whose build is done has a ==**Converge** button== in the viewer footer and on its sidebar row menu. It sends Spec Kit's `/speckit.converge` for that spec and leaves the timing to Spec Kit's own hooks.
<!-- area: spec-viewer; pr: 845; media: converge-button, converge-sent -->

#### Create GitHub issues from the task list
**Other actions** on the Tasks tab gains **Create GitHub issues**: ==one issue per task==, sent as Spec Kit's `/speckit.taskstoissues`. Companion asks first since the issues are real, and it needs a GitHub remote and the GitHub MCP server.
<!-- area: spec-viewer; pr: 844; media: create-issues-menu, create-issues-confirm -->

### Security
- **A crafted spec cannot inject markup attributes.** A link written across an image stays ==inert==, and a code fence keeps only its language name. ([#874](https://github.com/alfredoperez/speckit-companion/pull/874)) <!-- area: spec-viewer -->

### Added
- **The Copilot board helps you install Companion.** In a project without Companion, **Install it** shows the command to copy and **Ask Copilot to install it** ==runs it for you==. ([#854](https://github.com/alfredoperez/speckit-companion/pull/854)) <!-- area: copilot-app -->
- **Read a step's document inside Claude Code.** Press a step to read its spec, plan or tasks, a new ==Overview tab== sums up the run, and `/speckit-tracker` joins `/spec`. ([#852](https://github.com/alfredoperez/speckit-companion/pull/852)) <!-- area: assistants -->
- **Oh My Pi is a provider.** Set `speckit.aiProvider` to `omp` and spec commands ==run in an `omp` terminal==; the Steering view lists its agents, skills and hooks. ([#819](https://github.com/alfredoperez/speckit-companion/pull/819)) <!-- area: assistants -->

- **See which assistant has a spec.** Its sidebar row and viewer header name the assistant, and **Show Terminal** ==jumps to its terminal== while it is open. ([#839](https://github.com/alfredoperez/speckit-companion/pull/839)) <!-- area: assistants -->
- **Multi-root workspaces find the Spec Kit folder.** Companion picks ==your Spec Kit folder==, not always the first one, or the one you name in `speckit.projectFolder`. ([#840](https://github.com/alfredoperez/speckit-companion/pull/840)) <!-- area: sidebar -->

### Changed
- **The Copilot app board sends a short message.** The chat gets the command and ==one sentence==; the full run instructions wait in a file under `.speckit-companion/prompts/`, out of git. ([#854](https://github.com/alfredoperez/speckit-companion/pull/854)) <!-- area: copilot-app -->
- **A report's facts read as one line.** Assessment, Fix, Test and idea stage tabs open with ==one quiet line== instead of a bullet list of fields. ([#850](https://github.com/alfredoperez/speckit-companion/pull/850)) <!-- area: spec-viewer -->
- **The moss mascot is the new logo.** The ==small moss character== replaces the seedling in the activity bar and the double chevron on the Copilot app board. ([#831](https://github.com/alfredoperez/speckit-companion/pull/831)) <!-- area: other -->

### Fixed
- **Stock runs get no Companion-only instructions.** The board sends ==the command alone== where Companion's script is missing, so nothing tells the agent to hold a document back. ([#869](https://github.com/alfredoperez/speckit-companion/pull/869)) <!-- area: copilot-app -->
- **The board sends the command your project registers.** A project whose commands are skills gets `/speckit-plan`, and the card and **Show prompt** show ==that spelling==. ([#869](https://github.com/alfredoperez/speckit-companion/pull/869)) <!-- area: copilot-app -->
- **A sent step shows as running.** It stays ==Running== until the chat turn ends, and a stock run's Overview times only the steps the board watched. ([#869](https://github.com/alfredoperez/speckit-companion/pull/869)) <!-- area: copilot-app -->
- **Other actions keeps its text inside the menu.** Each item's description ==wraps to fit== instead of running off the window. ([#858](https://github.com/alfredoperez/speckit-companion/pull/858)) <!-- area: spec-viewer -->
- **The Copilot board shows your first spec.** In a project with no `specs/` folder, the first spec shows up ==without a refresh==. ([#854](https://github.com/alfredoperez/speckit-companion/pull/854)) <!-- area: copilot-app -->
- **No blank band above a short document.** In a narrow viewer, a short document starts right ==under the outline box==, not halfway down the page. ([#850](https://github.com/alfredoperez/speckit-companion/pull/850)) <!-- area: spec-viewer -->
- **Wrapped paragraphs stay whole.** A paragraph split across lines in the file is ==one paragraph, one comment button==. ([#846](https://github.com/alfredoperez/speckit-companion/pull/846)) <!-- area: spec-viewer -->
- **Inline code renders in highlighted lines.** Purpose, Note and Checkpoint lines show code as code, ==not raw backticks==. ([#841](https://github.com/alfredoperez/speckit-companion/pull/841)) <!-- area: spec-viewer -->
- **The sent prompt stays out of the way.** On the Copilot board, sending a step shows a ==short note that fades==, with the full prompt behind **Show prompt** and **Copy**. ([#827](https://github.com/alfredoperez/speckit-companion/pull/827)) <!-- area: copilot-app -->
- **New spec on the Copilot board numbers itself.** The message names the next number, ==one past the highest== spec folder, so numbers are never reused. ([#837](https://github.com/alfredoperez/speckit-companion/pull/837)) <!-- area: copilot-app -->
- **The Copilot agent answers from the board.** Ask about specs and it uses the board's list and focus actions, and ==moves the board== whenever you name a spec. ([#837](https://github.com/alfredoperez/speckit-companion/pull/837)) <!-- area: copilot-app -->

Older releases are archived in [`apps/website/src/data/changelog-archive.md`](apps/website/src/data/changelog-archive.md), and the full history reads at [speckit-companion.dev/changelog](https://speckit-companion.dev/changelog).
