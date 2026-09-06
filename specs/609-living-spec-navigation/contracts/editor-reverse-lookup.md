# Contract: editor reverse lookup

## Status bar item

Owner: `src/features/specs/livingSpecsStatusBar.ts`
Created with `vscode.window.createStatusBarItem`, refreshed on `onDidChangeActiveTextEditor` and on a registry change.

| Condition | Item |
|---|---|
| Active file claimed by N ≥ 1 capabilities | Visible, reading `N living specs` (`1 living spec` at N = 1). |
| Active file claimed by none | Hidden. |
| File exempt by the registry's `exempt` globs | Hidden. |
| No active editor, or not a workspace file | Hidden. |
| Living specs disabled or unconfigured | Hidden. |

Computed in the extension process from the registry and the file path. Never dispatches a command, never runs Python.

## Command

`speckit.livingSpecs.forFile` — the item's `command`. Opens a quick-pick.

Pick list, in order:
1. One separator per claiming capability, most-specific capability first, labelled with the capability name.
2. Under each, one item per requirement whose `touches` marker matches the active file, labelled with the requirement heading.
3. Where a capability has no matching marked requirement, one item that opens the spec itself.

Selecting an item calls:

```
speckit.viewSpecDocument(<absolute spec path>, { living: true, requirement: <heading | undefined> })
```

## Viewer target

`speckit.viewSpecDocument` accepts `opts.requirement`. When present and a matching `.living-req-card` renders, the viewer brings that card into view. An unmatched heading opens the spec at the top; it is never an error.
