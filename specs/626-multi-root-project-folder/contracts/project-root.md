# Contract: Project root

The feature exposes two things: one setting, and one resolver module that every surface calls. There are no new commands, routes or views.

## Setting

| Field | Value |
|---|---|
| Key | `speckit.projectFolder` |
| Type | string |
| Default | `""` |
| Scope | `window` |
| Declared in | `package.json` |
| Constant | `ConfigKeys.projectFolder` in `apps/vscode/src/core/constants.ts` |

Accepted values:

- `""`: no choice. Detection decides.
- A workspace folder name.
- A path to a workspace folder. Use this when two workspace folders share a name.

The value is read at workspace level, with no resource. A folder-level value is ignored, because the choice is about the whole window.

## Resolution order

Rows are checked top to bottom. The first row that matches decides.

| # | Condition | Project folder | Output channel |
|---|---|---|---|
| 1 | No folder is open | `undefined` | nothing |
| 2 | `speckit.projectFolder` names a folder in the workspace | that folder, even if it holds no Spec Kit files | nothing |
| 3 | `speckit.projectFolder` names a folder not in the workspace | continue to rows 4 to 7 | says the named folder was not found |
| 4 | The workspace has one folder | that folder, with no disk read | nothing |
| 5 | One or more folders pass `hasSpecKitMarker` | the first of them in workspace order | if more than one qualified: which folder was picked, and that others qualified |
| 6 | One or more folders hold a `specs` directory | the first of them in workspace order | same as row 5 |
| 7 | Otherwise | the first workspace folder | nothing |

Rules that hold for every row:

- The focused editor never changes the result.
- Nothing is cached. Each call resolves again.
- A probe that fails with anything other than "not found" skips that folder for this resolve and is logged once. An unreadable folder is not treated as an empty one.

## Resolver module

Path: `apps/vscode/src/core/projectRoot.ts`. It imports only `vscode`, `fs`, `path` and `./constants`.

| Export | Signature | Contract |
|---|---|---|
| `getProjectRoot` | `getProjectRoot(): string \| undefined` | The project folder as a file system path, per the table above. `undefined` when no folder is open. |
| `getProjectRootUri` | `getProjectRootUri(): vscode.Uri \| undefined` | The same folder as a `Uri`. `undefined` under the same condition. |
| `hasSpecKitMarker` | `hasSpecKitMarker(root: string): boolean` | True when `.specify` exists in `root`, or `.github/agents/speckit.specify.agent.md` exists, or `.github/agents/speckit.plan.agent.md` exists. The detector uses this same function. |
| `watchProjectRoot` | `watchProjectRoot(outputChannel): vscode.Disposable` | Listens for workspace folder changes and for changes to `speckit.projectFolder`. Re-resolves, logs the pick to `outputChannel`, and fires the event below. Disposing it stops the listening. |

## Event

| Export | Type | Fires when | Payload |
|---|---|---|---|
| `onDidChangeProjectRoot` | `vscode.Event<string \| undefined>` | The resolved root differs from the previous one. A setting or folder change that resolves to the same root fires nothing. | The new project root, or `undefined` when no folder is open. |

What the extension does on the event:

- Refreshes the three tree views and any open viewer panels.
- Runs Spec Kit detection again.
- Runs `wireCompanionSurfaces` again.
- Calls `SteeringExplorerProvider.rebuildProjectWatchers()`.

A viewer panel that is already open stays on its file. A terminal opened before the change keeps its own working directory.

## What a consumer can rely on

- Paths handed to an assistant are relative to `getProjectRoot()`, and the assistant's terminal starts there.
- A workspace with one folder resolves exactly as it did before this feature.
- A change to the setting or the workspace folders takes effect without a window reload.

## Not covered

- Living specs colocated in another workspace folder. The registry and its paths are read relative to the one project folder.
- Several Spec Kit projects in one window. One is shown at a time, chosen by `speckit.projectFolder`.
