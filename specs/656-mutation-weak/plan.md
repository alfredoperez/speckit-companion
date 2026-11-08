# Implementation Plan: An opt-in mutation check marks weak requirements

**Spec**: [spec.md](./spec.md) · **Source**: #963 (r4)

## Summary

`write-context.py --mutation-report <path>` reads either a Stryker JSON report (mutation-testing-report-schema: `files[path].mutants[]` with `status` and `killedBy` test ids, `testFiles[path].tests[]` with `id`) or a mutmut `mutmut-cicd-stats.json`. It records a "Mutation check" row under Verified reading "<killed> of <total> caught" (Killed and Timeout count as caught; Ignored, CompileError, RuntimeError and Pending are left out), and for Stryker sets `coverage[req].weak` on every requirement that has at least one test file in the report and none that killed a mutant, clearing earlier marks in the same write. Implement's record node gains a step, gated on `mutation.enabled` in `.specify/companion.yml`, telling the agent to run the tool on the changed files and pass the report. The viewer adds a weak coverage state between missing and tested.

## Project Structure

```
apps/speckit-extension/scripts/capture.py           read_mutation_report, apply_mutation_report
apps/speckit-extension/scripts/write-context.py     --mutation-report PATH
apps/speckit-extension/nodes/implement/record-verified.md   step 9: mutation, when enabled
apps/speckit-extension/nodes/implement/complete.md         renumbered 10
apps/speckit-extension/tests/test_mutation_report.py      new, with fixtures/mutation/
apps/vscode/src/core/types/specContext.ts, spec-context.schema.json   weak on coverage
apps/vscode/src/features/spec-viewer/stateDerivation.ts             pickCoverage reads weak
apps/vscode/webview/src/spec-viewer/coverageState.ts               'weak'
apps/vscode/webview/src/spec-viewer/components/OverviewDossier.tsx  Weak label and line
apps/website/src/content/docs/docs/customize/workflow-builder.mdx   risk and mutation keys
```

**Structure Decision**: the writer interprets the report once and stores plain flags; the viewer only reads `weak`.

## Call paths

```calls read a mutation report
  main() @ apps/speckit-extension/scripts/write-context.py:1398
+   apply_mutation_report() @ apps/speckit-extension/scripts/capture.py:695
```
note: one read-modify-write sets the weak marks and the Verified row under the one lock.

## Constitution Check

| Principle | Assessment |
|---|---|
| Writers keep the record's guarantees | PASS. One write; a bad report declines; never-fail. |
| Repository text reaches a panel as text | PASS. Labels are fixed strings; counts are numbers. |
| One fact, one owner | PASS. The `companion.yml` keys are documented once, on the builder page. |

## Key Decisions

- **Runs at the end of implement, not after converge**: every flow runs implement, and converge then sees the result.
- **Weak needs evidence**: a requirement is weak only when its test files ran against the mutants and caught none; tests the report never ran are not judged.
- **mutmut gives totals only**: no per-test attribution, so no weak marks.
