# Contract: spec-level open

## Command

| | |
|---|---|
| Id | `speckit.openSpec` |
| Argument | the spec's absolute directory path (`string`) |
| Effect | opens or reveals the spec viewer panel for that spec, landing on the view the viewer picks |
| Palette | not contributed — invoked from the Specs tree row only |

`speckit.viewSpecDocument` is unchanged: it still takes a file path and still opens that document.

## Provider entry point

```ts
class SpecViewerProvider {
    show(filePath: string, opts?: { living?: boolean }): Promise<void>;  // unchanged
    showSpec(specDirectory: string): Promise<void>;                      // new
}
```

`showSpec` behavior:

- No panel for `specDirectory` → create one requesting *no particular document*; `resolveDisplayDocument` then resolves the first available one.
- A panel already exists → re-render it on its current document and reveal it.
- The landing view (Overview vs document) is decided by the webview's `showingOverview`, never by the caller.

## Tree row

The spec-name row carries `{ command: 'speckit.openSpec', arguments: [<absolute spec directory>] }`. It remains collapsible, so a click both runs the command and toggles the row.
