# Implementation Plan: Scripted desktop QA

**Branch**: `630-scripted-desktop-qa` | **Date**: 2026-10-08 | **Spec**: [scripted-desktop-qa.spec.md](./scripted-desktop-qa.spec.md)

## Summary

Six of the twelve release QA checks that ended BLOCKED on both 2026-10-06 reports can be decided by one VS Code window on one project with a stand-in assistant, so they move into the scripted real-window check, which already drives such a window with Playwright. The script gains the demo fixture set the navigation matrix needs, added only when those steps start, and one step per moved assertion, all in the window it already opens. The release QA skill gains a `scripted` check kind that names the step ids deciding it, a small grader that turns the script's results files into PASS, FAIL or BLOCKED per check, and a handoff of four short parts for what still needs eyes. Nothing new is invented: every step uses the helpers the script already has, and the grader reads the results JSON the script already writes.

## Project Structure

```text
tooling/scripts/desktop-check.mjs            the new main-window steps; addDemoSpecs() adds the _00 to _07 demo fixtures when they start; the per-theme results wipe; the terminal confirm settings in the profile
.claude/skills/release-qa/
  surface-map.yml                            the scripted kind (run, steps, themes), the seven scripted checks, a QA harness surface for the script and tooling/scripts/lib/**
  grade-scripted.py                          new: reads surface-map.yml and .desktop-check/results.<theme>.json, prints one PASS/FAIL/BLOCKED line per scripted check
  test_grade_scripted.py                     new: the grader's unit tests
  SKILL.md                                   Step 2 runs the script and the grader before staging; the recipes of the moved checks point at step ids; recheck reruns the whole check
  desktop-handoff.md                         four parts: first open, stock and two roots, the timed run, the GitHub Copilot app; a terminal question is written down and the pass moves on
.claude/commands/release-loop.md             the two sentences that describe the desktop flow
.claude/commands/release-qa.md               the Step 2 wording
docs/visual-assets.md                        the real-window check section names the new coverage
```

`qa-stage.sh` is unchanged: it still builds the sandbox and the stock workspace and opens the three QA windows the handoff uses.

**Structure Decision**: extend the one script and the one skill that already own this work. No new module, no new sandbox recipe, no second window: every new step runs in the main window on the script's own throwaway project.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. Only tooling and the QA skill change; no setting, provider or command surface moves. |
| II. Spec-Driven Workflow | PASS. The check exercises the workflow; it does not change it. |
| III. Visual and Interactive | PASS. The narrow-panel, builder and theme steps assert the visual contract the viewer already promises. |
| IV. Modular Architecture for Complex Features | PASS. The script stays one file with helpers, which is its existing shape; the grader is one small script beside the surface map. |
| AI Provider Integration | PASS. The stand-in assistant stays the only thing a step dispatches to. |
| User Interface | PASS. No UI change. |

No violations, so no Complexity Tracking.

## Phase 0: Research

See [research.md](./research.md) for the decisions: one window per run, the fixture set for the matrix, how the viewer is narrowed, the per-theme results, the `scripted` kind and the grader, and what the handoff keeps.

## Phase 1: Design

- [data-model.md](./data-model.md): the check, the step, the results file and the handoff part.
- [contracts/surface-map-scripted.md](./contracts/surface-map-scripted.md): the `scripted` kind, the grader's input and output, and the step ids each scripted check names.
- [contracts/desktop-check-steps.md](./contracts/desktop-check-steps.md): every new step id with what it asserts and the fixture it reads.

Re-checked against the Constitution after design: still no violation.
