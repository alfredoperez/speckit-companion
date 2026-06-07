# Contract: `/speckit.companion.status`

A Companion-owned spec-kit command (markdown, run by the AI CLI) that reports where the active spec stands. Read-only — never writes state.

## Invocation

```
/speckit.companion.status            # active feature (resolved like the capture hooks)
```

Feature-directory resolution (delegated to the script, same precedence as `write-context.py`):
`--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch prefix.

## Behavior

1. Verify `python3`. If absent: warn `[companion] Warning: python3 not detected; skipped status` and stop (do not fail the host).
2. Run `python3 speckit-extension/scripts/status-context.py --feature-dir <dir>`.
3. Script reads `.spec-context.json`; if missing/malformed, derives from on-disk files (`source: "derived"`).
4. Print a human summary built from the `ResumeResolution`.

## Output contract

Human-readable block:

```
Spec: <specName>   (source: state|derived)
Step: <currentStep>   Status: <status>
Decisions:
  - <decision 1>
  - <decision 2>
Next: <nextActionLabel>  →  <nextCommand|"—">
```

- No decisions → `Decisions: (none recorded)`.
- `complete = true` → `Next: Pipeline complete  →  —`.
- `source = "derived"` with no files → `Nothing to summarize (no spec files or recorded state found).`
- The script also emits the machine `ResumeResolution` JSON on a final line prefixed `RESOLUTION: { … }` so `resume` (and tests) can parse it deterministically.

## Exit behavior

Always exits 0. Best-effort; never fails the host command. Malformed state is reported (via `source: "derived"`), not raised.

## Acceptance mapping

Covers FR-001, FR-002, FR-011, and SC-001 / SC-003. Edge cases: missing-and-no-files, malformed-state, start-of-pipeline.
