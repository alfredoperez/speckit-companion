# Project Overview

This is a simple Todo application built with React and Vite. It allows users to add, delete, and mark todos as complete. The application state is managed within the main `App` component.

**Technologies:**

*   React
*   Vite
*   TypeScript

**Architecture:**

The application follows a simple component-based architecture. The main `App` component manages the state of the todos and passes down functions to the child components for manipulating the state.

*   `App.tsx`: The main application component that manages the todo list state.
*   `TodoList.tsx`: Renders the list of todos.
*   `TodoItem.tsx`: Represents a single todo item.
*   `AddTodo.tsx`: A form for adding new todos.
*   `types.ts`: Contains the TypeScript type definition for a todo.

# Building and Running

**Development:**

To run the application in development mode, use the following command:

```bash
npm run dev
```

This will start a development server, and you can view the application at `http://localhost:5173`.

**Building for Production:**

To build the application for production, use the following command:

```bash
npm run build
```

This will create a `dist` directory with the optimized production build.

**Previewing the Production Build:**

To preview the production build locally, use the following command:

```bash
npm run preview
```

# Development Conventions

*   The project uses functional components with hooks.
*   Styling is done using inline styles.
*   The project uses TypeScript for type safety.
*   The project uses Vite for bundling and development server.
