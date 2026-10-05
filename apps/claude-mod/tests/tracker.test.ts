import { expect, test } from 'claude-code/testing'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { BAND, PANE, ROOT, project, startSession } from './harness.ts'

test('registers /speckit-tracker and keeps /spec as an alias of it', async ($, on) => {
  const { commands } = project(on, { ...DEMO_SPECS })
  await startSession($)
  expect(commands.map(c => c.name)).toEqual(['speckit-tracker', 'spec'])
  expect(commands[1].description).toBe('Same as /speckit-tracker')
})

test('/speckit-tracker <number> follows a spec and /speckit-tracker auto lets it go, as /spec does', async ($, on) => {
  const files = { ...DEMO_SPECS, 'specs/042-export-csv/spec.md': '# Feature Specification: Export CSV\n' }
  const { store, opened } = project(on, files)
  await startSession($)
  expect(await $.command.run({ command: 'speckit-tracker', args: '42' })).toEqual({})
  expect(store.get('follow:' + ROOT)).toBe('specs/042-export-csv')
  expect(opened).toContain('speckit-companion')
  await $.command.run({ command: 'speckit-tracker', args: 'auto' })
  expect(store.has('follow:' + ROOT)).toBe(false)
  await $.command.run({ command: 'spec', args: 'export-csv' })
  expect(store.get('follow:' + ROOT)).toBe('specs/042-export-csv')
})

test('bare /speckit-tracker opens the pane on its Specs tab', async ($, on) => {
  project(on, { ...DEMO_SPECS })
  await startSession($)
  await $.command.run({ command: 'speckit-tracker', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'follow-auto' })).toBeDefined()
})

test('where nothing draws, /speckit-tracker answers in text and names itself', async ($, on) => {
  const { opened } = project(on, { ...DEMO_SPECS }, { surfaces: [] })
  await startSession($)
  const bare = await $.command.run({ command: 'speckit-tracker', args: '' })
  expect(bare.text).toContain('Following _02_demo-tasked (picked automatically): Plan done · Tasks 0/4 · Implement next')
  expect(bare.text).toContain('Run /speckit-tracker <number or name> to follow one, or /speckit-tracker auto to follow the latest.')
  expect((await $.command.run({ command: 'spec', args: '' })).text).toBe(bare.text)
  expect((await $.command.run({ command: 'speckit-tracker', args: 'planned' })).text).toBe('Following _01_demo-planned\nPlan done · Tasks next')
  expect(opened).toEqual([])
})

test('has three tabs on the hotkeys 1, 2 and 3', async ($, on) => {
  project(on, { ...DEMO_SPECS })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tabs = [
    ['tab-run', 'Run', '1'],
    ['tab-overview', 'Overview', '2'],
    ['tab-specs', 'Specs', '3'],
  ]
  for (const [key, label, hotkey] of tabs) {
    const tab = await ui.find({ key })
    expect(tab.props.label).toBe(label)
    expect(tab.props.hotkey).toBe(hotkey)
  }
  // The spec title and its status head every tab.
  for (const key of ['tab-overview', 'tab-specs', 'tab-run']) {
    await ui.press({ key })
    expect((await ui.find({ type: 'Text', text: 'Demo — Tasked' })).props.bold).toBe(true)
    expect(await ui.find({ type: 'Text', text: '_02_demo-tasked · Ready to Implement' })).toBeDefined()
  }
})

test('colours the running step in the band and in the pane with the theme warning colour', async ($, on) => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString()
  const entry = (step: string, kind: string, minutes: number) => ({ step, substep: null, kind, by: 'extension', at: at(minutes) })
  const ctx = {
    status: 'implementing',
    currentStep: 'implement',
    history: [entry('specify', 'start', 0), entry('specify', 'complete', 4), entry('plan', 'start', 5), entry('plan', 'complete', 9), entry('tasks', 'start', 10), entry('tasks', 'complete', 12), entry('implement', 'start', 13)],
  }
  project(on, {
    'specs/042-export-csv/.spec-context.json': JSON.stringify(ctx),
    'specs/042-export-csv/spec.md': '# Feature Specification: Export CSV\n',
    'specs/042-export-csv/plan.md': '# Plan\n',
    'specs/042-export-csv/tasks.md': '- [x] **T001** one\n- [ ] **T002** two\n',
  })
  await startSession($)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ type: 'Text', text: '042-export-csv' })).props.bold).toBe(true)
  expect((await band.find({ type: 'Text', text: ' · Plan done · Tasks 1/2 · ' })).props.dimColor).toBe(true)
  expect((await band.find({ type: 'Text', text: 'Implement running' })).props.color).toBe('warning')
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await pane.find({ type: 'Text', text: 'running' })).props.color).toBe('warning')
  expect((await pane.find({ type: 'Text', text: '●' })).props.color).toBe('warning')
  expect((await pane.find({ type: 'Text', text: '✓' })).props.color).toBe('green')
  expect((await pane.find({ type: 'Text', text: 'Tasks  1/2' })).props.bold).toBe(true)
})
