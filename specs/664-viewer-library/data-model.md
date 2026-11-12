# Data Model: speckit-viewer V1 to V4

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

The shapes already exist in the extension.
This feature moves them into `/contract` and adds runtime schemas.
Interfaces stay hand-written, and a type test ties each schema to its interface (R5).

## Entities

### SpecContext

The `.spec-context.json` record of one spec.
Source today: `apps/vscode/src/core/types/specContext.ts`.
Owned by `/contract` after the move, checked by `SpecContextSchema`.

| Group | Top-level fields |
|---|---|
| Identity | `workflow`, `specName`, `branch`, `workingBranch?`, `selectedAt?` |
| Lifecycle | `currentStep`, `status`, `history`, `progress?` |
| Delivery | `prUrl?`, `prNumber?`, `checkpointStatus?`, `convergePasses?` |
| Story | `intent?`, `request?`, `expectations?`, `context?`, `approach?` |
| Judgement | `decisions?`, `concerns?`, `verified?`, `coverage?`, `classification?`, `risk?` |
| Links | `source?`, `extends?`, `supersedes?`, `livingSpecs?` |
| Misc | `reviewComments?`, `profile?`, `assistant?`, `telemetryInstanceId?` |

Related types:

- `StepName`: specify, clarify, plan, tasks, analyze, implement, converge.
- `Status`: draft, specifying, specified, planning, planned, tasking, ready-to-implement, implementing, implemented, completed, archived.
- `HistoryEntry`: one `start` or `complete` event with a step and an author (`extension`, `user`, `cli`, `ai`, `derive`).

Validation:

- `currentStep`, `status`, history `kind` and `by` are enums.
- The schema is loose: unknown fields pass through (edge case, newer writers).
- `history`, `request` and the other optional fields may be absent and still parse.
- A malformed file reports the failing field path.
- Legacy files (`transitions`, `active`) go through the host's `normalizeSpecContext` first.

State transitions:

- `history` only grows.
- A write merges, and a status never moves backward.
- Status follows the step: specifying, specified, planning, planned, tasking, ready-to-implement, implementing, implemented, completed, archived.

### Navigation state (`NavState`)

What the host sends so the viewer can draw its header and tabs.
Source: `apps/vscode/src/protocol/viewer.ts`.
Checked by `NavStateSchema` (required fields only).

| Group | Top-level fields |
|---|---|
| Documents | `coreDocs`, `relatedDocs`, `currentDoc`, `isViewingRelatedDoc`, `enhancementButtons?`, `stalenessMap?` |
| Progress | `workflowPhase`, `taskCompletionPercent`, `taskCounts?`, `specStatus?`, `currentStep?`, `activeStep?`, `currentTask?` |
| Header | `badgeText?`, `createdDate?`, `lastUpdatedDate?`, `specContextName?`, `branch?`, `filePath?`, `docTypeLabel?`, `titleFromHeading?` |
| Living and reports | `livingMode?`, `livingMeta?`, `livingOverview?`, `livingUndo?`, `report?`, `reportActions?` |
| Host prompts | `installPrompt?`, `runRecovery?`, `assistantName?`, `hasTerminal?`, `landing?`, `removedDocument?` |

`NavState` carries `stepHistory` and `tasksMarkdown` as derived input for the viewer.

### Viewer state (`SpecViewerState`)

What the viewer draws for one spec.
Checked by `ViewerStateSchema` (required fields only).

- Identity: `specName`, `specDirectory`, `changeRoot?`, `living?`, `livingSourcePath?`, `bug?`, `reportSet?`.
- Documents: `currentDocument`, `availableDocuments`, `landing?`, `removedDocument?`.
- Progress: `phases`, `currentPhase` (1 to 4), `taskCompletionPercent`, `taskCounts?`.
- Timing: `lastUpdated`.

### Viewer message

An action the viewer asks the host to run.
`ViewerMessageSchema` checks the `type` discriminant against every outgoing message in `ViewerToExtensionMessage`.
A type test keeps the schema list and the union exhaustive both ways.
Incoming messages (`ExtensionToViewerMessage`) keep their interfaces and get no schema in this slice.

### Token set

A named `--sk-*` design value that a theme file sets and the stylesheet reads.
Private per-rule variables (`--callout-c`, `--w`, `--toc-*`) are not tokens.

| Group | Examples | Rule |
|---|---|---|
| surface | page, raised, sunken, hover | Backgrounds only. |
| ink | primary, body, muted | `--sk-dim` merges into `--sk-muted`. Body text uses ink. |
| accent | accent, hover, strong, subtle, ink | The brand hue. |
| status | done, active, blocked | Only for status, never for ids or priority. |
| info | info, info-subtle | Not blue in the light theme. |
| priority-high / medium / low | one hue and one tint each | High is warn, not red. |
| id-fr / id-sc | neutral id hues | Requirement and scenario ids are neutral. |
| review | review, review-subtle, review-ink | Marks, rules and tints. Words use `review-ink`. |
| border | default, hover, accent, code, task | Lines only. |
| code | text, keyword, string, number, comment, function, type, variable | Syntax colours. |
| type | body and mono families, sizes | Fonts from the host. |
| space | 1 to 8 | The spacing scale. |

Exact names follow the colour-role table in #986.
The final list comes from the stylesheet in V4, so treat the examples as the intended shape.

Which file sets what (R7), all under `packages/viewer/styles/themes/`:

| File | Role |
|---|---|
| `vscode.css` | Today's literal palette keyed on `body.vscode-light/dark`, the high-contrast block from `--vscode-*`, editor fonts, today's role colours. The only file with VS Code variable names. |
| `light.css` | Light palette. Imported first by `viewer.css`, so it is the fallback default. |
| `dark.css` | Dark palette. |
| `ap-ui.css` | `@ap/ui` palette. |
| `roles.css` | Shared role colours (info, priority, ids) for light, dark and `ap-ui`. Importing it into `vscode.css` recolours the extension. |

Validation:

- Every theme file sets every token the stylesheet reads.
- No theme set means the light defaults apply, never blank colours.
- Every selector is scoped to `:where(.sk-viewer)` by `scripts/build-css.mjs`.

## Relationships

- A `SpecContext` has many `HistoryEntry` rows and one current step and status.
- The host builds `NavState` and `SpecViewerState` from a spec folder plus its `SpecContext`.
- The viewer sends `ViewerMessage` values back to the host.
- The stylesheet reads tokens, and exactly one theme file supplies them per host.
