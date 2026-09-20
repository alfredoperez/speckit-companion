# Customize the pipeline: Living Spec

## Purpose

A team attaches its own work to the Companion commands, reorders or replaces their sections, or swaps the whole configuration, without forking a command. It all lives in `.specify/companion.yml` and `.specify/companion/`, so an upgrade of the extension never loses it.

## Requirements

### With no configuration every command runs as shipped
<!-- touches: apps/speckit-extension/presets/_parts/orchestrator.md, apps/speckit-extension/scripts/companion_config.py -->

`.specify/companion.yml` SHALL hold deltas only: it changes the commands it names and nothing else, and an absent or empty file means the shipped pipeline with no warning. A file that cannot be read in full SHALL contribute nothing, with one warning naming the line at fault, never the part that happened to parse.

#### Scenario: the file is malformed
- **WHEN** `companion.yml` uses tab indentation or an anchor the reader does not accept
- **THEN** the run uses the shipped commands unchanged and prints one warning

### A hook runs before or after a step, a phase or a node
<!-- touches: apps/speckit-extension/presets/_parts/orchestrator.md, apps/speckit-extension/scripts/hook_render.py, apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/nodes/*/_order.yml -->

Under `commands.<step>.hooks` a project SHALL be able to anchor work `before` or `after` a named node, a named phase, or the step itself. Several hooks at one anchor run top to bottom in declared order. A name that matches more than one of those resolves once, as the step first, then a node, then a phase. An anchor naming something the step does not run gets one warning and is skipped.

#### Scenario: tests before the handoff
- **WHEN** implement has a `before: handoff` hook running `npm test`
- **THEN** the command runs after the last task and before the step hands off

#### Scenario: the anchored node was dropped
- **WHEN** a hook is anchored to `constitution-check` and the project's recipe removed that node
- **THEN** the run warns once, skips that hook, and continues

### A hook is a command, an instruction, a node file or a skill
<!-- touches: apps/speckit-extension/presets/_parts/orchestrator.md, apps/speckit-extension/scripts/hook_render.py -->

A hook SHALL be one of: `command` (a shell line), `prompt` (an inline instruction), `node` (a project file under `.specify/companion/nodes/`), or `skill` (a named skill the assistant loads). `background: true` starts the hook without holding the run, and is not for anything that writes the run record. A failing hook is reported and the step continues, except a `node` hook whose file is missing, which is an error.

#### Scenario: the host has no terminal
- **WHEN** a `command` hook runs on a chat-only provider
- **THEN** the assistant reports the command it would have run and continues

#### Scenario: a slow end-to-end suite
- **WHEN** a hook carries `background: true`
- **THEN** the pipeline moves on at once and the result is reported when it lands

### A validation hook takes over the final suite run
<!-- touches: apps/speckit-extension/nodes/tasks/tasks-doc.md -->

When a hook after implement's task execution carries `owns: validation`, the tasks step SHALL write a deferring task instead of the Polish phase's test-and-lint task, so the suites run in exactly one place. Any other hook at that anchor changes nothing.

#### Scenario: a review hook shares the anchor
- **WHEN** the only hook after `implement-exec` is a PR review with no `owns: validation` marker
- **THEN** the Polish phase still generates the suite-run task

### A recipe decides which nodes a step runs and how they group
<!-- touches: apps/speckit-extension/nodes/*/_order.yml, apps/speckit-extension/scripts/companion_config.py, apps/speckit-extension/scripts/assemble_nodes.py, apps/speckit-extension/nodes/** -->

`commands.<step>.nodes` SHALL replace a step's node order, so a project can drop a node, add a shipped optional one (a gap review of the task list, a hand-verification stop, an independent requirements check, a spec-as-delta or fix-contract draft, a blocking checklist, a branch per spec), or name a node it wrote. `commands.<step>.phases` replaces the grouping whole, and a phase name becomes a hook anchor. A recipe is refused when it drops a node a kept node depends on, names a node that does not exist, puts a node before one it depends on, or leaves a node in two phases or none.

#### Scenario: dropping a node something reads
- **WHEN** a plan recipe removes `plan-doc` and keeps `side-files`
- **THEN** loading fails and names the broken dependency

#### Scenario: adding the hand-verification stop
- **WHEN** an implement recipe adds `verify-manually` before `complete`
- **THEN** implement writes `verify.md`, stops for a person to run it, and does not complete the spec on its own reading

### A project can replace what a node, a preamble or a document section says, or add a step of its own
<!-- touches: apps/speckit-extension/scripts/_command_parts.py, apps/speckit-extension/scripts/template_render.py, apps/speckit-extension/fragments/** -->

A file at `.specify/companion/nodes/<step>/<node id>.md` SHALL be read instead of the shipped node of that id, and `_frame.md` there replaces the step's preamble. A `template.sections` entry swaps one named section of a document for a fragment. The replacement keeps the node's id and place, so hooks anchored to it still fire. Shipped sources are never written to, and deleting the file restores the shipped text. A directory under that path for a step the extension does not ship SHALL become a real step of its own, which the project says runs behind a named step or leaves as one to launch by hand. The steps are not a fixed five.

#### Scenario: the extension is upgraded
- **WHEN** a project replaced `draft-spec` and then installs a newer extension
- **THEN** the project's version still applies and the build says which nodes came from the project

#### Scenario: a review step of the project's own
- **WHEN** a project adds a `review` step and says it runs behind implement
- **THEN** it assembles into a command like any other and its run is recorded like any other step

### A project can keep several workflows and switch between them
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/workflows/presets/** -->

`workflow: <name>` in `companion.yml` SHALL select `.specify/companion/workflows/<name>.yml`, which replaces the rest of the configuration instead of merging with it. `shipped` selects nothing. A name with no file is a build error that lists the workflows that exist. Project nodes and fragments are shared across workflows. Two starting points ship: Brownfield (delta spec, gap review, hand verification) and Classic spec-kit (stock story and Technical Context sections).

#### Scenario: a misspelled workflow
- **WHEN** `workflow: bugfx` names no file
- **THEN** the build fails, lists `bugfix` and the others, and the previous pipeline stays in place

### A build applies the configuration, all or nothing
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/scripts/manifest.py -->

Recipes, phases, section swaps, verdict routing and replaced nodes SHALL take effect when the project runs the pipeline build, which writes the command bodies the assistant reads. Nothing is written until every command assembles, a failure names the line, node or section it could not resolve, and `--dry-run` shows what would change. Each build states what files a run will produce.

#### Scenario: one command cannot assemble
- **WHEN** the tasks recipe is invalid and the specify recipe is fine
- **THEN** no command body changes and the working pipeline is left as it was

## Uncovered

- Hooks are honoured twice over: the assistant reads `companion.yml` at run time, and a build also renders them into the body. What happens when the built body and the file disagree is not stated anywhere.
- `debug: true` is read only by build-time renderers, so on an installed project it does nothing. The docs say to attach a timing hook by hand instead.
- A hook is prose the assistant is asked to honour. Nothing enforces that it ran.
