import { useTodos } from '../store/todos'
import { AddTodo } from '../components/AddTodo'
import { TodoList } from '../components/TodoList'

export function TodosPage() {
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos()
  return (
    <section>
      <AddTodo onAdd={addTodo} />
      <TodoList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
    </section>
  )
}
