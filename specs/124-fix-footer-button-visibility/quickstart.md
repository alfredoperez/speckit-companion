# Quickstart: Verifying Footer Button Determinism

How to confirm the fix. Demo fixtures are pinned states — never commit edits to them (`git restore` after).

## Build & load
```bash
npm run compile && npm run compile-web   # type + bundle
npm test                                  # unit determinism tests
npm run install-local                     # load into VS Code (do NOT commit the version bump)
```
Storybook visual baseline:
```bash
npm run storybook        # exercise FooterActions states
```

## Automated (the oracle)
Unit tests assert the live-derived footer equals `contracts/footer-button-matrix.md` for each state, plus:
- **Idempotence (SC-001)**: deriving the footer twice from one `ViewerState` ⇒ identical set.
- **No-disappear (SC-002, FR-002)**: a state-preserving action leaves the set unchanged.
- **Each pause stage (SC-003, FR-004)**: `specified` / `planned` / `ready-to-implement` / `implemented` / `completed` / `archived` show the documented forward/closure control.
- **Generating revert (FR-005)**: artifact-ready and timeout-elapse both return the normal `CatalogFooter`.
- **External change (FR-007, SC-004)**: simulate a `.spec-context.json` change ⇒ recomputed footer matches the new state.

## Manual (issue #193 reproduction)
1. Open a spec at a known pause stage (use `specs/_00_demo-specified` → expect **Plan**; `_01_demo-planned` → **Tasks**; `_02_demo-tasked` → **Implement**).
2. Record the visible footer buttons.
3. Click each non-destructive, non-advancing control (e.g. switch step tabs, open the Activity panel, click Regenerate then Undo). After each: the still-valid buttons remain present (FR-002). ✅
4. Click the forward action; confirm the footer updates to the next stage's set (label swaps, closure controls appear only at `implemented`) (FR-003). ✅
5. Re-open the same spec at the same true state; confirm the identical button set (US1-2). ✅
6. Switch to an earlier completed step tab; confirm the footer still reflects the true workflow stage, not the viewed tab (Edge: reviewing). ✅
7. Trigger an external change: edit the spec's `.spec-context.json` on disk (or run a sidebar lifecycle action); confirm footer + tabs update within ~2 s without reopening (FR-007). ✅

Restore fixtures afterward:
```bash
git restore specs/_00_demo-specified specs/_01_demo-planned specs/_02_demo-tasked
```

## Pass criteria
All matrix rows match; zero variance across repeated viewings; no still-valid button disappears across the repro flow; every pause stage exposes its forward/closure control; #193 symptoms do not recur (SC-005).
