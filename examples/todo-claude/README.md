# Todo Test App

A minimal React + TypeScript + Vite todo application for testing AI CLI providers with SpecKit Companion.

## Purpose

This app has two roles:

1. **Provider test bed** — validating spec-driven development workflows across different AI CLI providers (Claude Code, Gemini CLI, GitHub Copilot CLI).
2. **Lean-vs-standard bench** — running the same feature through both the `companion-lean` and `companion-standard` template profiles, at three sizes, to compare correctness and speed. See [`bench/README.md`](./bench/README.md) (driven by the `/bench-prep` and `/bench-finish` Claude Code commands).

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Features to Implement

The bench defines three feature specs of graded scope (see [`bench/`](./bench/)) — any of them can also serve as a provider smoke test:

| Size | Scope | Feature |
|---|---|---|
| `easy` | update a route / title | Rename the app title to "Task Manager" |
| `medium` | add a feature to the todos | Due dates (input + overdue badge + sort) |
| `hard` | a whole new feature area | Tags (new `/tags` route + store slice + persistence + filter) |

The exact paste-in prompts live in `bench/prompts/{easy,medium,hard}.md`.

## Testing Procedure

- **Lean-vs-standard bench** (the primary use): follow [`bench/README.md`](./bench/README.md) — `/bench-prep` → run the pipeline in VS Code → `/bench-finish`.
- **Provider smoke test**: set the SpecKit Companion provider (Claude / Gemini / Copilot), open this folder in VS Code, initialize the CLI so its steering file appears, then implement one of the bench prompts via the spec workflow.

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
├── bench/                  # lean-vs-standard harness (prompts, oracle, scripts)
├── .specify/               # spec-kit workspace (templates, scripts, extensions)
├── index.html · package.json · tsconfig.json · vite.config.ts · vitest.config.ts
```

See [`CLAUDE.md`](./CLAUDE.md) for the conventions to follow when implementing a feature.
