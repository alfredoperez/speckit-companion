# Todo Test App

A minimal React + TypeScript + Vite todo application for testing AI CLI providers with SpecKit Companion.

## Purpose

This app serves as a test bed for validating spec-driven development workflows across different AI CLI providers:
- Claude Code
- Gemini CLI
- GitHub Copilot CLI

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

The app has three planned features (one per CLI provider) that can be implemented using specs:

### 1. Due Dates (Claude Code)
Add due date functionality to todos:
- Date picker for setting due dates
- Visual indicator for overdue items
- Sort by due date

### 2. Categories (Gemini CLI)
Add category/tagging support:
- Create and manage categories
- Assign categories to todos
- Filter by category

### 3. Priority Levels (GitHub Copilot CLI)
Add priority levels to todos:
- Low, Medium, High priority options
- Color-coded priority badges
- Sort by priority

## Testing Procedure

### Testing with Claude Code (Due Dates feature)
1. Set SpecKit Companion provider to "claude"
2. Open this folder in VS Code
3. Run `claude` to initialize (creates CLAUDE.md)
4. Verify CLAUDE.md appears in Steering view
5. Use spec workflow to implement the "Due Dates" feature

### Testing with Gemini CLI (Categories feature)
1. Set SpecKit Companion provider to "gemini"
2. Open this folder in VS Code
3. Run `gemini` to initialize (creates GEMINI.md)
4. Verify GEMINI.md appears in Steering view
5. Use spec workflow to implement the "Categories" feature

### Testing with GitHub Copilot CLI (Priority Levels feature)
1. Set SpecKit Companion provider to "copilot"
2. Open this folder in VS Code
3. Run `ghcs` to initialize (creates .github/copilot-instructions.md)
4. Verify copilot-instructions.md appears in Steering view
5. Use spec workflow to implement the "Priority Levels" feature

## Project Structure

```
todo-test-app/
├── src/
│   ├── components/
│   │   ├── AddTodo.tsx
│   │   ├── TodoItem.tsx
│   │   └── TodoList.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── types.ts
├── .specify/
│   └── specs/
│       ├── due-dates/
│       │   └── requirements.md
│       ├── categories/
│       │   └── requirements.md
│       └── priority-levels/
│           └── requirements.md
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
