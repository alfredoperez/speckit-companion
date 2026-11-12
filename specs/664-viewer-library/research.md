# Research: speckit-viewer V1 to V4

## R1. Name, home and licence

- **Decision**: `speckit-viewer`, unscoped, at `packages/viewer`, MIT, `private: true`, version `0.0.0`. The name is provisional until V8.
- **Rationale**: approved by the owner's delegate. Both `speckit-viewer` and `@speckit-companion/viewer` were free on npm (404) on 2026-11-12.
- **Alternatives considered**: a `@speckit-companion` scope. Kept for later, if more packages follow.

## R2. Workspace without lockfile churn

- **Decision**: add `"workspaces": ["packages/*"]` and hand-add the three lockfile entries a workspace link needs. Prove the result with `npm ci`.
- **Rationale**: `npm install` on npm 12 re-resolved Storybook's nested Vite and dropped 38 lock entries, a dependency change nobody asked for. The hand edit is 12 lines and `npm ci` accepts it. The webview bundle stayed byte-identical (all five outputs `cmp` equal to main's).
- **Alternatives considered**: `npm install` (unwanted churn); `apps/*` as workspaces too (`apps/vscode` has no package of its own; the root is the extension).

## R3. How each runtime reaches the package

- **Decision**: the package's `exports` give each entry a `source` condition (TypeScript source) and a `default` condition (compiled CommonJS in `dist/`). `typesVersions` maps the same subpaths to the source for TypeScript's old node10 resolution. The webview and extension webpack builds resolve `source`. The host's `tsc` build (F5) and plain Node use `dist/`, built by `npm run build -w speckit-viewer`, which the root `pre*` scripts run.
- **Rationale**: the host `tsconfig.json` uses `rootDir: apps/vscode/src` and node10 resolution. Relative imports into `packages/` fail with TS6059. A file reached through `node_modules` is an external library to `tsc`: it is type-checked but neither emitted nor held to `rootDir` (checked in a scratch project). F5 runs `tsc` output, so it can only `require` JavaScript.
- **Alternatives considered**: widening `rootDir` (moves F5's `dist/extension.js` and the files `.vscodeignore` filters); project references (more config for the same result); leaving the host on its own copy of the types (two owners).

## R4. The renderer's one live value

- **Decision**: `/core` keeps `import { navState } from '../signals'` in `livingComponents.ts`, and `/core` ships `signals.ts` as a plain `{ value: null }` holder. The extension's webpack, Jest and webview `tsconfig` point that one module at the extension's real signal.
- **Rationale**: the code that runs in the extension is unchanged, so the bundle stays identical after normalization. The Copilot canvas already stubs this exact import, and with the stub in `/core` its plugin goes away. V5 replaces the seam with a passed-in value.
- **Alternatives considered**: a setter called by the extension at start-up (changes bundle code now, and V5 rewrites it anyway).

## R5. Schemas

- **Decision**: Zod 4 in `/contract`, used only by `schemas.ts`. `SpecContextSchema` validates the written shape (enums for step, status, kind and author; loose objects so unknown fields survive). `NavStateSchema` and `ViewerStateSchema` check their required fields. `ViewerMessageSchema` checks the `type` discriminant against every outgoing message; a type test keeps the list exhaustive both ways. The TypeScript interfaces stay hand-written; a type test asserts each schema's output is assignable to its interface.
- **Rationale**: converting 1,300 lines of interfaces to `z.infer` would change types across the extension in one go. Legacy files (`transitions`, `active`) still go through the host's `normalizeSpecContext` first; Factory reads files current writers produce.
- **Alternatives considered**: deriving the types from the schemas (too wide for this slice); the existing `spec-context.schema.json` with Ajv (a second validator dependency, and no TypeScript link).

## R6. What moves into `/core`

- **Decision**: the whole `markdown/` renderer except DOM files, and the pure derivations `relativeTime`, `timelineEvents`, `coverageState`, `activityHeroModel`, `overviewModel`, `stepInFlight`, plus `overviewAvailability` and `clarificationsIn` from the host. `ledger/refs.ts` splits: `linkifyIds` and `ownedBy` go to `/core`, `resolveLedgerRefs` (DOM) stays. `tasksInteractions.ts`, `storyDoc.tsx`, the stories and the DOM-bound modules (`toc`, `documentLinks`, `highlighting`, `ledgerRefs`, `messageHandlers`, `actions`) stay in the extension.
- **Rationale**: FR-005 bars DOM, Preact and `vscode` from `/core`. The host-side step-history derivation reads files through helpers that pull in the host; it stays (an expectation in the spec).
- **Alternatives considered**: moving the DOM helpers behind a guard (they are host behaviour; V5 territory).

## R7. Styles: tokens, themes and scoping

- **Decision**: the partials move to `packages/viewer/styles/` and read `--sk-*` theme tokens. Variables a rule sets for itself (`--callout-c`, `--w`, `--toc-*`) stay private. `viewer.css` imports `themes/light.css` first, so a host with no theme gets the default. Each theme file sets every token: `vscode.css` carries today's literal palette keyed on `body.vscode-light/dark`, the high-contrast block from `--vscode-*`, fonts from the editor, and today's role colours; `light.css`, `dark.css` and `ap-ui.css` take their role colours from `themes/roles.css` (info is not blue, high priority is warn, ids are neutral). Recolouring the extension is one line: import `roles.css` into `vscode.css`.
- **Decision**: scoping happens at build time. `packages/viewer/scripts/build-css.mjs` (PostCSS) inlines the partials and prefixes every selector with `:where(.sk-viewer)`, which adds no specificity, so the cascade between the viewer's rules is unchanged. `body` selectors become `:where(.sk-viewer)`. The extension adds `sk-viewer` to `<body>` and loads `dist/viewer.css` then `dist/themes/vscode.css`.
- **Rationale**: about 8,300 lines and 12 fully global partials. Prefixing by hand is error-prone; a build step keeps the source readable, as Factory's `vendor-css.mjs` already does. `:where()` keeps specificity, so only rules that targeted `body` itself lose one type selector; the computed-style diff shows whether any of them flips.
- **Alternatives considered**: `@scope` (Chromium 118+, above the engine floor's Electron); native nesting (raises specificity); prefixing the source with a script once (CLAUDE.md asks for edits, not script rewrites, and the result is unreadable).
- **Install banner**: `_install-banner.css` stays in the extension, because the spec editor imports it too. It reads `var(--sk-x, var(--x))`, so it works under both token sets.

## R8. Proving "unchanged"

- **Decision**: JS: build `package-web` on main and on the branch, strip webpack module ids and path comments, and diff. CSS: a headless Chromium (`playwright-core`, already a dependency) loads each viewer fixture story on main's and the branch's Storybook build, walks every element, and compares computed styles in light and dark. Neither keeps a screenshot.
- **Rationale**: the owner's delegate asked for both commands and their zero-difference results in the PR.
