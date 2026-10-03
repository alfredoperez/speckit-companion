# Data Model: Assistant name and Show terminal on a spec

## Recorded assistant

The provider a spec's most recent Companion-dispatched step was sent to. Persisted, one per spec.

| Field | Type | Where | Notes |
|---|---|---|---|
| `assistant` | `string`, optional | `.spec-context.json` (`SpecContext.assistant`, also in `spec-context.schema.json`) | A provider id from `AIProviders`. Never a display name. |

- Written only when a context file already exists for the spec. The write never creates one.
- Written after the provider's run resolves. A suppressed dispatch or one that throws records nothing.
- The write touches this one key. It does not change step, status or history (FR-006).
- A failed write is swallowed. It never blocks the dispatch (FR-006).
- On read the value is coerced through `coerceProviderType`, an allow-list over `AIProviders`. An unknown or hand-edited value resolves to no assistant (FR-005).
- Recorded by the two `dispatchStep` paths and by the sidebar's clarify, analyze and checklist path. Create Spec and Auto have no spec folder yet, so they record nothing.

## Resolved assistant name

The display name both surfaces show. Derived, never stored.

| Field | Type | Where | Notes |
|---|---|---|---|
| `assistantName` | `string`, optional | return of `resolveSpecAssistant(context)`, and `NavState.assistantName` | `getProviderDisplayName` of the coerced id. Absent when there is no recorded or known assistant. |

- One resolver feeds the sidebar row and the viewer, so the two cannot disagree (FR-004, SC-002).
- The webview receives the resolved string. It never re-derives the name from the id.
- The file never supplies text that reaches the UI.
- Only feature spec panels carry it. Living and bug panels show no label.

## Spec terminal

The live terminal Companion opened for a spec's most recent step. In memory only.

| Field | Type | Where | Notes |
|---|---|---|---|
| key | `string` | `specTerminals` registry | The resolved absolute spec directory. |
| value | `vscode.Terminal` | `specTerminals` registry | The newest terminal Companion opened for that spec. |
| `hasTerminal` | `boolean`, optional | `NavState.hasTerminal` | True while the registry holds an entry for the spec. |
| `+terminal` | suffix | sidebar row `contextValue` | Appended to the lifecycle value while the entry exists. |

- One entry per spec. A new dispatch replaces the older terminal (FR-008).
- Only terminal providers produce an entry. A chat-panel dispatch records the assistant and no terminal.
- The registry never writes lifecycle. It stays separate from `terminalStepTracker`.
- Show terminal is offered only while the entry exists (FR-007, SC-004).
- Nothing is persisted. After a reload the registry is empty.

## Relationships

- A spec has zero or one recorded assistant and zero or one spec terminal. They are independent: a name with no terminal is the normal state after a reload or for a chat-panel provider.
- A dispatch is the single event that sets both. It writes `assistant` and, when the provider returned a terminal, registers it.
- The `speckit.specs.showTerminal` command and the viewer `{ type: 'showTerminal' }` message both look up the registry by spec directory.

## State transitions

| Entity | From → To | Trigger |
|---|---|---|
| Recorded assistant | none → recorded | First Companion dispatch on a spec that has a context file. |
| Recorded assistant | recorded → replaced | A later dispatch, including one under a different configured provider. |
| Spec terminal | none → live | A dispatch returns a terminal. |
| Spec terminal | live → replaced | A later dispatch on the same spec opens a new terminal. |
| Spec terminal | live → none | The terminal closes, or VS Code reloads. On close the registry fires its change callback, which refreshes the sidebar and open viewers (FR-009). |

Nothing clears a recorded assistant. A completed or archived spec keeps the last value.
