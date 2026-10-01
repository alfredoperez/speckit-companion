# Feature Specification: A diagram of the specs workflow, for the site

**Feature Branch**: `docs/699-workflow-diagram`
**Created**: 2026-10-01
**Status**: Draft
**Input**: Issue #699, "An HTML diagram of the specs workflow, for the site"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the whole run on one picture (Priority: P1)

A developer reading the docs wants to know what happens between typing a feature request and getting code. They open the Introduction and see one diagram: the five steps left to right (specify, plan, tasks, implement, complete), what each step leaves on disk, the living specs read before the work and written back after it, and the workers each step sends out. Every label is real text they can read, select and search.

**Why this priority**: it is the map every other docs page and screenshot hangs on. Without it the reader assembles the pipeline from four pages.

**Independent Test**: open the Introduction on the built site and read the diagram alone; a reader can name the five steps, the artifact each leaves, where living specs are read and where they are written.

**Acceptance Scenarios**:

1. **Given** the built site, **When** a reader opens the Introduction page, **Then** the diagram shows specify, plan, tasks, implement and complete in that order, each with the document it produces.
2. **Given** the diagram, **When** a reader looks above the pipeline, **Then** they see the living-spec loop: the resolver narrowing the registered specs to the requirements the change touches on the way in, and the fold writing the run's deltas back at completion on the way out.
3. **Given** the diagram, **When** a reader looks below implement, **Then** they see the shared groundwork built in waves, one worker per large user story, small stories built inline, and the join where results are checked and merged.

---

### User Story 2 - Read it on a phone (Priority: P1)

A developer opens the same page on a phone. The diagram stacks top to bottom in the same reading order, nothing scrolls sideways, and the text stays readable.

**Why this priority**: the docs are read on phones, and a diagram that overflows is unreadable there.

**Independent Test**: render the page at 390px wide; the page has no horizontal scroll and every label is legible.

**Acceptance Scenarios**:

1. **Given** a 390px-wide viewport, **When** the page renders, **Then** the page width does not exceed the viewport and the steps read top to bottom in pipeline order.
2. **Given** a screen reader, **When** it reads the diagram, **Then** it hears the steps, the living-spec loop and the fan-out as ordered text, with no meaning carried by arrows alone.

---

### User Story 3 - Know what changed recently (Priority: P2)

A reader who knows Spec Kit wonders where its converge pass fits and why the run's total time looks shorter than the wall clock. The diagram shows converge as an optional pass after implement and notes that the run total counts only each step's own working time.

**Why this priority**: both shipped or are shipping now, and a map that omits them is out of date on day one.

**Independent Test**: read the implement column and the timing note; converge is visibly optional and not a separate status, and the note explains active time.

**Acceptance Scenarios**:

1. **Given** the diagram, **When** a reader looks after implement, **Then** converge appears as an optional pass that checks the code against the spec, plan and tasks and either adds tasks or reports converged, and completion does not wait on it.
2. **Given** the diagram, **When** a reader looks for timing, **Then** one line says each step is timed from its own start to its own finish and the waits between steps count toward nothing.

---

### User Story 4 - Find it from the pages that explain the parts (Priority: P3)

A reader on the living specs page or the pipeline page wants the whole picture. Those pages show the same diagram, or link to it, next to the text that explains one part of it.

**Why this priority**: the diagram is most useful where the reader is already asking how the pieces connect.

**Independent Test**: from Pick a pipeline and Living specs, the reader reaches the diagram in one click or sees it on the page.

**Acceptance Scenarios**:

1. **Given** the Living specs and Pick a pipeline pages, **When** a reader opens either, **Then** the diagram is shown there or linked from the text that explains the run.

### Edge Cases

