# Data Model: Update Architecture & Documentation

No new entities or data models. This feature modifies only documentation files.

## Entities Referenced (source of truth)

### Actual src/ Directory Structure
```
src/
├── extension.ts
├── ai-providers/          (8 files: interface, factory, 5 providers, index)
├── core/                  (constants, types, fileWatchers, errors/, managers/, providers/, types/, utils/)
├── features/
│   ├── agents/            (agentManager, index)
│   ├── permission/        (index)
│   ├── settings/          (overviewProvider, index)
│   ├── skills/            (skillManager, index)
│   ├── spec-editor/       (specEditorProvider, specDraftManager, specEditorCommands, tempFileManager, types, index)
│   ├── spec-viewer/       (specViewerProvider, messageHandlers, documentScanner, phaseCalculation, staleness, html/, __tests__/)
│   ├── specs/             (specExplorerProvider, specCommands, specContextManager, __tests__/)
│   ├── steering/          (steeringExplorerProvider, steeringManager, steeringCommands, types)
│   ├── workflow-editor/   (workflowEditorProvider, workflowEditorCommands, workflow/)
│   └── workflows/         (workflowManager, workflowSelector, checkpointHandler, types)
└── speckit/               (detector, cliCommands, updateChecker, taskProgressService, utilityCommands)
```

### Actual webview/ Directory Structure
```
webview/
├── src/
│   ├── spec-viewer/       (index, actions, elements, highlighting, modal, navigation, state, types, markdown/, editor/)
│   ├── spec-editor/       (index, types)
│   ├── markdown/          (classifier, parser, index)
│   ├── render/            (blockRenderer, contentRenderer, index)
│   ├── ui/                (index, inlineEdit, phaseUI, refinePopover)
│   ├── types.ts
│   └── workflow.ts
└── styles/
    ├── spec-viewer/       (17 CSS partials + index.css)
    ├── spec-editor.css
    ├── spec-markdown.css
    ├── spec-viewer.css
    └── workflow.css
```

### Registered Tree Views (from package.json)
1. `speckit.views.explorer` — SpecExplorerProvider
2. `speckit.views.steering` — SteeringExplorerProvider
3. `speckit.views.settings` — OverviewProvider

### AI Providers (5 total)
1. Claude Code — claudeCodeProvider.ts
2. GitHub Copilot CLI — copilotCliProvider.ts
3. Gemini CLI — geminiCliProvider.ts
4. Codex CLI — codexCliProvider.ts
5. Qwen CLI — qwenCliProvider.ts

### Configuration Keys (from package.json)
- speckit.aiProvider
- speckit.workflowEditor.enabled
- speckit.claudePath
- speckit.geminiPath
- speckit.copilotPath
- speckit.qwenPath
- speckit.geminiInitDelay
- speckit.permissionMode
- speckit.specDirectories
- speckit.customCommands
- speckit.customWorkflows
- speckit.defaultWorkflow
- speckit.notifications.phaseCompletion
- speckit.views.steering.visible
- speckit.views.settings.visible
