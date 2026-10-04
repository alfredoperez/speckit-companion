import { expect, test } from 'claude-code/testing'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { BAND, PANE, project } from './harness.ts'

// /reload-plugins loads the mod into a session that already started, so session.start never reaches it.

test('draws the band in a session that was already open when the mod loaded', async ($, on) => {
  project(on, { ...DEMO_SPECS })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '_02_demo-tasked' })).toBeDefined()
})

test('answers /spec in a session that was already open when the mod loaded', async ($, on) => {
  const { opened } = project(on, { ...DEMO_SPECS })
  await $.command.run({ command: 'spec', args: 'planned' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Demo — Planned' })).toBeDefined()
  expect(opened.length).toBeGreaterThan(0)
})

test('picks up a spec the agent writes after a tool call', async ($, on) => {
  const files: Record<string, string> = {}
  project(on, files)
  Object.assign(files, DEMO_SPECS)
  await $.tool.call({ name: 'Write', input: {} })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '_02_demo-tasked' })).toBeDefined()
})
