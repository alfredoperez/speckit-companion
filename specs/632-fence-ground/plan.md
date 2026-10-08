# Implementation Plan: The ground all four stand on

**Spec**: [fence-ground.spec.md](./fence-ground.spec.md)

## Summary

The renderer reads the whole fence line through one pure parser and hands any registered block name to a registry before the tree check, with a plain code block as the fallback. The callout, comment, phase and story passes skip fenced lines using the renderer's own fence rule, so nothing inside a fence is rewritten. File chips accept a line suffix, and the host opens a folder path against the project root and spec folder, refuses anything outside the project, and reveals the line. The Copilot vendor bundle is rebuilt.

Size is `normal`: about 16 files across the webview, protocol, host and vendor output.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: the registry is the extension point; no setting needed |
| II. Spec-Driven Workflow | PASS |
| III. Visual and Interactive | PASS: no visible change except the chip opening the right file |
| IV. Modular Architecture | PASS: parser, registry and fence helper are small separate modules |

## Project Structure

```
apps/vscode/webview/src/spec-viewer/
  actions.ts                      # click handler posts line
  markdown/
    fenceInfo.ts                  # new: parseFenceInfo, fence-region helper
    blockFences.ts                # new: registry
    renderer.ts                   # use parser + registry before tree check
    preprocessors.ts              # callouts, comments, phases, stories skip fences
    inline.ts                     # path:line chips
    __tests__/                    # renderer, preprocessors, inline, fenceInfo
apps/vscode/src/protocol/viewer.ts          # openFile.line?
apps/vscode/src/features/spec-viewer/
  messageHandlers.ts              # handleOpenFile
  __tests__/messageHandlers.test.ts
apps/copilot-canvas/vendor/       # rebuilt
CHANGELOG.md                      # one Fixed line
```

**Structure Decision**: the fence-region helper lives with the parser in `fenceInfo.ts` because both encode what the renderer calls a fence.
