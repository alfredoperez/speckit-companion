import { Priority, Todo } from '../types'

const PRIORITY_BADGES: Record<Priority, { label: string; background: string; color: string }> = {
  high: { label: 'High', background: '#c62828', color: '#fff' },
  medium: { label: 'Medium', background: '#f9a825', color: '#333' },
  low: { label: 'Low', background: '#2e7d32', color: '#fff' },
}

interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <li style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px',
      borderBottom: '1px solid #eee'
    }}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span style={{
        flex: 1,
        textDecoration: todo.completed ? 'line-through' : 'none',
        color: todo.completed ? '#888' : 'inherit'
      }}>
        {todo.text}
      </span>
      <span
        data-testid="priority-badge"
        style={{
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '12px',
          backgroundColor: PRIORITY_BADGES[todo.priority].background,
          color: PRIORITY_BADGES[todo.priority].color,
        }}
      >
        {PRIORITY_BADGES[todo.priority].label}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        style={{ padding: '4px 8px', cursor: 'pointer' }}
      >
        Delete
      </button>
    </li>
  )
}
