# Implementation Plan: Create Spec Page — UX & Accessibility Overhaul

## Summary

Rework the spec-editor webview (a vanilla-DOM webview, not Preact) across three files — the server-rendered HTML template, the webview behavior script, and the stylesheet — to deliver a centered readable-width column, persistent accessible helper text, a gated **Create Spec** button, ARIA live announcements for errors/loading/attachments, accessible button names, a non-color over-limit gate, visible focus rings, landmark/heading fixes, a platform-correct keyboard hint, and an Esc-discard confirmation. Pure helpers (empty/over-limit submit gate, Mac detection, helper text) are extracted so they can be unit-tested without a webview harness. The Storybook mock is updated to match the new layout.

## Technical Context

- **Language/version**: TypeScript 5.3+ (ES2022, strict), VS Code Extension API (`@types/vscode ^1.84.0`), Preact only in Storybook mock.
- **Primary surfaces**: vanilla-DOM webview (`webview/src/spec-editor/index.ts`), server-rendered HTML string (`src/features/spec-editor/specEditorProvider.ts`), CSS (`webview/styles/spec-editor.css`), shared tokens (`webview/styles/tokens.css` — read-only here).
- **Storage**: N/A (UI-only change; draft persists via `vscode.setState` as today).
- **Testing**: Jest + ts-jest. New pure helpers get unit tests; webview DOM wiring stays review-only (known config/webview coverage gap).
- **Target platform**: VS Code webview (Chromium), all themes (dark/light/high-contrast) + reduced-motion.
- **Constraints**: extension ships in isolation — only `src/` + `webview/` + assets. Readable text uses `--text-body`/`--text-primary`. CSP forbids inline `onclick` handlers via nonce script-src — the existing `onclick="this.parentElement.remove()"` on the error close button must move to a delegated listener.

## Approach & Structure

Order of attack, by file:

1. **`webview/src/spec-editor/submitGate.ts` (new)** — pure helpers, no DOM:
   - `canSubmit(content: string, max: number): boolean` — `false` when trimmed-empty or `length > max`.
   - `isOverLimit(content: string, max: number): boolean`.
   - `shouldShowCharCount(count: number, max: number): boolean` — true at ≥90% of max.
   - `isMacPlatform(platform: string, userAgent: string): boolean` — Mac detection.
   - `helperText` / `subtitleText` constants (the persistent guidance + "what happens next" subtitle).
   These are imported by `index.ts` and exercised directly by tests.

2. **`src/features/spec-editor/specEditorProvider.ts` (HTML template ~l.585-650)**:
   - Wrap the content region in `<main>`; demote the attachments `<h3>` to `<h2>` (fix h1→h3 skip).
   - Rewrite the subtitle to say what the AI does next.
   - Add persistent `<p class="helper-text">` under the textarea label; drop the long mono placeholder (short or none).
   - `#error-container` gets `role="alert" aria-live="assertive"`.
   - Textarea gets `aria-describedby="charCount helperText"`; counter starts hidden.
   - Collapse the attachments section into a compact composer row; remove the dashed dropzone styling target.
   - Loading overlay gets `role="status" aria-live="polite" aria-busy` + visible+SR text "Creating your spec…".
   - Submit button → **Create Spec**, `disabled` by default; footer regrouped (Cancel + Create right, hints left).
   - Add an `aria-live="polite"` visually-hidden status region (`#sr-status`) for attach/remove announcements.

3. **`webview/src/spec-editor/index.ts`**:
   - Import the gate helpers; add `updateSubmitState()` called on input + after restore/init — toggles `submitBtn.disabled` via `canSubmit`.
   - `updateCharCount()` toggles counter visibility (`shouldShowCharCount`) and over-limit text; submit click + Ctrl/Cmd+Enter both early-return when `!canSubmit`.
   - `showError()` close button → accessible name + delegated listener (no inline `onclick`); set focus to error.
   - `setLoading()` toggles `aria-busy`/`aria-hidden` and overlay text.
   - `updateThumbnails()`/`removeImage()` write `#sr-status` ("Image <name> attached/removed"); remove buttons get `aria-label`.
   - Keyboard hint text built from `isMacPlatform(...)` (Cmd vs Ctrl) — applied in initial render and `updateCommandButtons()`.
   - Esc handler: if textarea has non-whitespace content, `confirm()` before posting `cancel`.

4. **`webview/styles/spec-editor.css`**:
   - Centered column: `max-width: 800px; margin: 0 auto` on the content wrapper (and footer/hints aligned to it).
   - Textarea `font-family: var(--font-family)` (proportional), helper text `--text-body` ≥4.5:1.
   - Visible `:focus-visible` outline on textarea, select, and all buttons; remove bare `outline:none` without replacement.
   - Remove dashed border / drag affordance on the attach button; composer-row layout.
   - Drop section-divider `border-top` rules; counter `.hidden` utility; over-limit `.error` with non-color cue handled in markup/text.
   - Footer single row: hints left, actions right.
   - `.sr-only` visually-hidden utility for the status region.

5. **`webview/src/spec-editor/CreateSpecMock.tsx` + stories** — update mock to the new layout (centered, helper text, Create Spec, disabled-empty, composer attachments, Cmd/Ctrl, footer grouping); add an `OverLimit`/`Empty-disabled` story variant.

## Out of Scope

- Implementing drag-and-drop attachment (explicitly removing the misleading affordance instead).
- Changing the submit/command message protocol or the extension-side submit handling.
- Reworking the install banner, workflow selector data flow, or image storage.
- Any change to `tokens.css` values (read-only here).

## Constitution Check

No constitution gates defined (`.specify/memory/constitution.md` absent or empty). Pass.
