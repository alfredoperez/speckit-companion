# Research: Centralize Magic Strings

## R1: Where to define WorkflowSteps — constants.ts vs types.ts

**Decision**: Add `WorkflowSteps` to `src/core/constants.ts`

**Rationale**: `constants.ts` already houses all cross-cutting constant objects (Commands, ConfigKeys, FileNames, etc.). Workflow steps are referenced across specs, workflows, and viewer features — they belong in the shared core, not in a feature-specific types file.

**Alternatives considered**:
- `spec-viewer/types.ts` — rejected because workflow steps are used far beyond the viewer
- New `workflowConstants.ts` — rejected; adds a file for no reason when constants.ts is the established pattern

## R2: How to derive AIProviderType from the AIProviders constant

**Decision**: Define `AIProviders` as a `const` object in `constants.ts`, then derive the union type:
```typescript
export const AIProviders = {
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    COPILOT: 'copilot',
    CODEX: 'codex',
    QWEN: 'qwen',
} as const;

export type AIProviderType = typeof AIProviders[keyof typeof AIProviders];
```

**Rationale**: This keeps the constant object as the single source of truth. The union type is derived automatically — adding a new provider is a one-line change.

**Alternatives considered**:
- Keep the union type manually in `aiProvider.ts` — rejected; defeats the purpose of centralizing
- Move AIProviderType into constants.ts alongside AIProviders — acceptable but creates a larger diff; better to re-export from aiProvider.ts to minimize import churn

**Import strategy**: Define `AIProviders` constant in `constants.ts`. In `aiProvider.ts`, import `AIProviders` and derive `AIProviderType` from it. Existing imports of `AIProviderType` from `aiProvider.ts` remain valid.

## R3: How to handle treeContextValues.ts consolidation

**Decision**: Merge all values from `TreeContext` in `treeContextValues.ts` into `TreeItemContext` in `constants.ts`. Convert `treeContextValues.ts` to a re-export barrel (`export { TreeItemContext as TreeContext } from '../../core/constants';`) to avoid updating every import site in one pass. Then update imports file-by-file and delete the barrel when all references point to constants.ts.

**Rationale**: A re-export barrel minimizes the diff for the initial merge while keeping backward compatibility. The barrel can be cleaned up in the same PR or left as a thin redirect.

**Alternatives considered**:
- Delete `treeContextValues.ts` immediately and update all imports — viable but riskier in a single commit; chosen approach is safer
- Keep both files with cross-references — rejected; perpetuates the fragmentation problem

## R4: SpecStatuses location — constants.ts vs spec-viewer/types.ts

**Decision**: Add `SpecStatuses` constant to `constants.ts`. Keep the `SpecStatus` type in `spec-viewer/types.ts` but derive it from the constant (or keep it manual if circular import risk exists).

**Rationale**: The `SpecStatus` type is used in spec-viewer-specific interfaces (`FooterState`, `NavState`). Moving the type would create import churn. The constant object in `constants.ts` provides the centralized values; the type can reference it or stay parallel.

**Alternatives considered**:
- Move SpecStatus type to constants.ts — creates circular dependency risk if spec-viewer types import from constants and constants re-exports types
- Define both in spec-viewer/types.ts — rejected; status values are used across features beyond the viewer

**Circular dependency mitigation**: `constants.ts` exports only plain `as const` objects with no imports. Feature files import from constants. No risk of cycles.

## R5: Scope of "raw string replacement" for document types

**Decision**: Only replace raw `'spec'`, `'plan'`, `'tasks'` strings that are clearly used as document type identifiers (function arguments typed as `CoreDocumentType`, object keys in document maps, switch cases on document type). Do NOT replace strings that happen to match but serve different purposes (e.g., `'spec'` in a display label, directory name, or unrelated context).

**Rationale**: Blind find-and-replace would break unrelated code. Each replacement must be verified by context.

**Alternatives considered**:
- Replace all matches — rejected; too aggressive, would break non-document-type usages
- Skip document type consolidation entirely — rejected by spec (User Story 6)

## R6: Global state key naming convention

**Decision**: Add `globalState` sub-object to `ConfigKeys`:
```typescript
globalState: {
    skipVersion: 'speckit.skipVersion',
    lastUpdateCheck: 'speckit.lastUpdateCheck',
    initSuggestionDismissed: 'speckit.initSuggestionDismissed',
}
```

**Rationale**: Follows the existing `ConfigKeys` nesting pattern (e.g., `ConfigKeys.views`, `ConfigKeys.notifications`). Keeps all config-like keys in one place.

**Alternatives considered**:
- Top-level `GlobalStateKeys` constant — rejected; ConfigKeys already has the right namespace
- Flat keys in ConfigKeys root — rejected; mixing VS Code settings keys with globalState keys is confusing
