import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

function addTodoWithPriority(text: string, priority?: string) {
  fireEvent.change(screen.getByPlaceholderText('Add a new todo...'), { target: { value: text } })
  if (priority) {
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: priority } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

function badgeFor(text: string) {
  const item = screen.getByText(text).closest('li')!
  return within(item).getByTestId('priority-badge')
}

describe('Priority badges', () => {
  it('defaults to a Medium badge when the selector is untouched', () => {
    renderApp()
    addTodoWithPriority('routine item')
    expect(badgeFor('routine item')).toHaveTextContent('Medium')
  })

  it('shows the chosen priority badge for each level', () => {
    renderApp()
    addTodoWithPriority('urgent item', 'high')
    addTodoWithPriority('normal item', 'medium')
    addTodoWithPriority('later item', 'low')

    expect(badgeFor('urgent item')).toHaveTextContent('High')
    expect(badgeFor('normal item')).toHaveTextContent('Medium')
    expect(badgeFor('later item')).toHaveTextContent('Low')
  })

  it('keeps the badge unchanged when a todo is toggled', () => {
    renderApp()
    addTodoWithPriority('urgent item', 'high')

    const item = screen.getByText('urgent item').closest('li')!
    fireEvent.click(within(item).getByRole('checkbox'))

    expect(badgeFor('urgent item')).toHaveTextContent('High')
  })

  it('keeps remaining badges unchanged after deleting a todo', () => {
    renderApp()
    addTodoWithPriority('urgent item', 'high')
    addTodoWithPriority('later item', 'low')

    const item = screen.getByText('urgent item').closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }))

    expect(screen.queryByText('urgent item')).not.toBeInTheDocument()
    expect(badgeFor('later item')).toHaveTextContent('Low')
  })

  it('persists priority across remounts', () => {
    const { unmount } = renderApp()
    addTodoWithPriority('urgent item', 'high')

    unmount()
    renderApp()

    expect(badgeFor('urgent item')).toHaveTextContent('High')
  })

  it('renders a pre-feature todo (no priority key) with a Medium badge', () => {
    localStorage.setItem(
      'todos',
      JSON.stringify([{ id: 'legacy-1', text: 'old item', completed: false, createdAt: '2026-01-01T00:00:00.000Z' }]),
    )

    renderApp()

    expect(badgeFor('old item')).toHaveTextContent('Medium')
  })
})

describe('Priority sorting', () => {
  function renderedTexts() {
    return screen.getAllByRole('listitem').map((li) => within(li).getByRole('checkbox').nextSibling!.textContent)
  }

  it('orders the list high, then medium, then low regardless of add order', () => {
    renderApp()
    addTodoWithPriority('low item', 'low')
    addTodoWithPriority('medium item', 'medium')
    addTodoWithPriority('high item', 'high')

    expect(renderedTexts()).toEqual(['high item', 'medium item', 'low item'])
  })

  it('keeps same-priority todos in the order they were added', () => {
    renderApp()
    addTodoWithPriority('first medium')
    addTodoWithPriority('high item', 'high')
    addTodoWithPriority('second medium')

    expect(renderedTexts()).toEqual(['high item', 'first medium', 'second medium'])
  })

  it('keeps the sorted order across remounts', () => {
    const { unmount } = renderApp()
    addTodoWithPriority('low item', 'low')
    addTodoWithPriority('high item', 'high')

    unmount()
    renderApp()

    expect(renderedTexts()).toEqual(['high item', 'low item'])
  })

  it('stays sorted after deleting a todo', () => {
    renderApp()
    addTodoWithPriority('low item', 'low')
    addTodoWithPriority('high item', 'high')
    addTodoWithPriority('medium item', 'medium')

    const item = screen.getByText('high item').closest('li')!
    fireEvent.click(within(item).getByRole('button', { name: 'Delete' }))

    expect(renderedTexts()).toEqual(['medium item', 'low item'])
  })

  it('stays sorted after Clear completed', () => {
    renderApp()
    addTodoWithPriority('low item', 'low')
    addTodoWithPriority('done high', 'high')
    addTodoWithPriority('medium item', 'medium')

    const doneItem = screen.getByText('done high').closest('li')!
    fireEvent.click(within(doneItem).getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }))

    expect(renderedTexts()).toEqual(['medium item', 'low item'])
  })
})
