# Feature Specification: Activation Funnel

**Feature Branch**: `597-activation-funnel`
**Created**: 2026-08-25
**Status**: Draft
**Input**: GitHub issue #597 — "Activation: shipped sample spec, a Create-Spec choice that sells, complete funnel, launch content" (part of epic #520)

Installs are not the bottleneck — activation is. Almost everyone who installs the extension never creates a spec, and the Companion workflow (the product's differentiator) is effectively undiscovered. This feature makes the two things users love — customization and visualization — visible and reachable within the first two minutes, and makes the activation funnel measurable end to end so the biggest leak stops being a guess.

## User Scenarios & Testing

### User Story 1 - A first-run that shows the product (Priority: P1)

A brand-new user installs the extension and opens the sidebar with zero specs in their workspace. Instead of two stacked, unrelated welcome boxes with nothing to look at, they see one coherent welcome: a single value line, a "Create your first spec" action, and an "Open a live sample" action. Choosing the sample seeds a curated example spec into their workspace and opens it in the viewer, so within the first minute they are looking at the product's actual reading surface — pipeline, phases, and progress — instead of an empty tree.

**Why this priority**: The zero-spec state is the first screen every new user sees and today it sells nothing; it is the top of the funnel where the 84k-installs-to-16 leak begins.

**Independent Test**: In a fresh workspace with no specs, open the sidebar; verify one merged welcome renders, and that "Open a live sample" produces a viewable sample spec in the viewer within a minute. Delivers value alone: a new user can experience the viewer without authoring anything.

**Acceptance Scenarios**:

1. **Given** a workspace with zero specs, **When** the user opens the specs sidebar, **Then** exactly one welcome block renders, offering a value line, "Create your first spec", and "Open a live sample" — never two stacked welcome boxes.
2. **Given** the zero-spec welcome, **When** the user clicks "Open a live sample", **Then** a copy of the bundled sample spec is seeded into the workspace and opens in the spec viewer.
3. **Given** the sample was just seeded, **When** the sidebar refreshes, **Then** the empty state clears and the sample appears as a normal spec row.
4. **Given** a sample spec already seeded in this workspace, **When** the user clicks "Open a live sample" again, **Then** the existing sample opens rather than a duplicate being created.

---

### User Story 2 - A Create Spec choice that can sell (Priority: P1)

A user opens Create Spec to describe a feature. Where today a bare dropdown lists workflow names with no way to show why one is better, they now see a workflow choice that presents each option with its value — Companion carrying its proof line ("specs 60–68% leaner, same correctness") — plus a low-commitment "Try Companion for this spec" that runs Companion once without changing their default. Users who don't have the companion piece installed keep the existing install-first flow, unchanged.

**Why this priority**: Create Spec is the highest-intent moment in the product; it already lists Companion but cannot communicate its value, so the differentiator is invisible exactly where the decision is made.

**Independent Test**: Open Create Spec and verify the choice control renders each workflow's description, Companion shows its proof line, and a one-spec "try it" path exists; verify a user without the companion piece still gets the install-first prompt and an unbroken stock path.

**Acceptance Scenarios**:

1. **Given** the Create Spec form, **When** the workflow choice renders, **Then** each workflow shows its description, and Companion shows its proof line — not a bare name-only dropdown.
2. **Given** a user whose default workflow is stock, **When** they take "Try Companion for this spec" and submit, **Then** that one spec runs the Companion workflow and their configured default is unchanged.
3. **Given** the companion piece is not installed, **When** the user picks Companion and submits, **Then** the existing install-first prompt appears and the stock fallback path works exactly as before.
4. **Given** any workflow was selected in the form, **When** the created-spec event is reported, **Then** it is attributed to the workflow the user actually selected, not inferred from the dispatched command text.
5. **Given** the extension's surfaces that each build a workflow list, **When** any of them renders, **Then** all of them offer the same set for the same conditions — no surface can offer a workflow another hides.

---

### User Story 3 - A funnel that measures every rung (Priority: P1)

A maintainer looking at telemetry can follow a user from install to completion without guessed gaps: a once-ever installed event, a panel-opened event (the rung where the biggest leak hides), the existing created and dispatched events, and a completed event that fires from every path that can complete a spec — today two of the three completion paths emit nothing, which distorts completion numbers as much as any real drop-off. Every new event appears in the published telemetry disclosure docs.

**Why this priority**: Without the missing rungs, the adjacent-step drop-offs are unmeasurable and every activation investment (including stories 1 and 2) ships blind.

**Independent Test**: Run one session covering install-first-activation, opening the panel, creating a spec, and completing a spec via each of the three completion paths; verify each rung produced exactly the expected events and the disclosure docs list them.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the extension activates for the first time, **Then** an installed event fires once — and never again on later activations of the same install.
2. **Given** an activated session, **When** the specs panel first becomes visible, **Then** a panel-opened event fires, and repeated visibility toggles in the same session do not inflate the count.
3. **Given** a spec ready to be completed, **When** it is completed via the sidebar action, via the viewer's lifecycle action, or by the Companion pipeline's terminal step, **Then** the completed event fires from each path, exactly once per completion.
4. **Given** the editor-wide or extension telemetry switch is off, **When** any funnel moment occurs, **Then** no event is sent and nothing breaks.
5. **Given** the new events exist, **When** a user reads the telemetry disclosure docs, **Then** every new event is listed there.

---

### User Story 4 - A dashboard that shows the funnel (Priority: P2)

A maintainer opens the analytics dashboard and sees the activation funnel as one view — installed → panel opened → spec created → phase dispatched → completed — with the adjacent-step drop-offs readable at a glance. Tiles that can never return data (the retired profile/turbo breakdown) are gone, and the previously fixed specify-vs-plan undercount is confirmed healthy on fresh data.

**Why this priority**: The dashboard is where the funnel events become decisions; it depends on story 3's events existing.

**Independent Test**: Open the dashboard and verify the five-stage funnel view exists, no dead tiles remain, and specify counts are at parity with plan counts on data captured after the fix shipped.

**Acceptance Scenarios**:

1. **Given** funnel events are flowing, **When** the dashboard is opened, **Then** a funnel view shows all five stages in order with per-stage counts.
2. **Given** the retired profile dimension, **When** the dashboard's tiles are reviewed, **Then** no tile depends on data nothing can ever send.
3. **Given** fresh post-fix data, **When** specify and plan phase counts are compared, **Then** specify is no longer undercounted relative to plan.

---

### User Story 5 - Launch content led by customization and visualization (Priority: P2)

A prospective user evaluating the extension — on the Marketplace, on social, or from the README — encounters content that leads with the two loved capabilities: a 30–60 second demo clip of a run in flight (live pipeline rail plus per-phase timing together, not a tour of a finished run), a "make it yours" customization asset (swap workflow, shape commands, pick provider), a benefit-led Marketplace listing with the leaner-specs stat above the fold, and a social carousel aimed at Copilot users in the US and India.

**Why this priority**: Content converts the audiences the data says exist, but it markets what stories 1–2 make real in-product, so it lands after them.

**Independent Test**: Verify each asset exists and leads with customization or visualization: the in-flight clip, the customization asset, the refreshed listing, and the carousel; verify the README's three clip-promotion placeholders are resolved.

**Acceptance Scenarios**:

1. **Given** the demo clip, **When** it plays, **Then** it runs 30–60 seconds and shows a run in flight — the live pipeline rail and per-phase timing together — not only finished-run screens.
2. **Given** the Marketplace listing, **When** a visitor reads it, **Then** the description leads with benefits and the leaner-specs stat appears above the fold.
3. **Given** the README, **When** its three clip-promotion placeholders are checked, **Then** each is resolved with the real clip or removed.
4. **Given** the carousel, **When** it is reviewed, **Then** it addresses Copilot users and is suitable for the US and India audiences.

---

### Edge Cases

- What happens when "Open a live sample" is clicked with no workspace folder open? The action must explain rather than fail silently.
- What happens when a directory with the sample's name already exists in the workspace? Seeding must not overwrite it — reopen or pick a non-colliding name.
- What happens when the user deletes the seeded sample? The zero-spec welcome returns; seeding again works.
- What happens when two completion paths act on the same spec (e.g. the pipeline's terminal step lands after the user clicked complete)? Status is forward-only, so the completed event must fire exactly once, not once per path.
- What happens on reinstall or a wiped global state? The installed event may fire again for what is effectively a new install identity — acceptable, but it must never fire per-session.
- What happens when the panel is toggled visible/hidden repeatedly in one session? One panel-opened event, not one per toggle.
- What happens to the workflow-choice control when custom workflows exist, or when only one workflow is available? Custom entries keep their filtering rules; a single-workflow workspace keeps hiding the chooser.
- What happens when telemetry is disabled at either switch when a funnel moment occurs? Nothing is sent, and once-ever/per-session de-dupe slots are not consumed by unsent events.
- What happens to a spec created from the terminal (no create-form involvement)? It never fires a created event today — the documented blind spot either gets a watcher-based emit or stays explicitly documented.

## Requirements

### Functional Requirements

**First-run**

- **FR-001**: The zero-spec sidebar MUST present a single merged welcome — one value line, a "Create your first spec" action, and an "Open a live sample" action — replacing the two stacked welcome blocks.
- **FR-002**: The extension package MUST bundle one curated sample spec, and "Open a live sample" MUST seed a copy of it into the workspace (never read it in place from the package).
- **FR-003**: The seeded sample MUST open in the spec viewer immediately after seeding, showing a populated pipeline state worth looking at.
- **FR-004**: Seeding MUST be safe to repeat: an existing seeded sample is reopened rather than duplicated, an existing same-named directory is never overwritten, and a missing workspace folder produces a clear explanation rather than a silent failure.

**Create Spec**

- **FR-005**: The Create Spec workflow choice MUST render each workflow's description, with Companion carrying its proof line ("specs 60–68% leaner, same correctness"), replacing the name-only dropdown.
- **FR-006**: The form MUST offer a low-commitment "Try Companion for this spec" that applies Companion to the one spec being created without changing the user's configured default workflow.
- **FR-007**: All surfaces that build a workflow list MUST resolve it through one shared builder/predicate, eliminating the current divergence where two independent builders disagree about Companion's availability.
- **FR-008**: The unreachable standalone workflow picker MUST be either wired to a real entry point or removed; the workflow-selected event MUST correspondingly have a live emitter or be retired from the disclosure docs.
- **FR-009**: The created-spec event MUST report the workflow the user actually selected in the form (coerced to the telemetry allow-list), not a value sniffed from the dispatched command string.
- **FR-010**: For users without the companion piece installed, the create flow — install-first prompt, stock fallback, cancel — MUST behave exactly as it does today.

**Funnel events**

- **FR-011**: The extension MUST emit an installed event exactly once per install (once-ever, persisted), distinct from the per-session activation event.
- **FR-012**: The extension MUST emit a panel-opened event when the specs panel first becomes visible, de-duplicated per session.
- **FR-013**: The completed event MUST fire from every path that completes a spec — the sidebar action, the viewer lifecycle action, and the Companion pipeline's terminal step — emitted from one shared status-transition seam so a completion can never fire it twice or not at all.
- **FR-014**: Every new event MUST honor both telemetry switches, carry only shape-not-content payloads per the existing telemetry rules, and never consume a de-dupe slot when the event could not be sent.
- **FR-015**: The published telemetry disclosure docs MUST list every event added by this feature.
- **FR-016**: The created-spec event SHOULD also fire for specs first observed via the file watcher (terminal-created specs); if this is not adopted, the undercount MUST remain explicitly documented as a known blind spot.

**Dashboard**

- **FR-017**: The analytics dashboard MUST present the activation funnel as one view in the order installed → panel opened → spec created → phase dispatched → completed.
- **FR-018**: The dashboard MUST NOT contain tiles that can never return data; the retired profile/turbo tile is removed.
- **FR-019**: Specify-vs-plan phase parity MUST be verified on data captured after the undercount fix, and the result recorded.

**Content**

- **FR-020**: A 30–60 second demo clip MUST exist showing a run in flight — the live pipeline rail and per-phase timing together — produced through the established visual-asset pipeline.
- **FR-021**: A customization asset MUST exist demonstrating "make it yours": swapping the workflow, shaping commands, and picking a provider.
- **FR-022**: The Marketplace listing MUST lead with benefits, surface the leaner-specs stat above the fold, and the README's three clip-promotion placeholders MUST be resolved.
- **FR-023**: A social carousel aimed at Copilot users in the US and India MUST exist.

**Regression guard**

- **FR-024**: Existing flows — create, dispatch, complete, and install prompts — MUST behave exactly as before aside from the new surfaces.

### Key Entities

- **Sample spec**: A curated, read-worthy example spec bundled in the extension package; seeding copies it into the workspace as an ordinary spec directory (documents plus recorded state) pre-populated to show a pipeline mid-flight or completed. It is user-deletable and never mutated in the package.
- **Funnel event**: One rung of the activation funnel (installed, panel opened, spec created, phase dispatched, completed) with its de-duplication scope (once-ever, per-session, or once-per-spec-completion) and its disclosure entry.
- **Workflow choice**: The Create Spec control's model of an offerable workflow — name, description/proof line, installed state, and whether it was chosen as the default or as a one-spec trial — sourced from the single shared workflow-list builder.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A brand-new user with zero specs can go from opening the sidebar to a sample spec open in the viewer in under 1 minute, without authoring anything.
- **SC-002**: The zero-spec sidebar renders exactly one welcome block (down from two), offering both a create action and a sample action.
- **SC-003**: 100% of workflow options in the Create Spec form display a description, and Companion's proof line is visible without any extra click.
- **SC-004**: All 3 completion paths emit the completed event, and a single spec completed once produces exactly 1 completed event.
- **SC-005**: All five funnel stages are observable in telemetry from one scripted end-to-end session, and every new event is listed in the disclosure docs (100% disclosure coverage).
- **SC-006**: The dashboard shows the five-stage funnel and contains 0 tiles that can never return data.
- **SC-007**: The demo clip runs between 30 and 60 seconds and shows an in-flight run; the listing's leaner-specs stat appears above the fold; the carousel exists.
- **SC-008**: 0 behavior changes in existing create/dispatch/complete/install-prompt flows outside the new surfaces (existing tests keep passing).

## Assumptions

- The sample spec's content is curated from the existing demo material but shipped as a dedicated bundled asset, since the repo's demo fixtures are excluded from the package and are mutation-prone dev fixtures; seeding is copy-into-workspace, never read-in-place.
- The panel-opened event de-duplicates per session (first visibility only), matching how other engagement events are counted.
- The installed once-ever marker persists in extension-global storage; a wiped global state legitimately reads as a new install.
- Workflow attribution reports built-in workflow names verbatim and reduces custom workflow names to a generic marker, per the existing shapes-not-content telemetry rules.
- FR-016 (watcher-based created event for terminal-created specs) is the issue's explicitly optional item: the default here is to adopt it only if it can be de-duplicated reliably; otherwise the documented-blind-spot fallback stands.
- The dashboard work happens in the analytics tool against live data; this feature's repo-side responsibility is the events and the disclosure docs, plus recording the parity verification result.
- Content assets follow the established visual-asset rules: generated assets are regenerated (never hand-edited), and published screenshot filenames are overwritten in place (never renamed or deleted).

## Verbatim Constraints

- Telemetry event names pinned by the issue: `extension.installed`, `spec.created`, `spec.completed`, `workflow.selected`.
- Companion proof line, exactly: `specs 60–68% leaner, same correctness`.
- Welcome actions, exactly: `Create your first spec` and `Open a live sample`; the trial affordance: `Try Companion for this spec`.
- Funnel stage order, exactly: installed → panel opened → spec created → phase dispatched → completed.
