# Implementation Plan: Retire living specs

**Spec**: [spec.md](./spec.md) · **Source**: #934

> **Scale note**: about 200 files across four areas (spec-kit extension, VS Code host and webview, site, media and repo tooling). Watch two seams: shared helpers that living code also hosts (git runner, YAML-subset check, glob matcher), and the old-record card, which stays while the rest of the viewer's living mode goes.

## Summary

Delete the seven `living-*` commands, their scripts, nodes, reference parts and docs from the spec-kit extension, and the Living Specs view, status bar, commands, on-save shape checker, builder panel and capability-file viewer mode from the VS Code extension. Three helpers that sit in living files but serve other features move first: the glob matcher (`resolve-spec-paths.py`, used by the risk tier) moves into `capture.py`, and `GitRunner` and `unsupportedForRuntime` (`livingSpecsModel.ts`) move into `core/utils`. Old `.spec-context.json` `livingSpecs` blocks keep loading and keep rendering through `LivingSpecsCard`, with chips as plain text. The doctor gains two notes: a leftover `livingSpecs:` config, and a constitution naming flow-back or living specs. The site drops the living page (redirected), and the steps page gains one "How Companion keeps specs" section.

## Project Structure

```text
apps/speckit-extension/
  commands/speckit.companion.living-*.md        delete (7)
  commands/reference/living-*.md                delete (3)
  nodes/{specify,plan}/load-living-specs.md     delete
  nodes/specify/draft-spec-delta.md             delete
  nodes/*/_order.yml, workflows/presets/brownfield.yml
  scripts/  living_spec_fold, living_validate, check_living_spec, spec_deltas,
            record-living-specs, register-capability, relocate-capability,
            drift, doctor_drift, check-coverage, resolve-spec-paths   delete
  scripts/  capture, write-context, companion_config, config_write,
            pipeline-graph, dispatch-briefs, doctor*, check_quality,
            check_capture, run_trace, package-manifest              edit
  tests/    living-only tests delete; mixed tests trimmed
  docs/living-specs.md delete; README, docs/commands.md, CHANGELOG edit
apps/vscode/src/
  features/living-specs/**                      delete
  features/specs/specShape{Check,Diagnostics}.ts delete
  core/utils/{git,yamlSubset}.ts                new homes for moved helpers
  extension.ts, core/{constants,telemetry,utils/contextKeys,utils/overviewAvailability}.ts
  features/spec-viewer/**, features/pipeline-builder/**, protocol/{viewer,pipeline}.ts
apps/vscode/webview/src/
  pipeline-builder/LivingSpecsPanel.tsx, spec-viewer/markdown/livingComponents.ts,
  spec-viewer/components/footer/LivingFooter.tsx  delete
  spec-viewer/{App,index,actions,signals,toc,messageHandlers}.ts(x), SpecHeader, FooterActions edit
  spec-viewer/components/cards/LivingSpecsCard.tsx  keep, chips become text
package.json                                    views, welcome, commands, menus
apps/website/                                   page delete + redirect, steps section, links
content/media/, tooling/scripts/, .claude/, .specify/companion.yml, .github/workflows/ci.yml, .vscodeignore
```

**Structure Decision**: delete in place; move the three shared helpers before their host files go; no new module beyond the two small `core/utils` homes.

## Call paths

```calls risk tier keeps its glob matcher
  compute_risk() @ apps/speckit-extension/scripts/capture.py:796
~   _glob_matcher() @ apps/speckit-extension/scripts/capture.py:784
+     _glob_matches() @ apps/speckit-extension/scripts/capture.py:784
-   _glob_matches() @ apps/speckit-extension/scripts/resolve-spec-paths.py:125
```

```calls viewer freshness keeps its git runner
  filesChangedSince() @ apps/vscode/src/features/spec-viewer/checkFreshness.ts:17
+   makeDefaultGitRunner() **new** @ apps/vscode/src/core/utils/git.ts
-   makeDefaultGitRunner() @ apps/vscode/src/features/living-specs/livingSpecsModel.ts:1078
```

```calls doctor reads a project's leftovers
  run_check() @ apps/speckit-extension/scripts/doctor.py:222
+   check_retired_living() @ apps/speckit-extension/scripts/doctor_checks.py:479
+   check_persistence_model() @ apps/speckit-extension/scripts/doctor_checks.py:479
-   recompute() @ apps/speckit-extension/scripts/doctor_drift.py:48
```
note: both new checks only report; neither writes the config or the constitution.

## Screens

```screen sidebar Companion sidebar
title: SpecKit Companion
list: Specs | Steering
text: Living Specs view (removed) (1)
```
1: **Gone with its status bar and commands.** Files under `capabilities/` stay on disk.

```screen overview Old spec Overview
title: 510 living sync
chip: Living specs card (changed) (1)
```
1: **Still renders old records.** Capability names show as text; they no longer open a file.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. A leftover config key is ignored, not rejected. |
| II. Spec-Driven Workflow | PASS. The pipeline loses optional nodes; every step still runs. |
| III. Visual and Interactive | PASS. The old-record card stays; only a surface whose data source goes is removed. |
| IV. Modular Architecture | PASS. Shared helpers move to `core/utils`; `core/` still imports nothing from `features/`. |
