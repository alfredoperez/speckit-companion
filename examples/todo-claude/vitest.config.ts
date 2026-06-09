import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Bench-only Vitest config. The acceptance suites under bench/acceptance are the
// hidden grading key for turbo-vs-standard runs — they render the real app and
// assert user-visible behavior, so they stay independent of whatever internal
// API a given run generates. They are NOT part of `tsc`/`vite build` (tsconfig
// only includes src/), so they never block a production build.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./bench/vitest.setup.ts'],
    // The app's own tests (src) verify the base + show patterns; the bench
    // oracle (bench/acceptance) grades a per-run feature. `npm test` runs both;
    // bench/finish.mjs runs one acceptance file by passing its path.
    include: ['src/**/*.test.{ts,tsx}', 'bench/acceptance/**/*.test.tsx'],
  },
})
