# Implementation Plan: Find the Spec Kit project in a multi-root workspace

**Branch**: `626-multi-root-project-folder` | **Spec**: [multi-root-project-folder.spec.md](./multi-root-project-folder.spec.md)

**Scale note**: 36 source files read the first workspace folder inline, across every feature area, the providers and the Spec Kit helpers. Most edits are the same one-line swap. The parts to watch are the few places that cache the root at start-up, and the two that already choose a spec's own folder on purpose.

## Summary

One resolver, `getProjectRoot()`, replaces every inline read of the first workspace folder. It honours a new window-scoped setting, `speckit.projectFolder`, and otherwise picks the first folder that holds a Spec Kit marker, then the first with a specs directory, then the first folder. A one-folder workspace never touches the disk and resolves exactly as before. A small watcher re-resolves on a setting or workspace-folder change and, when the answer changes, fires one event that refreshes the views, re-runs detection and rebuilds the root-bound watchers.

## Project Structure

```text
apps/vscode/src/
├── core/projectRoot.ts                 # NEW: getProjectRoot, getProjectRootUri, hasSpecKitMarker, watchProjectRoot, onDidChangeProjectRoot
├── core/constants.ts                   # ConfigKeys.projectFolder
├── core/utils/{fileSystemUtils,configManager}.ts     # delegate to the resolver; no cached root
├── extension.ts                        # start the watcher; on change refresh views, re-detect, re-wire
├── speckit/{detector,integrationProvider,specKitExtensionInstall,specKitExtensionInstallCommands}.ts
├── ai-providers/{claudeCode,cliTerminal,geminiCli,wibeyCli,codexCli,claudePanel}Provider.ts, promptBuilder.ts, initOptions.ts
├── features/specs/{specCommands,specExplorerProvider,pipelineBuildCommands,sampleSpec,selectionContextKeys}.ts
├── features/spec-viewer/{messageHandlers,specViewerProvider,utils}.ts
├── features/steering/{steeringExplorerProvider,steeringManager}.ts
├── features/living-specs/{livingSpecsCommands,livingSpecsExplorerProvider,livingSpecsStatusBar}.ts
├── features/workflows/{workflowSelector,pipelineResolution,workflowManager,checkpointHandler}.ts
├── features/spec-editor/{specEditorProvider,tempFileManager}.ts
└── features/{pipeline-builder/builderPanel,agents/agentManager,skills/skillManager}.ts
apps/vscode/tests/__mocks__/vscode.ts   # onDidChangeWorkspaceFolders, onDidChangeConfiguration
package.json                            # speckit.projectFolder
docs/configuration.md, docs/architecture.md, CHANGELOG.md, apps/website/src/content/docs/docs/reference/configuration.mdx
```

**Structure Decision**: The resolver lives in `core/` and imports only `vscode`, `fs`, `path` and `./constants`, so every layer can call it. Call sites keep passing a root string into the existing pure helpers.

## Identifiers

- Setting: `speckit.projectFolder`, string, default `""`, scope `window`. A workspace folder name or a path.
- `getProjectRoot(): string | undefined` and `getProjectRootUri(): vscode.Uri | undefined`.
- `hasSpecKitMarker(root: string): boolean`: `.specify` exists, or `.github/agents/speckit.specify.agent.md` or `.github/agents/speckit.plan.agent.md` exists. The detector uses the same function.
- `watchProjectRoot(outputChannel): vscode.Disposable` and `onDidChangeProjectRoot: vscode.Event<string | undefined>`.
- `SteeringExplorerProvider.rebuildProjectWatchers()`.

## Rules for the swap

- A read of `workspaceFolders?.[0]` used as the project becomes `getProjectRoot()`. A truthiness guard on the array becomes `getProjectRoot() !== undefined`.
- A site that needs a `Uri` uses `getProjectRootUri()`.
- A root cached in a constructor field becomes a getter.
- Leave alone: user-home paths, `specShapeDiagnostics` (per-document folder), the loop over all folders in the viewer's `workspaceFolderOf`, and `profileDispatch.findWorkspaceRoot` (walks up from the spec).
- `workflowSelector` and `pipelineResolution` keep the spec's own folder first; only their first-folder fallback becomes the project root.
- `livingSpecsStatusBar` uses the project root, and a file outside it claims nothing.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. One new setting, declared in the manifest, with a default that changes nothing. |
| II. Spec-Driven Workflow | PASS. No step or lifecycle change. |
| III. Visual and Interactive | PASS. No new UI; existing views follow the project. |
| IV. Modular Architecture for Complex Features | PASS. One core module; features call it and keep their own shape. |
