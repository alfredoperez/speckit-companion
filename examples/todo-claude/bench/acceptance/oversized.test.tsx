import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderApp, addTodo, navTo } from './harness'

describe('OVERSIZED — Boards feature', () => {
  it('creates a board and columns, moves a todo onto one, filters by board, and survives remount', () => {
    const { unmount } = renderApp('/')

    // create a board "Sprint" on the new Boards page
    navTo('Boards')
    fireEvent.change(screen.getByTestId('board-name-input'), { target: { value: 'Sprint' } })
    fireEvent.click(screen.getByTestId('add-board'))
    expect(screen.getByText('Sprint')).toBeInTheDocument()

    // open it and give it two columns
    fireEvent.click(screen.getByTestId('open-board-Sprint'))
    fireEvent.change(screen.getByTestId('column-name-input'), { target: { value: 'Todo' } })
    fireEvent.click(screen.getByTestId('add-column'))
    fireEvent.change(screen.getByTestId('column-name-input'), { target: { value: 'Doing' } })
    fireEvent.click(screen.getByTestId('add-column'))
    expect(screen.getByTestId('column-Todo')).toBeInTheDocument()
    expect(screen.getByTestId('column-Doing')).toBeInTheDocument()

    // back to todos: add two, put one on Sprint/Todo
    navTo('Todos')
    addTodo('Buy milk')
    fireEvent.click(screen.getByTestId('move-to-Sprint-Todo'))
    addTodo('Walk dog')

    // filter by board → only the assigned todo is visible
    fireEvent.click(screen.getByTestId('filter-board-Sprint'))
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.queryByText('Walk dog')).toBeNull()

    // unassigned filter → the other one
    fireEvent.click(screen.getByTestId('filter-board-unassigned'))
    expect(screen.getByText('Walk dog')).toBeInTheDocument()
    expect(screen.queryByText('Buy milk')).toBeNull()

    // all → both
    fireEvent.click(screen.getByTestId('filter-board-all'))
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(screen.getByText('Walk dog')).toBeInTheDocument()

    // deleting a column keeps its todos on the board rather than losing them
    navTo('Boards')
    fireEvent.click(screen.getByTestId('open-board-Sprint'))
    fireEvent.click(screen.getByTestId('delete-column-Todo'))
    expect(screen.getByText('Buy milk')).toBeInTheDocument()

    // remount with the same localStorage → boards, columns, and assignment survive
    unmount()
    renderApp('/')
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    navTo('Boards')
    expect(screen.getByText('Sprint')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('open-board-Sprint'))
    expect(screen.getByTestId('column-Doing')).toBeInTheDocument()
  })
})
