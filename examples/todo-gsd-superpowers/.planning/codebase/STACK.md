# Technology Stack

**Analysis Date:** 2026-07-10

## Languages

**Primary:**
- TypeScript 5.3+ - Entire application (`src/**/*.tsx`, `src/**/*.ts`)
- JSX/TSX - React component files (`src/components/`, `src/pages/`, `src/store/`)

**Secondary:**
- HTML5 - Entry point (`index.html`)
- CSS - Inline styles (no separate stylesheets)

## Runtime

**Environment:**
- Node.js 18+ (inferred from ES2020 target and vite/vitest compatibility)

**Browser:**
- ES2020+ target with DOM and DOM.Iterable support
- Uses standard APIs: `crypto.randomUUID()`, `localStorage`, `ReactDOM`

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.2.0 - UI library (`src/**/*.tsx`)
- react-router-dom 6.30.4 - Client-side routing (`src/App.tsx`, `src/pages/`)

**Build/Dev:**
- Vite 5.0+ - Build tool and dev server
  - Config: `vite.config.ts`
  - Entry point: `index.html`
  - Output: `dist/` (production build)
- Webpack 5 (implicit via Vite) - Module bundling

**Testing:**
- Vitest 1.6.0 - Test runner and assertion library
  - Config: `vitest.config.ts`
  - Environment: jsdom (browser simulation)
  - Setup file: `vitest.setup.ts`
- @testing-library/react 14.2.0 - React component testing utilities
- @testing-library/jest-dom 6.4.0 - DOM matchers for assertions
- jsdom 24.0.0 - JavaScript implementation of web standards for testing

## Key Dependencies

**Critical:**
- react@^18.2.0 - Core UI rendering
- react-dom@^18.2.0 - DOM bridge for React
- react-router-dom@^6.30.4 - Declarative routing for multi-page navigation

**Dev/Type Support:**
- @types/react@^18.2.0 - React type definitions
- @types/react-dom@^18.2.0 - React DOM type definitions
- @vitejs/plugin-react@^4.2.0 - JSX/Fast Refresh support in Vite

## Configuration

**TypeScript:**
- Target: ES2020
- Module: ESNext
- JSX: react-jsx (automatic JSX transform)
- Strict mode enabled
- Path resolution: bundler (Vite-compatible)
- File: `tsconfig.json`

**Build:**
- Vite config: `vite.config.ts`
  - React plugin for JSX processing
  - No custom entry point override (uses `index.html` default)
- Test config: `vitest.config.ts`
  - jsdom environment for DOM testing
  - Global test utilities (no need to import describe/it/expect)
  - Auto-cleanup between tests
  - Test files: `src/**/*.test.{ts,tsx}`

**Environment:**
- No environment variables configured (no `.env` file)
- Browser-only localStorage for persistence
- Development: `npm run dev` (Vite dev server)
- Production: `npm run build` (TypeScript check + Vite build)

## Platform Requirements

**Development:**
- Node.js 18+
- npm 8+ (for npm workspaces)
- VS Code (optional, recommended for workflow integration)

**Production:**
- Modern web browser supporting ES2020
- localStorage API availability
- No server-side requirements

**Browser Support:**
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES2020 support
- Requires Web Crypto API for `crypto.randomUUID()`

## Scripts

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # TypeScript check + Vite production build → dist/
npm run preview   # Preview production build locally
npm test          # Run Vitest once (all *.test.ts{,x} files)
```

## Notable Patterns

**Storage Abstraction:**
- All persistence via `src/lib/storage.ts` wrapper around `localStorage` with fallback handling (`src/lib/storage.test.ts` covers error cases)

**State Management:**
- React Context API (`TodosContext` in `src/store/todos.tsx`)
- useReducer for predictable state transitions
- Automatic persistence to localStorage on every state change

**Testing Setup:**
- `vitest.setup.ts` provides:
  - jsdom shim for `crypto.randomUUID()` (returns deterministic IDs for test assertions)
  - Auto-cleanup via `@testing-library/react`
  - `localStorage.clear()` between tests

---

*Stack analysis: 2026-07-10*
