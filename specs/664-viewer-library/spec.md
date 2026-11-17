# Feature Specification: Spec viewer as a shared library (V1 to V4)

**Source**: #983

The spec viewer exists in three hosts and two copies. This feature starts one package that the extension, Factory and other apps can all use. It covers the first four slices of #983 only: the package's name and home, the repo workspace, the contract and core layers, and the styles on their own token set. Cutting the view off from the VS Code host (V5) and everything after it are out of scope.

## User Scenarios & Testing

### User Story 1 - The extension keeps working on the new package (Priority: P1)

A SpecKit Companion user opens a spec after the change. The viewer looks and behaves exactly as before, because the extension now gets its renderer, derivations and data shapes from the package instead of its own folders.

**Why this priority**: The extension is the upstream. If it breaks, nothing else matters.

**Independent Test**: Build the extension's viewer bundle before and after. The bundle is identical once module ids and paths are stripped, and the renderer and derivation tests pass unchanged.

**Acceptance Scenarios**:

1. **Given** the repo is a workspace with the package in it, **When** the extension's production viewer bundle is built before any code moves, **Then** it is byte-for-byte the same as on main.
2. **Given** the renderer and derivations live in the package, **When** the bundle is built, **Then** it differs from main only in module ids and paths.
3. **Given** the fixture specs, **When** they are rendered, **Then** the HTML matches what main produces.

### User Story 2 - Another host loads the package (Priority: P1)

A developer in a Factory-like app (plain Node or a bundler, no VS Code) imports the contract and core layers, validates a `.spec-context.json` file with the contract's schema and renders a spec's markdown to HTML.

**Why this priority**: Sharing is the point of the package. Factory replacing its hand-written context filler with the schema is the first real use.

**Independent Test**: A script outside the extension imports the contract and core entry points by package name, parses a fixture `.spec-context.json`, and renders a fixture `spec.md`, with no VS Code, Preact or DOM present.

**Acceptance Scenarios**:

1. **Given** a valid `.spec-context.json`, **When** it is parsed with the contract's schema, **Then** it parses and keeps its fields.
2. **Given** a malformed context file, **When** it is parsed, **Then** the schema reports which field is wrong instead of passing it through.
3. **Given** a spec's markdown, **When** the core renderer runs in a plain runtime, **Then** it returns HTML without touching a DOM or a framework.

### User Story 3 - A host themes the viewer with tokens (Priority: P2)

A host picks a theme file (VS Code, light, dark or `@ap/ui`) and the viewer's stylesheet follows it. The stylesheet reads only the package's own token names, so a host never has to fake VS Code variable names.

**Why this priority**: Factory today values VS Code's variable names to theme the viewer. A clean token seam ends that, but the extension works without it.

**Independent Test**: Search the stylesheet for VS Code variable names: they appear only in the VS Code theme file. Load each theme file and check that every token the stylesheet reads has a value.

**Acceptance Scenarios**:

1. **Given** the styles layer, **When** it is searched for VS Code variable names, **Then** the only file that has them is the VS Code theme.
2. **Given** the light theme, **When** a note callout, a high-priority story or a requirement id is drawn, **Then** none uses blue as an info hue and high priority is not red.
3. **Given** the extension with the VS Code theme, **When** a spec opens, **Then** every colour resolves to the same value it had before.

### Edge Cases

- A context file with fields the schema does not know: they pass through, so newer writers do not break older readers.
- A context file missing optional fields (no `history`, no `request`): it parses.
- The renderer reads one value from the viewer's live state (living-spec requirements). Outside the extension that value is absent and the renderer still works.
- A host loads the styles without any theme file: tokens fall back to the default theme, not to blank colours.
- The extension's development launch (F5) still runs after the move.

## Requirements

### Functional Requirements

- **FR-001**: The package MUST live at `packages/viewer`, be named `speckit-viewer`, carry the MIT licence, and stay private (unpublished).
- **FR-002**: The repo MUST be an npm workspace that includes the package, and the extension's production viewer bundle MUST be byte-identical to main's after the workspace change alone.
- **FR-003**: The package MUST expose three entry points: `/contract`, `/core` and `/styles`.
- **FR-004**: `/contract` MUST own the `.spec-context.json` shape, the viewer's navigation and viewer state shapes and the outgoing viewer message shapes, with runtime schemas for each.
- **FR-005**: `/core` MUST hold the markdown renderer and the viewer's pure derivations, and no file in it may import VS Code, Preact or DOM APIs.
- **FR-006**: The extension MUST import the contract and core layers from the package and keep no second copy of what moved.
- **FR-007**: After the move, the extension's production viewer bundle MUST equal main's once module ids and paths are stripped, and the command that proves it MUST be written down so it can be rerun.
- **FR-008**: The renderer's output for the fixture specs MUST match main's.
- **FR-009**: `/styles` MUST hold the viewer stylesheet reading only `--sk-*` tokens, with every selector scoped to the viewer root.
- **FR-010**: `/styles` MUST ship four theme files: VS Code, light, dark and `@ap/ui`, and no VS Code variable name may appear outside the VS Code theme file.
- **FR-011**: Info, priority and requirement colours MUST be roles in the token set, and the light theme MUST not use blue for info or red for high priority.
- **FR-012**: The extension MUST look the same on the VS Code theme after the styles move.
- **FR-013**: The package MUST load in a plain Node runtime outside the extension, proven by a test that imports `/contract` and `/core` by package name.
- **FR-014**: The release QA surface map MUST list `packages/viewer/**`.

### Key Entities

- **Spec context**: the `.spec-context.json` record of a spec's steps, history and status.
- **Navigation state**: the documents of a spec, the current step and their labels, sent to the viewer.
- **Viewer state**: the step history, tasks, decisions and timing the viewer draws.
- **Viewer message**: an action the viewer asks its host to perform.
- **Token**: a named `--sk-*` design value, set by a theme file.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The workspace-only bundle is 100% byte-identical to main's.
- **SC-002**: After the move, the normalized bundle diff is empty.
- **SC-003**: All existing Jest suites pass, with no test edited except for import paths.
- **SC-004**: A non-extension script loads the package and renders a fixture spec in one run, with zero VS Code, Preact or DOM imports reached.
- **SC-005**: Zero VS Code variable names outside the VS Code theme file.

## Assumptions

- The name `speckit-viewer` is provisional; the owner confirms it before publishing (V8).
- The package ships TypeScript source; a compiled build exists only where a runtime cannot load source (the host's development launch and plain Node).
- The host-side derivations that build navigation and viewer state from a spec folder (step history and status derivation) read the filesystem today and stay in the extension for now.
- Mermaid stays out of the core, as decided in #983.
- The token names follow the design review's colour-role table (#986): neutral ids, status colours only for status, an info role, `--sk-dim` merged into `--sk-muted`, no red for P1.
- No screenshots or clip regeneration: the rendered result must not change, so there is nothing new to capture.

## Verbatim Constraints

- Package name: `speckit-viewer`
- Package path: `packages/viewer`
- Entry points: `/contract`, `/core`, `/styles`
- Token prefix: `--sk-*`
- Theme files: `vscode.css`, `light.css`, `dark.css`, `ap-ui.css`
- Surface map entry: `packages/viewer/**`
