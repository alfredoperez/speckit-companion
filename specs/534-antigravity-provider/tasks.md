# Tasks: Add Antigravity as an AI Provider

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1 - Provider registration (User Story 1, P1)

- [x] **T001** Add `ANTIGRAVITY: 'antigravity'` to the `AIProviders` constant + src/core/constants.ts
- [x] **T002** Add the `PROVIDER_PATHS[AIProviders.ANTIGRAVITY]` entry (conservative terminal-CLI config) + src/ai-providers/aiProvider.ts
- [x] **T003** Create `AntigravityCliProvider extends CliTerminalProvider` (mirrors qwenCliProvider) + src/ai-providers/antigravityCliProvider.ts
- [x] **T004** Register the provider in `PROVIDER_CONSTRUCTORS` + src/ai-providers/aiProviderFactory.ts
- [x] **T005** Export the new provider + src/ai-providers/index.ts
- [x] **T006** Add `antigravity` to the `speckit.aiProvider` enum, `enumItemLabels`, and `enumDescriptions` + package.json

## Phase 2 - Docs & consistency (User Story 1 + FR-005)

- [x] **T007** [P] Add the Antigravity matrix column and bump "Ten" → "Eleven" provider counts + README.md
- [x] **T008** [P] Bump the provider count and name `antigravityCliProvider.ts` in the inventory + docs/architecture.md
- [x] **T009** [P] Bump the provider count and add Antigravity to the provider list + docs/how-it-works.md
- [x] **T010** [P] Add an `[Unreleased]` user-facing entry + CHANGELOG.md

## Phase 3 - Tests (SC-001, SC-002)

- [x] **T011** Extend the docs-consistency test: add `antigravity → antigravityCliProvider.ts` to `idToFile` and `11: 'eleven'` to `wordForCount` + tests/integration/docs-consistency.test.ts
- [x] **T012** Add a provider-resolution test proving `antigravity` resolves to `AntigravityCliProvider` and is a valid enum value + src/ai-providers/__tests__/antigravityProvider.test.ts

## Phase 4 - Verify

- [x] **T013** Run `npm run compile && npm test && npm run package`; fix any failures
