import { useTodos } from '../store/todos'
import { AddTodo } from '../components/AddTodo'
import { TodoList } from '../components/TodoList'
import { sortByPriority } from '../lib/sortByPriority'

export function TodosPage() {
  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } = useTodos()
  const sortedTodos = sortByPriority(todos)
  const hasCompleted = todos.some((t) => t.completed)
  return (
    <section>
      <AddTodo onAdd={addTodo} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button
          onClick={clearCompleted}
          disabled={!hasCompleted}
          style={{ padding: '4px 8px', cursor: hasCompleted ? 'pointer' : 'not-allowed' }}
        >
          Clear completed
        </button>
      </div>
      <TodoList todos={sortedTodos} onToggle={toggleTodo} onDelete={deleteTodo} />
    </section>
  )
}
