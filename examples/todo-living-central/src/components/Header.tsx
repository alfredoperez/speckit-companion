import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header style={{ marginBottom: '20px' }}>
      <h1>Todo App</h1>
      <nav style={{ display: 'flex', gap: '12px' }}>
        <Link to="/">Todos</Link>
        <Link to="/about">About</Link>
      </nav>
    </header>
  )
}
