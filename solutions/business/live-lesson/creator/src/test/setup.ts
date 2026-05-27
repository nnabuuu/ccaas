import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Auto-unmount React trees between tests so DOM state doesn't leak
// from one test to the next. testing-library's `render` returns a
// container that lives until cleanup; without this we'd get stale
// nodes confusing `screen.getBy*` lookups.
afterEach(() => {
  cleanup()
})
