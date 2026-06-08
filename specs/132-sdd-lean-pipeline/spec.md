# Feature Specification: Pipeline + the sdd-lean Preset

> **Note (design evolved):** this spec captures the first cut (one `sdd-lean` preset + a boolean toggle). The shipped design supersedes it: two profiles (`companion-standard` / `companion-lean`) selected by `speckit.companion.templateProfile` (+ a per-spec override), shape carried by command bodies (not templates), and timing baked into every command. The **canonical, living reference is [`docs/template-profiles.md`](../../docs/template-profiles.md)**; the visual brief is `2026-06-08-companion-template-profiles.html`. The sections below are kept as the original record.

**Feature Branch**: `132-sdd-lean-pipeline`
**Created**: 2026-06-08
**Status**: Superseded by `docs/template-profiles.md`
**Input**: User description: "Step 04 — Pipeline + the sdd-lean Preset: namespaced /speckit.companion.* pipeline commands plus a selectable preset that reshapes core templates to the SDD-lean (files/deps, no user-stories) shape."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stock commands produce the SDD-lean shape automatically (Priority: P1)

A developer working in a SpecKit Companion-managed project runs the ordinary `/speckit.specify`, `/speckit.plan`, and `/speckit.tasks` commands. Because the `sdd-lean` preset is active by default, the documents they get back already use the SDD-lean shape — specs carry no user-story section, plans are lean, and tasks are organized along a files/dependencies axis — without the developer editing any template or learning a new command.

**Why this priority**: This is the lightest-touch, highest-leverage outcome. It changes the default writing experience for every spec in a managed project, which is the core value of the step. It is the one mechanism that works even for developers who never learn the namespaced commands exist.

**Independent Test**: In a fresh Companion-managed project with default settings, run stock `/speckit.specify` against a sample feature description and confirm the produced `spec.md` contains no user-story section and follows the SDD-lean structure. Delivers value on its own even if no other story ships.

**Acceptance Scenarios**:

1. **Given** a Companion-managed project with `sdd-lean` active by default, **When** the developer runs stock `/speckit.specify`, **Then** the resulting spec contains no user-story section and uses the SDD-lean spec structure.
2. **Given** the same project, **When** the developer runs stock `/speckit.plan` and `/speckit.tasks`, **Then** the plan is in the lean form and the tasks are organized by files/dependencies rather than grouped under user stories.

---

### User Story 2 - Explicit opt-in pipeline via namespaced commands (Priority: P2)

A developer wants the SDD-lean shape on demand, regardless of which preset a given project happens to have selected. They run `/speckit.companion.specify`, `/speckit.companion.plan`, `/speckit.companion.tasks`, and `/speckit.companion.implement`. Each command produces the SDD-lean shape directly, so the developer gets a predictable result without first inspecting or changing project-level preset configuration.

**Why this priority**: This is the explicit, discoverable opt-in path. It guarantees the SDD-lean shape is reachable even in projects where the preset is off or where another preset is selected, and it gives the methodology a named home in the command palette. It depends on the SDD-lean shape definition that Story 1 establishes.

**Independent Test**: In a project where the `sdd-lean` preset is NOT active, run `/speckit.companion.specify` and confirm the output still has the SDD-lean shape, matching the structure that the preset path produces.

**Acceptance Scenarios**:

1. **Given** a project where the `sdd-lean` preset is disabled, **When** the developer runs `/speckit.companion.specify`, **Then** the produced spec still has the SDD-lean shape (no user-story section).
2. **Given** any project, **When** the developer runs the namespaced command for a pipeline stage, **Then** its output shape is identical to what the preset-driven stock command would have produced for that stage.

---

### User Story 3 - Select, opt out, and compose the preset (Priority: P3)

A developer manages which shape their project uses. They can select the preset explicitly (`specify preset use sdd-lean`), turn it off when they want stock spec-kit templates, and combine it with other presets without an undefined outcome. Configuration is exposed both at the project level (`.specify/sdd.config.yml`) and through a VS Code setting, each defaulting to on for Companion-managed projects.

**Why this priority**: Selection, opt-out, and composition make the feature safe to ship on-by-default. Without them, a default-on preset would be a trap for teams that want stock spec-kit. This is important but secondary to the two shape-producing paths above.

**Independent Test**: Toggle the feature off via configuration, run stock `/speckit.specify`, and confirm the stock spec-kit template (with user stories) is produced again; then re-enable and confirm the SDD-lean shape returns.

**Acceptance Scenarios**:

1. **Given** a project, **When** the developer runs the preset-selection action for `sdd-lean`, **Then** subsequent stock pipeline commands produce the SDD-lean shape.
2. **Given** a project with `sdd-lean` active, **When** the developer disables the feature via `.specify/sdd.config.yml` or the VS Code setting, **Then** subsequent stock pipeline commands fall back to the stock spec-kit templates.
3. **Given** a project that selects `sdd-lean` alongside another preset, **When** both override overlapping template areas, **Then** the resolved template is deterministic and the precedence is documented.

