# Implementation Plan: Track install rate and prompt→install conversion

**Feature dir**: `specs/523-install-prompt-telemetry` · **Spec**: [spec.md](./spec.md) · **Size**: normal

## Summary

Add three privacy-scrubbed telemetry signals to the existing VS Code extension telemetry so a maintainer can answer "how many active installs already have the companion spec-kit extension, and does the install banner convert?". One boolean (`companionInstalled`) rides the event that already fires on activation; a new `companion.installPrompt` event carries an `action` (`shown` / `clicked`) and a `surface` (`createSpec` / `activity`). All new fields are booleans or fixed enum literals — they never carry an identifier, path, or free text. The emit boundary and gates are the ones already in `src/core/telemetry.ts`; no reporter, connection string, or opt-in behavior changes.

## Project Structure

```
src/
├── extension.ts                                  # fireActivatedEvent → add companionInstalled boolean
├── core/
│   ├── telemetry.ts                              # new: reportInstallPromptShown/Clicked helpers + session dedupe
│   └── __tests__/telemetry.test.ts               # new: emit-proof tests (mock reporter)
├── features/
│   ├── spec-editor/specEditorProvider.ts         # emit shown('createSpec') when banner visible; emit clicked on Install msg
│   └── spec-viewer/
│       ├── specViewerProvider.ts                 # emit shown('activity') when computeShowInstallPrompt true
│       └── messageHandlers.ts                    # emit clicked('activity') on installSpecKitExtension msg
README.md                                         # Telemetry section: new signals + AppEvents sample query
CHANGELOG.md                                      # [Unreleased] user-facing entry
```

**Structure Decision**: The emit helpers live in `src/core/telemetry.ts` (the single scrubbing home), so the session-dedupe state and the allow-listed enums have exactly one owner. The four call sites (two render, two click) import those helpers rather than calling `sendTelemetryEvent` with ad-hoc property maps, keeping the privacy boundary in one file.

## Constitution Check

No `.specify/memory/constitution.md` governs this repo's `src/`. The binding rules are CLAUDE.md conventions and `.claude/review-checklist.md`; the relevant one is the **types & data boundaries** rule (coerce/allow-list at the emit boundary). This design satisfies it: `surface` and `action` are typed literals produced only by our own call sites — never sourced from user-authored data — so the values are fixed at compile time, not read from `settings.json`/`.spec-context.json`. PASS.

## Phase 0 — Key Decisions

See [research.md](./research.md).

## Phase 1 — Design

Types folded here (no separate data-model.md needed for two string-valued dimensions):

- `InstallPromptSurface = 'createSpec' | 'activity'` — the two banner surfaces.
- `InstallPromptAction = 'shown' | 'clicked'` — the two funnel moments.
- Event `companion.installPrompt` carries `{ action, surface }` (both strings on the wire, per `TelemetryProperties = Record<string,string>`).
- `extension.activated` gains `companionInstalled: 'true' | 'false'` (stringified boolean, matching the existing `specCount: String(n)` convention).

**Contract (event shapes)** — the pinned wire strings, from the spec's Verbatim Constraints:

| Event | Dimension | Values |
|-------|-----------|--------|
| `extension.activated` | `companionInstalled` | `"true"` \| `"false"` |
| `companion.installPrompt` | `action` | `"shown"` \| `"clicked"` |
| `companion.installPrompt` | `surface` | `"createSpec"` \| `"activity"` |

No REST/CLI/schema interface is exposed, so no `contracts/` directory.
