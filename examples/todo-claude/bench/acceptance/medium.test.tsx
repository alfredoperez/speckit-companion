import { screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderApp, addTodo } from './harness'

describe('MEDIUM — Due dates', () => {
  it('flags only overdue todos and sorts ascending by due date', () => {
    renderApp()
    addTodo('alpha')
    addTodo('beta')

    const inputs = screen.getAllByTestId('due-date-input')
    // alpha (row 0) far future, beta (row 1) overdue → insertion order != sorted order
    fireEvent.change(inputs[0], { target: { value: '2999-12-31' } })
    fireEvent.change(inputs[1], { target: { value: '2000-01-01' } })

    expect(screen.getAllByTestId('overdue-badge')).toHaveLength(1)

    fireEvent.click(screen.getByTestId('sort-due'))
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('beta')).toBeInTheDocument()
    expect(within(rows[1]).getByText('alpha')).toBeInTheDocument()
  })
})
