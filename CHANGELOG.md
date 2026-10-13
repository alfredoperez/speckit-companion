# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Plan blocks draw as cards.** A plan's `screen`, `states` and `calls` blocks and annotated code draw ==as cards you can click== and comment on. ([#898](https://github.com/alfredoperez/speckit-companion/pull/898), [#904](https://github.com/alfredoperez/speckit-companion/pull/904), [#905](https://github.com/alfredoperez/speckit-companion/pull/905)) <!-- area: spec-viewer -->
- **Hover a spec to see its branch.** The sidebar tooltip names ==the branch the work is on==, beside the status and the assistant. ([#895](https://github.com/alfredoperez/speckit-companion/pull/895)) <!-- area: sidebar -->
- **The Workflow Builder opens on stock Spec Kit.** It draws your project's own workflow and edits ==what Spec Kit owns==: extension hooks, document templates and the constitution command. ([#889](https://github.com/alfredoperez/speckit-companion/pull/889)) <!-- area: pipeline-builder -->
- **Change where a decision routes.** The board's decision block opens one row per answer, so a verdict ==skips the steps you choose==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: pipeline-builder -->
- **Living specs reach the Workflow Builder.** A header chip turns them on or off, picks where specs live, and lists ==the capabilities you registered==. ([#888](https://github.com/alfredoperez/speckit-companion/pull/888)) <!-- area: pipeline-builder -->

### Changed

- **An old Companion preset is removed for you.** A project still carrying the retired wrapper is ==cleaned up on the next start==, and its Templates group leaves the Steering view. ([#906](https://github.com/alfredoperez/speckit-companion/pull/906)) <!-- area: pipeline -->
- **The Pipeline Builder is renamed Workflow Builder.** The board that draws your Companion pipeline has a ==new name== in the command, the tab and the docs. ([#883](https://github.com/alfredoperez/speckit-companion/pull/883)) <!-- area: pipeline-builder -->

### Fixed

- **The Run log reads cleanly.** Each task line in the Overview's Run log has ==space between its parts== and a badge for who recorded it. ([#912](https://github.com/alfredoperez/speckit-companion/pull/912)) <!-- area: overview -->
- **Plan cards work on the Copilot board.** A `states` block is drawn as a diagram where ==a click shows that state==, and the buttons that did nothing are gone. ([#911](https://github.com/alfredoperez/speckit-companion/pull/911)) <!-- area: copilot-app -->
- **A file link opens its own file.** A path in a spec opens ==the file it names== at its line, not a same-named file elsewhere. ([#897](https://github.com/alfredoperez/speckit-companion/pull/897)) <!-- area: spec-viewer -->
- **Task counts and line actions line up.** The header and the Tasks tab ==count the same tasks==, and a comment or edit lands on the line you clicked. ([#882](https://github.com/alfredoperez/speckit-companion/pull/882)) <!-- area: spec-viewer -->
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

## [0.35.0] - 2026-10-03

Rearrange your pipeline from the Pipeline Builder, read step times you can trust, and stop losing commands to a shell that is still starting.

### Highlights

#### Move a node to another phase
A free node's panel now has Move to phase… beside Move up and Move down. It lists the phases the node is not in and puts it at the edge of the one you pick, nearest where it was, so you no longer have to drag it or remove and re-add it. Docked in a side panel, the Pipeline Builder now stacks its steps one under the next at the panel's width instead of clipping them behind a sideways scroll.
<!-- area: pipeline-builder; pr: 797; media: move-to-phase, side-panel -->

#### Drag a hook to move it
Drop one of your hooks before or after another node, on a phase, or above or below another hook, and the new order is written to `companion.yml` in one step, keeping the rest of the file as you wrote it. From the keyboard, the hook's form has Move up and Move down. Hooks from an installed extension, and a move to somewhere the step has no place for, are refused with the reason.
<!-- area: pipeline-builder; pr: 818; media: move-hook -->

#### Step times you can trust
A step's time on the Overview now stops when that step finishes: a spec specified in 22 seconds used to read "Specify 35m 56s" once Plan was clicked half an hour later. The wait between steps counts toward no step and not toward the run's total, which now reads as active time, and a step you start from the viewer and the assistant finishes now shows its time too. The Copilot board times steps with the same rule, so both read Specify 22s.
<!-- area: run-record; pr: 804; media: run-overview -->

#### Commands wait for the shell
A shell that asked something at startup, such as oh-my-zsh's "Would you like to update?", took the first letter of a step's command as its answer, so `claude` ran as `laude` and the step sat on "Step running" forever. Every command now waits until the shell is at its prompt, however long you take to answer, and a notice saying the terminal is waiting has a Run button to send it yourself. A step whose command exits with an error before it records anything goes back to where it was and tells you which terminal to look at.
<!-- area: assistants; pr: 808, 810 -->

#### The viewer shows Spec Kit's converge step
When you run `/speckit.converge` after implement, the Tasks entry in the viewer's rail shows it running, with its timer, and the Overview lists Converge after Implement with how long it took. Converge never changes a spec's status, so a spec that ran it still offers Mark Completed and Archive, and the viewer has no button to start it.
<!-- area: spec-viewer; pr: 813 -->

#### Bug reports show up in the sidebar
When you use Spec Kit's bug extension, the Specs view lists each bug in a Bugs group, named by its title, with the reports it has and the latest outcome, like `assess · fix · test · verified`. Click one to read its assessment, fix and test reports in the viewer. Bug reports are read-only: the viewer offers no actions on them and changes nothing on disk.
<!-- area: sidebar; pr: 815 -->

#### Links between documents work, and the viewer says what it shows
Clicking a link to another document of the spec opens it and scrolls to the heading the link names, a link to another spec opens that spec in the viewer, and a source file opens in the one group beside the viewer instead of adding a group on every click. When the document you are reading is moved or deleted, a line now says so until you navigate, instead of the viewer jumping to the Specification without a word.
<!-- area: spec-viewer; pr: 796, 802, 800; media: removed-doc -->

### Added
- **SpecKit Companion suggests the assistant your project was set up for.** Spec Kit records which assistant a project was set up for. When that is not the assistant your AI provider setting names, SpecKit Companion now says so when it starts and offers to switch, or to keep your current one. It never switches on its own, and once you keep your choice it does not ask again for that project. A project set up for an assistant SpecKit Companion has no provider for shows nothing. ([#799](https://github.com/alfredoperez/speckit-companion/pull/799)) <!-- area: assistants -->

### Fixed
- **Move to phase… works in a narrow Pipeline Builder.** In a side panel the node's panel now scrolls, so the button is always reachable, and its list opens inside the panel on the side with room, showing every phase instead of being cut off at the edge. ([#805](https://github.com/alfredoperez/speckit-companion/pull/805)) <!-- area: pipeline-builder -->
- **Move to phase… opens in the right place with reduced motion on.** With the system's reduce-motion setting turned on, the list of phases opened far from its button, off the top of the panel; it now opens right under it. ([#806](https://github.com/alfredoperez/speckit-companion/pull/806)) <!-- area: pipeline-builder -->
- **A fresh project no longer warns the Pipeline Builder is out of date.** The header said the configuration changed since the last build before anything had been configured. ([#800](https://github.com/alfredoperez/speckit-companion/pull/800)) <!-- area: pipeline-builder -->
- **The Copilot board no longer turns a Spec Kit spec into a Companion one.** Its run buttons sent Companion commands to every spec once the extension was installed, which flipped a stock spec's workflow; a spec recorded as Spec Kit now runs the standard commands. ([#800](https://github.com/alfredoperez/speckit-companion/pull/800)) <!-- area: copilot-app -->
- **A fresh checkout no longer says Tasks may be stale.** Files written together, as when a spec is cloned or copied, are treated as one generation, so the stale banner only appears once a document is edited more than a second after the one below it. ([#800](https://github.com/alfredoperez/speckit-companion/pull/800)) <!-- area: spec-viewer -->
- **A spec with nothing recorded no longer has a tab titled Overview.** The tab now names the document the pane is showing, and switches to Overview once the run has recorded something. ([#796](https://github.com/alfredoperez/speckit-companion/pull/796)) <!-- area: spec-viewer -->
- **No more empty Intent heading on the Overview.** A spec that recorded phase times but no intent showed an Intent title with nothing under it; now only the run overview shows. ([#800](https://github.com/alfredoperez/speckit-companion/pull/800)) <!-- area: overview -->
- **Review comments alone no longer give a spec an Overview.** A spec whose run recorded nothing, but which still had a status and a review comment, opened on an Overview holding only an empty run log under a tab titled Overview. It now opens on its document, and the tab says which from the first paint. ([#802](https://github.com/alfredoperez/speckit-companion/pull/802)) <!-- area: overview -->
- **Phase-complete notifications name the spec on Windows.** The toast read "completed in unknown" instead of the feature folder, because Windows paths use backslashes. ([#792](https://github.com/alfredoperez/speckit-companion/pull/792)) <!-- area: run-record -->
- **A pulled spec-kit extension release no longer leaves you out of date.** If a release was published and then retracted, every project kept being told its spec-kit commands were behind a version that no longer exists and could not be installed. The daily update check now confirms the newest version it remembers is still a published release, and drops it when it is not. A release that has only scrolled off the releases page, or a check that cannot reach GitHub, leaves the remembered version alone. ([#793](https://github.com/alfredoperez/speckit-companion/pull/793)) <!-- area: install -->
- **Upgrade Project and Upgrade All use Spec Kit's current init flag.** They still passed the agent with `--ai`, which newer Spec Kit no longer accepts, so the upgrade failed in the terminal. They now use `--integration`, and Upgrade Project falls back to `--ai` for an older Spec Kit that only knows the old flag. ([#794](https://github.com/alfredoperez/speckit-companion/pull/794)) <!-- area: install -->
- **Initialize Workspace sets up the assistant you already chose.** It used to start Spec Kit's own picker, so the project could end up set up for a different assistant than your AI provider setting. It now names your assistant, with the flag your Spec Kit version understands. IDE Chat on Windsurf, which current Spec Kit no longer lists, gets Spec Kit's picker instead of a command that fails. ([#812](https://github.com/alfredoperez/speckit-companion/pull/812)) <!-- area: install -->

Older releases (0.34.0 and earlier) are archived in [`apps/website/src/data/changelog-archive.md`](apps/website/src/data/changelog-archive.md), and the full history reads at [speckit-companion.dev/changelog](https://speckit-companion.dev/changelog).
