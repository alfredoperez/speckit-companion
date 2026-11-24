# Plan: where each skill comes from, and which skill hooks cannot run

## Summary

The spec-kit half gains one skill catalog, built in `build-pipeline.py` beside the existing `available_skills`: every skill under the project's three skill folders, the developer's `~/.claude/skills`, and each Claude Code plugin installed for this project, with its description and whether `disable-model-invocation` bars a hook from calling it. One function turns a hook's `ref` and that catalog into a plain problem sentence. The build prints the sentence as a warning for every skill hook that has one, and `pipeline-graph.py` puts the catalog under `choices.skillCatalog` and the sentence on each hook as `problem`. On the editor side the protocol gains those two fields plus `BuildReport.warnings`, which `readBuildReport` lifts out of the build log.

## Project Structure

```
apps/speckit-extension/
  scripts/build-pipeline.py        skill_catalog, skill_problem, skill_hook_warnings; main prints them
  scripts/pipeline-graph.py        choices.skillCatalog, hook.problem
  tests/test_skill_catalog.py      new: catalog, problems, build warning
  CHANGELOG.md                     [Unreleased] line
apps/vscode/src/
  protocol/pipeline.ts             SkillChoice, PipelineHook.problem, PipelineChoices.skillCatalog, BuildReport.warnings
  features/specs/pipelineBuildCommands.ts   buildWarnings in readBuildReport
  features/specs/__tests__/buildReport.test.ts
CHANGELOG.md                       [Unreleased] line
```

**Structure Decision**: the check lives in `build-pipeline.py` because both the build and the graph already import it; the graph only reads its answers.

## Call paths

```calls a skill hook's problem reaches the board and the build
  build_graph() @ apps/speckit-extension/scripts/pipeline-graph.py:274
+   skill_catalog() @ apps/speckit-extension/scripts/build-pipeline.py:262
~   _hook() @ apps/speckit-extension/scripts/pipeline-graph.py:190
+     skill_problem() @ apps/speckit-extension/scripts/build-pipeline.py:262
```
note: the graph passes each hook through the same `skill_problem` the build warns with, so the two sentences cannot differ.

```calls the build prints the same problem
  main() @ apps/speckit-extension/scripts/build-pipeline.py:660
+   skill_hook_warnings() @ apps/speckit-extension/scripts/build-pipeline.py:262
```

```calls the build report carries the warnings
  build() @ apps/vscode/src/features/specs/pipelineBuildCommands.ts:167
~   readBuildReport() @ apps/vscode/src/features/specs/pipelineBuildCommands.ts:144
+     buildWarnings() @ apps/vscode/src/features/specs/pipelineBuildCommands.ts:89
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: reads existing config and skill folders; adds no setting. |
| II. Spec-Driven Workflow | PASS: runs through this spec. |
| III. Visual and Interactive | PASS: data only; the webview change is separate work. |
| IV. Modular Architecture | PASS: one function owns the check; graph and build both call it. |
| AI Provider Integration | PASS: Claude Code plugin reading is additive; other providers keep the shared folders. |
| User Interface | PASS: no UI edit here. |
