# Todo Test App

A minimal React + TypeScript + Vite todo application for exercising spec-driven development with SpecKit Companion.

## Purpose

This app is the canonical example workspace: small enough to read in one sitting, complete enough that a real feature can be specified, planned, tasked and implemented in it end to end. Its siblings (`../todo-copilot`, `../todo-gemini`, `../todo-gsd-superpowers`, `../todo-matt-skills`, `../todo-living-central`, `../todo-living-colocated`) are the same app pointed at a different provider or a different layout — see [`../README.md`](../README.md) for the catalog.

## Getting Started

```bash
npm install
npm run dev       # Vite dev server
npm run build     # type-check (tsc) + production build
npm test          # Vitest
```

## Project Structure

```
todo-claude/
├── src/
│   ├── main.tsx            # entry — <BrowserRouter><App/></BrowserRouter>
│   ├── App.tsx             # <TodosProvider> + layout + <Routes>
│   ├── App.test.tsx
│   ├── types.ts
│   ├── lib/
│   │   ├── storage.ts      # load/save — all persistence goes through here
│   │   └── storage.test.ts
│   ├── store/
│   │   └── todos.tsx       # reducer + context + localStorage persistence
│   ├── components/         # Header, AddTodo, TodoItem, TodoList
│   └── pages/              # TodosPage, AboutPage (one per route)
├── .specify/               # spec-kit workspace (templates, scripts, extensions)
├── index.html · package.json · tsconfig.json · vite.config.ts · vitest.config.ts
```

See [`CLAUDE.md`](./CLAUDE.md) for the conventions to follow when implementing a feature.

## The benchmark lives elsewhere

The stock-vs-Companion benchmark used to run out of this folder. It now lives in its own repository, [`speckit-bench`](https://github.com/alfredoperez/speckit-bench), along with its results and the app it measures — so a bench round can never land in a product commit. The `/bench-*` commands in this repo drive it there.

The living-spec correctness matrix moved out of this folder too, to [`../living-specs-matrix/`](../living-specs-matrix/). It proves the resolver, drift, fold-back and coverage behave, which is evidence about the extension rather than a measurement of it — and it must not sit inside an app the harness clones, or every copy of that app would carry it.
