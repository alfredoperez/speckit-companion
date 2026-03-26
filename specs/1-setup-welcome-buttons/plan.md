# Plan: Setup Welcome Buttons for Init & Constitution

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

Add conditional `viewsWelcome` entries in `package.json` using `when` clauses with the existing context keys (`speckit.cliInstalled`, `speckit.detected`, `speckit.constitutionNeedsSetup`). VS Code natively supports multiple welcome content blocks per view — they stack when their `when` conditions are true. No TypeScript changes needed.

## Files

### Modify

| File | Change |
|------|--------|
| `package.json` | Replace the single `speckit.views.explorer` welcome entry with 3 conditional entries: (1) "Initialize Workspace" when `speckit.cliInstalled && !speckit.detected`, (2) "Configure Constitution" + "Create New Spec" when `speckit.detected && speckit.constitutionNeedsSetup`, (3) existing "Create New Spec" when `speckit.detected && !speckit.constitutionNeedsSetup` |
