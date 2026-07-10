import { useState } from 'react'
import { Priority } from '../types'

interface AddTodoProps {
  onAdd: (text: string, priority: Priority) => void
}

export function AddTodo({ onAdd }: AddTodoProps) {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      onAdd(text.trim(), priority)
      setText('')
      setPriority('medium')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new todo..."
        style={{ padding: '8px', width: '300px', marginRight: '10px' }}
      />
      <select
        aria-label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        style={{ padding: '8px', marginRight: '10px' }}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button type="submit" style={{ padding: '8px 16px' }}>
        Add
      </button>
    </form>
  )
}
