# CLAUDE.md

Guidance for AI assistants working in this example app (the SpecKit Companion bench target).

## Development Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server
npm run build      # type-check (tsc) + production build (vite)
npm test           # Vitest (app tests in src/ + bench oracle in bench/)
npm run preview    # preview the production build
```

## What this is

A small but **layered, routed, tested** React + TypeScript + Vite todo app. It is intentionally realistic so spec-driven features have real surface to attach to. Keep it that way: follow the existing structure and conventions below when implementing a feature.

## Architecture

```
src/
├── main.tsx              # entry — <BrowserRouter><App/></BrowserRouter>
├── App.tsx               # <TodosProvider> + layout + <Routes>
├── types.ts              # domain types (Todo, …)
├── lib/
│   └── storage.ts        # load/save helpers — ALL persistence goes through here
├── store/
│   └── todos.tsx         # TodosProvider (reducer + context) + useTodos() hook; persists to localStorage
├── components/           # presentational, prop-driven (Header, AddTodo, TodoItem, TodoList)
└── pages/                # one component per route (TodosPage, AboutPage)
```

Routes: `/` → `TodosPage`, `/about` → `AboutPage`. The app title is the `<h1>` in `Header.tsx` (and `<title>` in `index.html`).

## Conventions (follow these when adding a feature)

- **State** lives in a store under `src/store/` (reducer + context, exposed via a `useXxx()` hook). New cross-component state → a new store slice in the same shape as `todos.tsx`, wrapped in `App.tsx`. Don't scatter `useState` across components for shared data.
- **Persistence** always goes through `src/lib/storage.ts` (`load`/`save`) with a string key. A store persists via a `useEffect` that saves on change and seeds its reducer with `load(...)`.
- **A new feature area** = a new `pages/` component + a `<Route>` in `App.tsx` + a nav `<Link>` in `Header.tsx` (+ a store slice if it owns data).
- **Components** stay presentational and prop-driven; pages wire them to the store.
- **Test ids**: when a spec asks for specific `data-testid` values, use them verbatim — the bench grades on them.
- **Tests**: co-locate as `*.test.tsx` next to the code (see `src/App.test.tsx`, `src/lib/storage.test.ts`). Render router-dependent components inside `<MemoryRouter>`.

## Bench

This app doubles as the turbo-vs-standard bench target. See `bench/README.md`. Don't edit `bench/stats.jsonl` or `bench/REPORT.md` (generated).
