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

describe('Clear completed', () => {
  function addTodo(text: string) {
    fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  }

  it('removes completed todos and keeps active ones', () => {
    renderApp()
    addTodo('done task')
    addTodo('active task')

    // complete only the first todo
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }))

    expect(screen.queryByText('done task')).not.toBeInTheDocument()
    expect(screen.getByText('active task')).toBeInTheDocument()
  })

  it('disables the button when nothing is completed', () => {
    renderApp()
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()

    addTodo('still active')
    expect(screen.getByRole('button', { name: 'Clear completed' })).toBeDisabled()
  })

  it('shows the empty state after clearing when all todos were completed', () => {
    renderApp()
    addTodo('only task')
    fireEvent.click(screen.getAllByRole('checkbox')[0])

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }))

    expect(screen.queryByText('only task')).not.toBeInTheDocument()
    expect(screen.getByText('No todos yet. Add one above!')).toBeInTheDocument()
  })

  it('persists the cleared result across remounts', () => {
    const { unmount } = renderApp()
    addTodo('done task')
    addTodo('active task')
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }))

    unmount()
    renderApp()

    expect(screen.queryByText('done task')).not.toBeInTheDocument()
    expect(screen.getByText('active task')).toBeInTheDocument()
  })
})
