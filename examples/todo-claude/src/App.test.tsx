import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App', () => {
  it('shows the app title', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Todo App' })).toBeInTheDocument()
  })

  it('adds a todo and persists it across remounts', () => {
    const { unmount } = renderApp()
    fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: 'write spec' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('write spec')).toBeInTheDocument()

    unmount()
    renderApp()
    expect(screen.getByText('write spec')).toBeInTheDocument()
  })

  it('renders the About route', () => {
    renderApp('/about')
    expect(screen.getByTestId('about-page')).toBeInTheDocument()
  })
})