- A simple change: specify writes a lean plan and task list itself and the run goes straight to implement. The diagram says so in one line rather than drawing a second pipeline.
- A project with living specs off: nothing is loaded or folded. The diagram marks the loop as opt-in.
- A host with no way to start workers: each step does the workers' jobs itself and writes the same files. The diagram marks workers as the default, not a requirement.
- A story that owns fewer than five files: it is built inline, not by a worker.
- Converge never run: the spec still completes; converge carries no status of its own.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST show one diagram of the Companion run with the five steps specify, plan, tasks, implement and complete, left to right on wide screens, each naming what it produces.
- **FR-002**: The diagram MUST show the living-spec loop above the steps: registered specs narrowed to the requirements the change touches, loaded at specify and reused by plan, a slice handed to each implement worker, and the run's deltas reviewed and folded back at completion.
- **FR-003**: The diagram MUST show where workers attach: one read-only reader per code area at specify and plan (at most four at once), one writer per design document at plan, and below implement the groundwork waves, one worker per user story owning five or more files, smaller stories built inline, and the join that checks worker claims and merges results one at a time.
- **FR-004**: The diagram MUST show converge as an optional pass after implement that checks the code against the spec, plan and tasks and either appends tasks or reports converged, with no status of its own and not required for completion.
- **FR-005**: The diagram MUST carry one line explaining that the run's total counts active time: each step from its own start to its own finish, with waits between steps excluded.
- **FR-006**: Every word in the diagram MUST be real text, not text inside an image.
- **FR-007**: The diagram MUST use the site's own colour, type and spacing tokens and read correctly on the site's dark theme.
- **FR-008**: At 390px wide the diagram MUST stack vertically in pipeline order with no horizontal scroll on the page.
- **FR-009**: The diagram's reading order MUST make sense as text alone, for screen readers and with styles off.
- **FR-010**: The diagram MUST appear on the Introduction page and be shown or linked from the Pick a pipeline and Living specs pages.
- **FR-011**: The diagram MUST claim nothing the living specs under `capabilities/companion-pipeline/`, `capabilities/living-specs-engine/` and `capabilities/run-record/` do not state, plus the converge behaviour named in FR-004.

### Key Entities

- **Step**: one of specify, plan, tasks, implement, complete; has a name, the document it leaves, and the workers it may send.
- **Worker**: a helper a step hands one piece of work to; has a job (read an area, write a document, build a story or a groundwork wave) and returns findings, never file contents.
- **Living spec**: a lasting spec for one capability; read narrowed at the start of a run and updated by the fold at its end.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The site builds with the diagram on three docs pages and no build errors.
- **SC-002**: At 390px wide the rendered Introduction page has a document width equal to the viewport (zero horizontal overflow).
- **SC-003**: A reader can answer, from the diagram alone, which step loads living specs, which step writes them back, and where per-story workers run.
- **SC-004**: Every claim in the diagram traces to a requirement in the named living specs or to the converge change.

## Assumptions

- "An HTML page in `docs/`" in the issue is met by a reusable site component of real HTML and CSS, embedded in the site's docs pages. The root `docs/` folder is reference-only and is not rendered by the site, and a README cannot embed live HTML, so README embedding is out of scope.
- Converge is drawn from the open converge change (#813). If that change shifts before merge, the converge box is the one place to update.
- The site is dark only, so there is no light variant to support.
- No living spec registers the website pages, so no capability spec is edited by this change.

## Approach

- **Where it lives**: a site component, `apps/website/src/components/docs/WorkflowDiagram.astro`, the same pattern as `MediaSlot` and `GuidedStep`. Real HTML (ordered lists and headings) styled with the tokens in `apps/website/src/styles/tokens.css`, so it renders in the site's dark theme with no image and no script. A standalone page in the root `docs/` would not render on the site, and a README cannot embed live HTML.
- **Layout**: three bands in one figure. The living-spec loop on top (load going in, fold coming out), specify, plan, tasks and implement as an ordered list in the middle with Completed as implement's outcome in the fifth column, and the implement fan-out below (groundwork waves, per-story workers, the join). Converge is a dashed optional box outside the run, and notes on active time, small changes and inline work sit under the figure. The source order is the run's order (steps, inside implement, completed, converge), and a CSS grid places Completed beside Implement once the figure is 600px wide; below that it is one column.
- **Embeds**: on the Introduction (`apps/website/src/content/docs/docs/index.mdx`) as a new "One run, start to finish" section, and on Living specs (`apps/website/src/content/docs/docs/discussions/living-specs.mdx`) above "How a run folds back". Pick a pipeline (`apps/website/src/content/docs/docs/discussions/pick-a-pipeline.mdx`) links to the Introduction section from "The two that ship".
- **Wording source**: every label paraphrases a requirement in `capabilities/companion-pipeline/run-a-spec-through-the-pipeline.spec.md`, `capabilities/companion-pipeline/split-work-across-workers.spec.md`, `capabilities/living-specs-engine/load-specs-for-a-change.spec.md`, `capabilities/living-specs-engine/fold-a-finished-change-back.spec.md` and `capabilities/run-record/record-a-run.spec.md`; converge follows PR #813.
- No dependency added. No changelog entry: the site belongs to neither product.
