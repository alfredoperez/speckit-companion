import { screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { renderApp } from './harness'

describe('EASY — Rename app title', () => {
  it('shows the new title in the header', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Task Manager' })).toBeInTheDocument()
  })
})
