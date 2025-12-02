# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type-check and build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

This is a minimal React + TypeScript + Vite todo application used as a test bed for spec-driven development workflows with SpecKit Companion.

### Stack
- React 18 with functional components and hooks
- TypeScript with strict mode enabled
- Vite for bundling and dev server

### Code Structure

```
src/
├── App.tsx           # Root component, manages todo state
├── types.ts          # Todo interface definition
├── main.tsx          # React entry point
└── components/
    ├── AddTodo.tsx   # Form for creating todos
    ├── TodoItem.tsx  # Individual todo display
    └── TodoList.tsx  # Todo collection renderer
```

### State Management

All state lives in `App.tsx` using `useState`. Todo operations (add, toggle, delete) are defined there and passed down as props.

### Planned Features

Three features are designed to be implemented via specs in `.specify/specs/`:
- **due-dates/**: Date picker, overdue indicators, sort by due date
- **categories/**: Category management and filtering
- **priority-levels/**: Low/Medium/High priorities with color coding

When implementing a feature, check its `requirements.md` in the corresponding spec folder for acceptance criteria.
