# Implementation Plan: A record of which hooks ran

**Spec**: [spec.md](./spec.md)

## Summary

Every Companion hook the build renders gains one closing line: add `--hook-outcome '<step>/<when>/<anchor>/<index>/<type>[:<ref>]=ran'` (or `=skipped: <why>`) to the next `write-context.py` call. The writer appends each record to a new append-only `hookRuns` list in the spec's `.spec-context.json`, through the same `read_ctx`/`atomic_write` pair and lock as every other capture, and lets it ride alongside any other flag, so recording costs no extra call when the step makes one later. The host adds `readHookRuns(root)`, which picks the spec with the latest activity and returns its last record per hook, and the panel answers a new `readHookRuns` message with a `hookRuns` message.

## Project Structure

```
apps/speckit-extension/scripts/hook_render.py        record line at the end of each hook block
apps/speckit-extension/scripts/capture.py            append_hook_runs writer, hookRuns protected from --set
apps/speckit-extension/scripts/write-context.py      --hook-outcome flag, rides on any call
apps/speckit-extension/commands/reference/node-hooks.md   skill type, record rule
apps/speckit-extension/tests/test_hook_runs.py       render, writer, ride-along
apps/vscode/src/protocol/pipeline.ts                 HookRun, HookRunsAnswer, two messages
apps/vscode/src/features/pipeline-builder/hookRuns.ts **new** the read
apps/vscode/src/features/pipeline-builder/builderPanel.ts   readHookRuns handler
apps/vscode/src/features/pipeline-builder/__tests__/hookRuns.test.ts  fixture specs
CHANGELOG.md, apps/speckit-extension/CHANGELOG.md    one [Unreleased] line each
```

**Structure Decision**: one new host module for the read; everything else extends what exists.

## Call paths

```calls a hook asks for its record
  render() @ apps/speckit-extension/scripts/build-pipeline.py:724
    insert_hooks() @ apps/speckit-extension/scripts/hook_render.py:160
~     render_hook() @ apps/speckit-extension/scripts/hook_render.py:41
+       record_line() @ apps/speckit-extension/scripts/hook_render.py:41
```
note: `insert_hooks` already receives the step name and now passes it to `render_hook`.

```calls the record rides on a writer call
~ _main() @ apps/speckit-extension/scripts/write-context.py:805
+   append_hook_runs() @ apps/speckit-extension/scripts/capture.py:405
      read_ctx() @ apps/speckit-extension/scripts/spec_context.py
```

```calls the panel asks for the last run
  handlers @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:187
+   readHookRuns handler @ apps/vscode/src/features/pipeline-builder/builderPanel.ts:188
+     readHookRuns() **new** @ apps/vscode/src/features/pipeline-builder/hookRuns.ts
        resolveSpecDirectories() @ apps/vscode/src/core/specDirectoryResolver.ts:116
```

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS: hooks stay declared in `companion.yml`; nothing new to configure. |
| II. Spec-Driven Workflow | PASS: the run record gains one list; step boundaries are untouched. |
| III. Visual and Interactive | PASS: data for the board; the webview is another team's change. |
| IV. Modular Architecture | PASS: the host reads, the webview asks by message, one writer writes. |
