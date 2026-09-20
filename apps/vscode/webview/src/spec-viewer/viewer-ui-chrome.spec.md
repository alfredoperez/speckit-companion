# Viewer UI Chrome — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

The frame around the document: the header, the footer bar, the Activity panel's install banner, and the capture stories that publish what the viewer looks like.

## Requirements

### The header prints the title exactly as it arrives
<!-- touches: apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx -->

The header SHALL render the title it is given without re-casing it. Casing is decided before the title reaches the webview.

#### Scenario: a feature title with an acronym is shown
- **WHEN** the header receives "CLI Install Nudge"
- **THEN** it prints "CLI Install Nudge"

### A living spec's footer states the capability's condition in words
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

The footer's left side SHALL read "In sync", "N requirements drifted", "Drift unknown" or "No spec yet".

#### Scenario: two requirements drifted
- **WHEN** the footer renders
- **THEN** it reads "2 requirements drifted"

### The living footer offers Approve while the spec is a draft or has adopted requirements
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

Approve SHALL read "Approve all N" when N requirements are adopted, and "Approve spec" when none is adopted but the spec is a draft.

#### Scenario: an adopted living spec with four adopted requirements
- **WHEN** the footer renders
- **THEN** it offers "Approve all 4"

#### Scenario: a draft living spec with nothing adopted
- **WHEN** the footer renders
- **THEN** it offers "Approve spec"

### Sync is offered only once drift is found
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

The living footer SHALL always offer "Adopt an area" and "Validate", and SHALL add "Sync" only when the capability has drifted.

#### Scenario: a living spec in step with its code
- **WHEN** the footer renders
- **THEN** it offers "Adopt an area" and "Validate" and no "Sync"

#### Scenario: a drifted living spec
- **WHEN** the footer renders
- **THEN** it also offers "Sync"

### The living footer shows Undo while an action can be undone
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

While the extension reports a pending undo, the footer SHALL show Undo counting down the time left, and pressing it SHALL send that undo's token.

#### Scenario: the reader removes a requirement
- **WHEN** the panel redraws
- **THEN** an Undo reading "Requirement removed" counts down from five seconds

### A living spec's header carries facts, never buttons
<!-- touches: apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx -->

The header SHALL hold no controls except the covers glob. It shows each fact once: requirement count, adopted, new, drifted, coverage, where the capability applies and where its file lives. While the document is a draft, DRAFT reads as part of the title.

#### Scenario: an adopted draft is open
- **WHEN** the header renders
- **THEN** DRAFT sits beside the title and no approve button is in the header

### A covers glob shows its full text
<!-- touches: apps/vscode/webview/src/spec-viewer/components/SpecHeader.tsx -->

A covers glob SHALL render as a control carrying its whole text, never truncated, that asks the extension to reveal it.

#### Scenario: a long glob
- **WHEN** the header renders it
- **THEN** every character of the glob is visible

### The install banner shows the prompt the extension sent
<!-- touches: apps/vscode/webview/src/spec-viewer/components/ActivityPanel.tsx, apps/vscode/webview/src/spec-viewer/components/ActivityPanel.stories.tsx -->

The Activity panel's banner SHALL render the install or update prompt as the extension sent it, and an update banner SHALL name both the installed and the expected version.

#### Scenario: the extension sends an update prompt
- **WHEN** the Activity panel renders it
- **THEN** the banner names the installed and the expected version

### Motion stops for readers who ask for reduced motion
<!-- touches: apps/vscode/webview/src/spec-viewer/components/StepTab.tsx, apps/vscode/webview/styles/tokens.css -->

Every animation SHALL have a still equivalent under the reduced-motion preference.

#### Scenario: a step is in flight with reduced motion on
- **WHEN** the rail renders
- **THEN** the in-flight indicator does not animate

### Decorative glyphs are hidden from assistive technology
<!-- touches: apps/vscode/webview/src/spec-viewer/components/StepTab.tsx -->

A glyph that carries nothing its label does not SHALL be hidden from assistive technology.

#### Scenario: a status glyph accompanies a label
- **WHEN** a screen reader reaches it
- **THEN** only the label is announced

### Accent-filled buttons use the accent's own ink
<!-- touches: apps/vscode/webview/src/shared/components/Button.tsx, apps/vscode/webview/src/spec-viewer/components/footer/LivingFooter.tsx -->

A button filled with the accent colour SHALL take the accent's ink token for its text, whether built from the shared button or assembled by hand, because a hardcoded white is unreadable on the default dark theme's mint accent.

#### Scenario: a hand-built accent button on the default dark theme
- **WHEN** it renders
- **THEN** its label uses the same ink as the shared primary button

### The viewer's own microcopy reads as plain sentences
<!-- touches: apps/vscode/webview/src/spec-viewer/components/footer/CatalogFooter.tsx -->

Strings the webview composes (a footer context line, a summary title, a sizing line) SHALL join clauses with a comma and introduce figures with a colon, never with a dash.

#### Scenario: a running step locks the forward action
- **WHEN** the footer explains why
- **THEN** it reads "Step running, actions unlock when it settles"

### The capture stories are published copies of the real viewer, never forks of it
<!-- touches: apps/vscode/webview/src/spec-viewer/__stories__/sidebarTree.tsx, apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx -->

Stories that produce documentation imagery SHALL compose the shipped viewer components with fixture data, never re-implement a surface, because their output is published as what the product looks like.

#### Scenario: a viewer component's markup changes
- **WHEN** the capture stories render
- **THEN** they show the changed component as shipped

### A scene several captures share is defined once
<!-- touches: apps/vscode/webview/src/spec-viewer/__stories__/sidebarTree.tsx, apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx -->

A scene more than one capture uses SHALL be exported once and composed by each, and SHALL NOT appear in the published story list itself.

#### Scenario: a still and a clip frame the same document
- **WHEN** both render
- **THEN** both compose the one exported scene, which is not listed as a story

### A sidebar capture matches the real view's title bar
<!-- touches: apps/vscode/webview/src/spec-viewer/__stories__/sidebarTree.tsx, apps/vscode/webview/src/spec-viewer/__stories__/SidebarCapture.stories.tsx -->

A capture standing in for editor chrome the webview does not build SHALL show the title-bar actions the real view contributes, in the declared order, only on the pane the frame is about. A state-dependent icon slot SHALL read its state off the fixture rows.

#### Scenario: a sidebar frame is captured
- **WHEN** the pane renders
- **THEN** its title-bar actions follow the contributed order, the collapse-or-expand slot matches the tree on screen, and neighbouring panes stay bare

## Uncovered

The original adoption did not read these files in full. Their exported surface and role were established, but their bodies were not reviewed line by line:

- `webview/src/spec-viewer/components/index.ts`
- All `*.stories.tsx` files and all files under `__tests__/`
