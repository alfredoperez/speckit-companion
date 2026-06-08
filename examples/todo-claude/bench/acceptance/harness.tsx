// Shared render helpers for the acceptance oracle. The app uses react-router +
// a store, so suites render it inside a MemoryRouter (the store provider lives
// inside App). Not a *.test.tsx file, so vitest imports it without running it.
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../src/App'

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

export function addTodo(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

export function navTo(linkName: string) {
  fireEvent.click(screen.getByRole('link', { name: linkName }))
}
