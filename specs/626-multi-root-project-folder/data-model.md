# Data Model: Find the Spec Kit project in a multi-root workspace

Nothing here is persisted except the setting. The project folder is derived on every call from the setting, the workspace folders and the disk.

## Project folder setting

The developer's explicit choice. The only stored value in this feature.

| Field | Type | Notes |
|---|---|---|
| key | `speckit.projectFolder` | Declared in `package.json`; `ConfigKeys.projectFolder` in code. |
| value | string | A workspace folder name or a path. Default `""`. |
| scope | `window` | Read with no resource. A folder-level value is ignored. |

Validation:

- Empty means "no setting"; detection decides (FR-002).
- A value matches a workspace folder by name, or by path. Path matching is what separates two folders with the same name.
- A value that matches a workspace folder wins over detection, even when that folder has no Spec Kit files (FR-004).
- A value that matches no workspace folder is ignored for this resolve. Detection decides and the miss is written to the output channel (FR-005).

## Workspace folder candidate

One entry of the window's workspace folders, as the resolver sees it. Read from VS Code and the disk, never stored.

| Field | Type | Notes |
|---|---|---|
| name | string | The workspace folder name. |
| path | string | The folder's file system path. |
| index | number | Position in workspace order. Ties break on the lowest index. |
| hasMarker | boolean | `hasSpecKitMarker(path)`: `.specify` exists, or `.github/agents/speckit.specify.agent.md` or `.github/agents/speckit.plan.agent.md` exists. |
| hasSpecsDir | boolean | A literal `specs` directory exists. |
| probeFailed | boolean | A probe failed with anything other than "not found". |

Validation:

- Only "not found" counts as no marker. A candidate whose probe failed is skipped for this resolve and logged once.
- The detector and the resolver share `hasSpecKitMarker`, so the sidebar and the welcome view cannot disagree about a folder.

## Project folder

The one workspace folder Companion treats as the Spec Kit project for the window. Returned by `getProjectRoot(): string | undefined` and `getProjectRootUri(): vscode.Uri | undefined`.

| Field | Type | Notes |
|---|---|---|
| root | string or undefined | Undefined only when no folder is open. |
| source | setting, marker, specs directory, first folder | Why this folder was picked. Used for the output channel line. |
| otherQualified | boolean | True when detection found more than one folder at the winning tier (FR-006). |

Resolution order, first match wins:

1. No workspace folders: undefined.
2. One workspace folder: that folder, with no disk read (FR-003).
3. The setting matches a workspace folder: that folder.
4. The first candidate, in workspace order, with `hasMarker`.
5. The first candidate with `hasSpecsDir`. A bare specs directory only qualifies when no folder has a marker.
6. The first workspace folder, so the welcome and init flows still work.

Rules:

- Every surface reads the root through the resolver. No surface reads the first workspace folder directly (FR-001, SC-005).
- The focused editor's folder is not an input (FR-009).
- Paths handed to an assistant are relative to the root, and the assistant's terminal starts in it (FR-008).
- The root is not cached. Research overrides the spec's caching assumption: tests reassign workspace folders with no event, and `specify init` creates the marker without telling the extension.

## Project root change

The event `onDidChangeProjectRoot: vscode.Event<string | undefined>`, fired by the watcher that `watchProjectRoot(outputChannel)` starts. Its payload is the new root.

Triggers: a change to `speckit.projectFolder`, or a workspace folder added or removed (FR-007).

State transitions:

| From | Trigger | To | Effect |
|---|---|---|---|
| root A | trigger, resolve still gives A | root A | Pick is logged. No event. |
| root A | trigger, resolve gives B | root B | Event fires. The three tree views and open viewer panels refresh, detection re-runs, `wireCompanionSurfaces` re-runs, and the steering view rebuilds its project watchers. |
| root A | A removed, another folder qualifies | that folder | Same as above. |
| root A | A removed, none qualifies | first folder | Same as above. |
| root A | last folder removed | undefined | Event fires with undefined. Companion behaves as with no workspace. |

Not moved by a change: an open viewer panel stays on its file, a terminal opened earlier keeps its working directory, and the spec file watchers keep their window-wide globs.

## Relationships

- The setting and the candidates are the only inputs to the project folder. One window has at most one project folder.
- A spec that carries its own workspace folder still resolves from that folder first in `workflowSelector` and `pipelineResolution`. The project folder is only their fallback.
- Living specs registry paths stay relative to the project folder. Living specs colocated in another workspace folder are out of scope.
