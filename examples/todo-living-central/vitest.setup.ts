import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// App.tsx calls crypto.randomUUID(); jsdom may not provide it.
if (!globalThis.crypto) {
  // @ts-expect-error minimal shim for the test environment
  globalThis.crypto = {}
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let counter = 0
  // @ts-expect-error deterministic id is fine for behavioral assertions
  globalThis.crypto.randomUUID = () =>
    `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
