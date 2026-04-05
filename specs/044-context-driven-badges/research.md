# Research: Context-Driven Badges and Dates

## R1: Badge Text — Already Context-Driven?

**Decision**: `computeBadgeText()` in `phaseCalculation.ts:137-164` already derives badge text entirely from `.spec-context.json` fields (`step`, `next`, `task`, `status`). Returns `null` when no context exists (badge hidden).

**Rationale**: The badge infrastructure is complete. The only gap is that when `computeBadgeText()` returns `null` (no context), the badge area may still render as an empty container. Need to verify the HTML generator handles `null` by omitting the badge bar entirely.

**Findings**:
- `generator.ts:140` renders `<div class="spec-badge-bar">` only when `badgeText` is truthy — confirmed correct
- `navigation.ts:96-104` removes badge bar if `badgeText` is null — confirmed correct
- No markdown-derived badge values exist — the spec mentions ensuring "no hardcoded or markdown-derived badge values remain" which is already the case

**Action**: No changes needed for badge computation. Verify edge cases in tests.

## R2: Date Display — Current Markdown-Based Approach

**Decision**: Replace markdown frontmatter date parsing with `.spec-context.json` dates when context is available; omit dates when context is absent.

**Rationale**: `preprocessSpecMetadata()` in `preprocessors.ts:9-85` currently extracts dates from markdown lines like `**Created:** 2026-04-01`. This is unreliable because:
1. Dates in markdown can drift from actual workflow activity
2. Different markdown templates may format dates differently
3. No programmatic way to update dates when lifecycle actions occur

**Findings**:
- `FeatureWorkflowContext.stepHistory` already stores `startedAt`/`completedAt` per step — this is the authoritative source
- "Created" = `stepHistory.specify.startedAt` (or earliest `startedAt` across all steps)
- "Last Updated" = most recent timestamp across all `stepHistory` entries, or `context.updated` if present
- The `updated` field exists on the SDD-enriched context (set by AI agents when they modify context)

**Alternatives considered**:
1. Keep markdown dates as fallback when context missing — rejected per FR-004 (omit, don't fallback)
2. Backfill markdown dates into spec-context.json on first load — rejected (adds write-on-read side effect)

## R3: Date Format for Display

**Decision**: Use locale-friendly short date format: `"Apr 1, 2026"` (month abbreviation, day, year).

**Rationale**: Matches the style already used in markdown specs. ISO timestamps in `.spec-context.json` (e.g., `"2026-04-01T10:00:00Z"`) need formatting for display.

**Implementation**: Use `new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` in the extension side before passing to webview. This keeps formatting logic in Node.js (consistent across platforms) rather than in the webview.

## R4: Where to Compute and Pass Dates

**Decision**: Compute dates in the extension side (`specViewerProvider.ts`) and pass via `NavState` to the webview.

**Rationale**: This follows the existing pattern for `badgeText` — computed in the extension, passed through `NavState`, rendered in the webview. Keeps the webview as a thin rendering layer.

**Implementation**:
1. Add `createdDate?: string | null` and `lastUpdatedDate?: string | null` to `NavState`
2. Compute in `specViewerProvider.ts` from `featureCtx.stepHistory`
3. Pass through `contentUpdated` and `navStateUpdated` messages
4. Render in webview via `updateNavState()` and initial HTML generation

## R5: Preprocessor Behavior When Context Dates Exist

**Decision**: When context-driven dates are provided via NavState, the markdown preprocessor should skip rendering date items from markdown. When no context dates exist, the preprocessor should also skip dates (omit, per FR-004).

**Rationale**: FR-008 states markdown dates must no longer be used when `.spec-context.json` is present. FR-004 states missing context = omit entirely. This means the preprocessor should always skip date rendering — dates will come exclusively from NavState rendered in the HTML generator or updated dynamically.

**Implementation**:
1. Remove `'Created'`, `'Last Updated'`, `'Date'` from `recognizedFields` in `preprocessors.ts:38`
2. Dates rendered instead by `generator.ts` (initial load) using NavState date fields
3. Dates updated dynamically by `navigation.ts` `updateNavState()` function

## R6: Lifecycle Actions and Date Updates

**Decision**: Lifecycle actions (complete, archive, reactivate) already update `.spec-context.json` via `setSpecStatus()`. Step advances via `updateStepProgress()` already record `startedAt`/`completedAt` timestamps. No new write logic needed.

**Rationale**: The spec-context write path is complete. The viewer already refreshes NavState after lifecycle actions (`updateContent()` is called). Adding dates to NavState automatically propagates date updates through the existing message flow.

**Action**: No changes to `specContextManager.ts` or `messageHandlers.ts` write logic. Only the read/display path needs changes.
