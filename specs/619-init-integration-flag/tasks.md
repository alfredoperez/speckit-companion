# Tasks: Initialize Workspace sets up the chosen assistant

- [x] **T001** Add the shared agent-arguments helper with the Windsurf rule + apps/vscode/src/speckit/specKitAgent.ts
- [x] **T002** [P] BDD tests for the helper on both flags, Windsurf included + apps/vscode/src/speckit/__tests__/specKitAgent.test.ts
- [x] **T003** Initialize Workspace probes the flag and passes the agent; Upgrade Project and Upgrade All use the helper + apps/vscode/src/speckit/detector.ts
- [x] **T004** BDD tests for init (--integration, --ai-only CLI, unreadable help, no pasted path) and Windsurf on init and both upgrades + apps/vscode/src/speckit/__tests__/detector.test.ts
- [x] **T005** Root CHANGELOG [Unreleased] Fixed line + CHANGELOG.md
- [x] **T006** Fold the init rule into the living spec + capabilities/extension-services/set-up-and-update.spec.md
