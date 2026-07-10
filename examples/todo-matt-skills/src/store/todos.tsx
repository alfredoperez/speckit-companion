import { createContext, useContext, useEffect, useReducer, ReactNode } from 'react'
import { Todo } from '../types'
import { load, save } from '../lib/storage'

const STORAGE_KEY = 'todos'

type Action =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'clearCompleted' }

export function todosReducer(state: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case 'add':
      return [
        ...state,
        { id: crypto.randomUUID(), text: action.text, completed: false, createdAt: new Date().toISOString() },
      ]
    case 'toggle':
      return state.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t))
    case 'delete':
      return state.filter((t) => t.id !== action.id)
    case 'clearCompleted':
      return state.filter((t) => !t.completed)
    default:
      return state
  }
}

interface TodosContextValue {
  todos: Todo[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  clearCompleted: () => void
}

const TodosContext = createContext<TodosContextValue | null>(null)

export function TodosProvider({ children }: { children: ReactNode }) {
  const [todos, dispatch] = useReducer(todosReducer, [], () => load<Todo[]>(STORAGE_KEY, []))

  useEffect(() => {
    save(STORAGE_KEY, todos)
  }, [todos])

  const value: TodosContextValue = {
    todos,
    addTodo: (text) => dispatch({ type: 'add', text }),
    toggleTodo: (id) => dispatch({ type: 'toggle', id }),
    deleteTodo: (id) => dispatch({ type: 'delete', id }),
    clearCompleted: () => dispatch({ type: 'clearCompleted' }),
  }

  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
}

export function useTodos(): TodosContextValue {
  const ctx = useContext(TodosContext)
  if (!ctx) throw new Error('useTodos must be used within a TodosProvider')
  return ctx
}
