# Factory load check

Run on 2026-11-12 against Factory at `64ddd6f9`, in a scratch folder outside both repos. Factory itself was not changed.

## Setup

- A scratch project linked `node_modules/speckit-viewer` to `packages/viewer`, the way a pnpm workspace or `file:` dependency would.
- Its `tsconfig.json` copied Factory's `tsconfig.base.json` (Bundler resolution, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`) with the web app's DOM libs.
- One test imported `SpecContextSchema` and the `SpecContext` and `NavState` types from `speckit-viewer/contract`, and `renderMarkdown` from `speckit-viewer/core`.
- It ran with Factory's own binaries from `apps/web/node_modules/.bin`: Vitest 5.0.3 (Vite resolving the `source` condition) and TypeScript 5.9.3.

## Proven

- Factory's Vitest loads both entry points from TypeScript source and the test passes: it parses the teamboard fixture's `.spec-context.json` with `SpecContextSchema.parse` and renders a spec to HTML. This is the call that replaces Factory's hand-written `contextOf`.
- No React, Preact or DOM is needed to do either.
- Plain Node loads the compiled build by package name (`packages/viewer/tests/node-import.test.ts`, in the Jest suite).

## Not proven

- **Type-checking under Factory's strict settings.** Factory's `tsc` reports 471 errors inside the package source, all from `noUncheckedIndexedAccess` (indexing arrays and regex matches without a guard). Factory's vendored copy hides the same errors with `@ts-nocheck`. Four `verbatimModuleSyntax` errors were fixed in this change. The fix belongs to V8: publish `.d.ts` declarations and point the `types` condition at them, so a consumer's `tsc` reads declarations (`skipLibCheck`) instead of re-checking source.
- **The view inside Factory.** `/element` and the Preact view are V5 and V6; nothing here renders the panel in Factory's React app.
- **Factory's real build.** Nothing ran inside Factory's own workspace, its pnpm install, or its production Vite build.
