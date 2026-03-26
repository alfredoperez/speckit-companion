# Tasks: Setup Welcome Buttons for Init & Constitution

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Replace viewsWelcome explorer entry with conditional entries — `package.json`
  - **Do**: In `package.json` `viewsWelcome` array, replace the single `speckit.views.explorer` entry with 3 entries:
    1. `"when": "speckit.cliInstalled && !speckit.detected"` → contents: `"SpecKit CLI detected. Initialize this workspace to start building with specs.\n\n[$(gear) Initialize Workspace](command:speckit.initWorkspace)"`
    2. `"when": "speckit.detected && speckit.constitutionNeedsSetup"` → contents: `"Configure your project principles to guide AI-assisted development.\n\n[$(book) Configure Constitution](command:speckit.constitution)\n\n[$(plus) Create New Spec](command:speckit.create)"`
    3. `"when": "speckit.detected && !speckit.constitutionNeedsSetup"` → contents: `"Build features with specs\n\n[$(plus) Create New Spec](command:speckit.create)"` (existing)
  - **Verify**: `npm run compile` passes; open extension in dev host → check each state shows correct buttons

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001 | [x] |
