import { expect, test } from 'claude-code/testing'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { BAND, ROOT, project, startSession } from './harness.ts'

const bandFollows = async ($: any, name: string) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const found = await ui.find({ type: 'Text', text: name })
  await ui.unmount()
  return found
}

test('/spec <number> follows that spec, remembers it per project, and /spec auto lets it go', async ($, on) => {
  const files = { ...DEMO_SPECS, 'specs/042-export-csv/spec.md': '# Feature Specification: Export CSV\n' }
  const { store, opened } = project(on, files)
  await startSession($)
  expect(await bandFollows($, '_02_demo-tasked')).toBeDefined()

  expect(await $.command.run({ command: 'spec', args: '42' })).toEqual({})
  expect(store.get('follow:' + ROOT)).toBe('specs/042-export-csv')
  expect(await bandFollows($, '042-export-csv')).toBeDefined()
  expect(opened).toContain('speckit-companion')

  await $.command.run({ command: 'spec', args: 'auto' })
  expect(store.has('follow:' + ROOT)).toBe(false)
  expect(await bandFollows($, '_02_demo-tasked')).toBeDefined()
})

test('/spec <name> matches part of a folder name', async ($, on) => {
  const { store } = project(on, { ...DEMO_SPECS })
  await startSession($)
  await $.command.run({ command: 'spec', args: 'living' })
  expect(store.get('follow:' + ROOT)).toBe('specs/_03_demo-living')
})

test('a query that matches nothing says so and keeps the followed spec', async ($, on) => {
  const { store } = project(on, { ...DEMO_SPECS }, { store: new Map([['follow:' + ROOT, 'specs/_01_demo-planned']]) })
  await startSession($)
  const answer = await $.command.run({ command: 'spec', args: 'nothing-like-this' })
  expect(answer.text).toBe('No spec matches "nothing-like-this"')
  expect(store.get('follow:' + ROOT)).toBe('specs/_01_demo-planned')
  expect(await bandFollows($, '_01_demo-planned')).toBeDefined()
})

test('a remembered spec that was deleted falls back to the latest', async ($, on) => {
  project(on, { ...DEMO_SPECS }, { store: new Map([['follow:' + ROOT, 'specs/999-gone']]) })
  await startSession($)
  expect(await bandFollows($, '_02_demo-tasked')).toBeDefined()
})
