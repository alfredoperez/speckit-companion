import { describe, it, expect } from 'vitest'
import { todosReducer } from './todos'
import { Todo } from '../types'

function todo(id: string, completed: boolean): Todo {
  return { id, text: `todo ${id}`, completed, createdAt: '2026-07-01T00:00:00.000Z' }
}

describe('todosReducer — clearCompleted', () => {
  it('removes completed todos and keeps active ones', () => {
    const state = [todo('a', true), todo('b', false), todo('c', true)]
    const next = todosReducer(state, { type: 'clearCompleted' })
    expect(next).toEqual([todo('b', false)])
  })

  it('is a no-op when no todos are completed', () => {
    const state = [todo('a', false), todo('b', false)]
    const next = todosReducer(state, { type: 'clearCompleted' })
    expect(next).toEqual(state)
  })

  it('is a no-op on an empty list', () => {
    const next = todosReducer([], { type: 'clearCompleted' })
    expect(next).toEqual([])
  })

  it('empties the list when every todo is completed', () => {
    const state = [todo('a', true), todo('b', true)]
    const next = todosReducer(state, { type: 'clearCompleted' })
    expect(next).toEqual([])
  })
})
