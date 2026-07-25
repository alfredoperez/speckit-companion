# Implementation Plan: Trust timing from CLI-only runs

## Summary

The viewer's duration-trust gate in `deriveStepHistory` (`src/features/specs/stepHistoryDerivation.ts`) only counts a step as measured when both of its boundaries are stamped `by:extension`. A CLI/agent run stamps its ordered, script-clock boundaries `by:ai`, so the gate rejects them and the Overview reports "0 of N phases." The fix introduces a small writer-authority tier — instrumented writers (`extension`/`cli`/`derive`/`user`) rank above the agent writer (`ai`), which ranks above unrecognized — and re-expresses the gate as: a span is trusted when it has exactly one step-level start from a recognized writer and a close (own complete or next-step start) whose writer is at least as authoritative as the start's. That trusts a coherent `ai`/`ai` CLI run while keeping the #509 masquerade (extension start closed by a premature `ai` finish) and an advance-only phase (a complete with no start) untrusted. The Python parity port in `.claude/skills/eval-speckit-extension/check_quality.py` mirrors the same tier. No schema change; the traceability count already reads coverage rows independently and needs no code change.

## Project Structure

```
src/features/specs/
  stepHistoryDerivation.ts          # the trust gate — add boundaryWriterRank, rework closeIsOwnCompletion/closeIsNextStart/explicitStarts
  __tests__/stepHistoryDerivation.test.ts   # add CLI-only trusted + masquerade-still-untrusted cases
.claude/skills/eval-speckit-extension/
  check_quality.py                  # parity port — _boundary_writer_rank, same close-authority rule
speckit-extension/tests/
  test_check_quality.py             # parity test pinning the same shapes
docs/
  capture-and-timing.md             # update the "Timing honesty rider" note
src/features/specs/
  specs.spec.md                     # living spec — fold a delta at mark-complete
```

**Structure Decision**: The change lives entirely in the two mirrored trust derivations plus their tests; no new module, no data flow change.

## Constitution Check

No project constitution file (`.specify/memory/constitution.md`) is present, so there is no formal gate. The repo's operative conventions (CLAUDE.md, `.claude/review-checklist.md`) apply and are honored:

| Principle | Assessment |
|---|---|
| Cross-language derivation parity carries full semantics + parity tests (#505) | PASS — both sides updated in the same change, parity test added |
| Honest timing distinction preserved (#509/#514) | PASS — masquerade + advance-only stay untrusted |
| No schema change / no lifecycle-key writes | PASS — derivation-only |
| Tests prove each drift direction fails (#432) | PASS — new tests assert both the newly-trusted shape and the still-untrusted shapes |

## Key Decisions

See `research.md`.
