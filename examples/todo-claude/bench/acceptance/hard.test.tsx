import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderApp, addTodo, navTo } from './harness'

describe('HARD — Tags feature', () => {
  it('creates a tag, assigns it, filters by it, and persists across remount', () => {
    const { unmount } = renderApp('/')

    // create a tag "Work" on the new Tags page
    navTo('Tags')
    fireEvent.change(screen.getByTestId('tag-name-input'), { target: { value: 'Work' } })
    fireEvent.click(screen.getByTestId('add-tag'))

    // back to todos: add one, assign Work (only one row exists at this point)
    navTo('Todos')
    addTodo('Buy milk')
    fireEvent.click(screen.getByTestId('assign-Work'))
    addTodo('Walk dog')

    // filter by Work → only the assigned todo is visible
    fireEvent.click(screen.getByTestId('filter-tag-Work'))
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.queryByText('Walk dog')).toBeNull()

    // show all → both visible
    fireEvent.click(screen.getByTestId('filter-tag-all'))
    expect(screen.getByText('Walk dog')).toBeInTheDocument()

    // remount with the same localStorage → todos and tags both survive
    unmount()
    renderApp('/')
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    navTo('Tags')
    expect(screen.getByText('Work')).toBeInTheDocument()
  })
})
