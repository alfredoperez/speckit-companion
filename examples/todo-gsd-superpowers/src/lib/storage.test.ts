import { describe, it, expect } from 'vitest'
import { load, save } from './storage'

describe('storage', () => {
  it('round-trips a value', () => {
    save('k', { a: 1, b: ['x'] })
    expect(load('k', null)).toEqual({ a: 1, b: ['x'] })
  })

  it('returns the fallback when nothing is stored', () => {
    expect(load('missing', 'fallback')).toBe('fallback')
  })
})