---

### Edge Cases

- A second selected preset overrides the same template region as `sdd-lean`: precedence MUST be deterministic and documented, not order-of-discovery dependent.
- The project is not Companion-managed: the default is off, so stock spec-kit templates are used unless the developer opts in.
- The feature is disabled mid-project after some specs were already produced in the SDD-lean shape: already-written documents are left untouched; only subsequent command runs change shape.
- A namespaced `/speckit.companion.*` command is run in a project whose preset is off: the command still emits the SDD-lean shape (it does not depend on preset state).
- The project-level config and the VS Code setting disagree: a single, documented source of truth determines the effective state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the `sdd-lean` preset is active, the core specify/plan/tasks pipeline MUST produce the SDD-lean shape — a spec with no user-story section, a lean plan, and tasks organized by files/dependencies rather than grouped under user stories.
- **FR-002**: The system MUST let a developer select the `sdd-lean` preset for a project via a single selection action (`specify preset use sdd-lean`).
- **FR-003**: The `sdd-lean` preset's template overrides MUST take precedence over extension-supplied templates and MUST compose with other selected presets using a deterministic, documented precedence order.
- **FR-004**: The system MUST provide four namespaced pipeline commands — `/speckit.companion.specify`, `/speckit.companion.plan`, `/speckit.companion.tasks`, `/speckit.companion.implement` — each of which produces the SDD-lean shape directly, independent of which preset (if any) is active.
- **FR-005**: A namespaced command's output shape for a given pipeline stage MUST match the shape the preset-driven stock command produces for that same stage.
- **FR-006**: The SDD-lean shape MUST be enabled by default for Companion-managed projects (opt-out), controlled by `features.sddLean` in `.specify/sdd.config.yml` (default true) and a `speckit.features.sddLean` VS Code setting (default true).
- **FR-007**: When the SDD-lean feature is disabled, the core pipeline commands MUST fall back to the stock spec-kit templates (including the user-story section).
- **FR-008**: The Companion's own install scaffolding MUST default to selecting the `sdd-lean` preset for projects it creates or manages.
- **FR-009**: The feature MUST document how `sdd-lean` composes with other presets, including which side wins on overlapping overrides.
- **FR-010**: The effective on/off state MUST be resolvable from a single documented source of truth when both the project config and the VS Code setting are present.

### Out of Scope

- Complexity branching inside the pipeline commands (deferred to step 5 — that is command behavior, not template shape).
- Living specs and drift detection (step 6).
- Auto mode (step 7).
- Redefining the SDD-lean shape itself — this feature ports the existing SDD methodology shape; it does not invent a new document structure.

### Key Entities *(include if feature involves data)*

- **sdd-lean preset**: A named, selectable bundle of template overrides that reshapes the core spec/plan/tasks output into the SDD-lean shape. Has precedence above extension templates and composes with other presets.
- **SDD-lean shape**: The target document structure — a spec with no user-story section, a lean plan, and a files/dependencies task axis. Defined by the existing SDD methodology; this feature reproduces it.
- **Namespaced pipeline commands**: The four `/speckit.companion.*` commands that emit the SDD-lean shape directly as an explicit opt-in path.
- **Feature toggle**: The paired configuration surfaces — `features.sddLean` (`.specify/sdd.config.yml`) and the `speckit.features.sddLean` VS Code setting — that enable or disable the SDD-lean shape, default-on for Companion-managed projects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a Companion-managed project with default settings, 100% of specs produced by stock `/speckit.specify` contain zero user-story sections.
- **SC-002**: A developer can switch a project to (or away from) the SDD-lean shape with a single selection or toggle action — no manual template editing.
- **SC-003**: For each of the four pipeline stages, the document shape produced by the namespaced `/speckit.companion.*` command matches the shape produced by the preset-driven stock command, verified by comparing section structure.
- **SC-004**: Disabling the feature restores stock spec-kit output (user-story section present) on the next command run, with no residual SDD-lean sections.
- **SC-005**: When `sdd-lean` is composed with another preset, repeated runs over the same inputs produce identical resolved templates (deterministic composition).

## Assumptions

- The "SDD-lean shape" (no user stories, lean plan, files/dependencies task axis) is already defined by the existing SDD methodology; this feature reproduces that shape inside spec-kit rather than redefining it.
- The four namespaced commands are thin wrappers over the same `sdd-lean` templates the preset installs, which is why their output shape matches the preset path (FR-005). This satisfies the original "Done when" (both the preset path and the opt-in path are available) with minimal added surface.
- A preset composition mechanism with a defined precedence order exists (per ADR 0003 #7); this feature uses it rather than building composition from scratch.
- "Companion-managed project" means a project initialized or managed through the SpecKit Companion install scaffolding.
- Selecting the preset affects only subsequent command runs; it does not rewrite documents already on disk.
