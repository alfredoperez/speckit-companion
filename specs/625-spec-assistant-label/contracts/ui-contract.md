# UI Contract: Assistant name and Show terminal on a spec

The feature exposes no HTTP API and no CLI. Its interface is one stored field, one VS Code command, a tree row context value, two viewer state fields, one viewer message and two header classes. A consumer or a test codes against the identifiers below.

## Stored field

- File: `.spec-context.json` in the spec directory.
- Field: `assistant`, optional string. It holds a provider id from `AIProviders`, never a display name.
- Written when Companion dispatches a pipeline step for the spec, after the provider's run resolves. One per spec, replaced on each dispatch.
- The write adds no history entry and changes no step or status. A failed write does not block the dispatch.
- Nothing is written when the dispatch is suppressed or fails before anything is sent.

## Name resolution

- `resolveSpecAssistant(context)` is the single source for the display name. The sidebar row calls it. The viewer receives its result.
- It passes the stored value through `coerceProviderType`, an allow-list over `AIProviders`, then through `getProviderDisplayName`.
- A missing value or an id this version does not know resolves to no name. Text from the file never reaches the UI.

## Command

- Id: `speckit.specs.showTerminal`
- Title: "Show Terminal"
- Argument: a spec row, or an absolute spec directory.
- Effect: reveals and focuses the newest live terminal Companion opened for that spec.
- With no live terminal for the spec, the command does nothing.

## Sidebar row

- Description: the row shows the resolved assistant name alongside what it already shows. No name is shown when none resolves.
- `contextValue`: the lifecycle value, or the lifecycle value followed by `+terminal`.
- The `+terminal` suffix is present only while a terminal Companion opened for that spec is still open.
- The Show Terminal menu entry is offered only on rows whose `contextValue` carries `+terminal`.
- Every other spec-row `when` clause tolerates the suffix, so existing row actions keep working.

## Viewer state

`NavState` gains two optional fields. Both are sent on first paint and on every later update.

| Field | Type | Meaning |
|---|---|---|
| `assistantName` | `string`, optional | The resolved display name. Absent when no name resolves. |
| `hasTerminal` | `boolean`, optional | True while the spec has a live terminal Companion opened. |

Only feature spec panels carry these fields. Living and bug panels show neither the label nor the button.

## Viewer message

- Webview to extension: `{ type: 'showTerminal' }`
- It carries no payload. The extension resolves the spec from the panel that sent it and runs the same reveal as the command.

## Header elements

| Class | Element | Shown when |
|---|---|---|
| `spec-header-assistant` | The assistant name label | `assistantName` is set |
| `spec-header-terminal-btn` | The Show terminal button | `hasTerminal` is true |

Clicking `spec-header-terminal-btn` posts `{ type: 'showTerminal' }`.

## Guarantees

- The sidebar row and the viewer show the same name for the same spec, because both read `resolveSpecAssistant`.
- The name survives a VS Code reload. The terminal link does not, so `+terminal` and `hasTerminal` are gone after a reload.
- Closing the terminal removes `+terminal` from the row and clears `hasTerminal` in open viewers without a manual refresh.
- A spec whose step went to a chat-panel provider shows the name and never offers Show terminal.
- A completed or archived spec keeps showing its last recorded assistant name.
