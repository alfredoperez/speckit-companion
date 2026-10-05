import { expect, test } from 'claude-code/testing'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { PANE, ROOT, project, startSession } from './harness.ts'

test('shows each step with its measured time, the active total, and no billing for the waits', async ($, on) => {
  project(on, { ...DEMO_SPECS }, { store: new Map([['follow:' + ROOT, 'specs/_03_demo-living']]) })
  await startSession($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Demo — Living Specs' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '_03_demo-living · Completed' })).toBeDefined()
    for (const time of ['6m', '7m 30s', '2m 30s', '22m 30s']) {
      expect(await ui.find({ type: 'Text', text: time })).toBeDefined()
    }
    // 40 minutes passed from first start to last finish; the half-minute waits between steps are not billed.
    expect(await ui.find({ type: 'Text', text: '38m 30s active' })).toBeDefined()
    await ui.unmount()
  }
})

test('lists the tasks by phase and follows the latest unfinished spec by default', async ($, on) => {
  project(on, { ...DEMO_SPECS })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Demo — Tasked' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Phase 1: Core Implementation  0/4' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^○ T003 Palette modal/ })).toBeDefined()
})

test('switches the followed spec from the Specs view', async ($, on) => {
  const { store } = project(on, { ...DEMO_SPECS })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-specs' })
  expect(await ui.find({ key: 'follow-0' })).toBeDefined()
  // Rows are most recent first, so the completed living demo is the first one listed.
  await ui.press({ key: 'follow-0' })
  expect(store.get('follow:' + ROOT)).toBe('specs/_03_demo-living')
  expect(await ui.find({ type: 'Text', text: 'Demo — Living Specs' })).toBeDefined()
  await ui.press({ key: 'tab-specs' })
  await ui.press({ key: 'follow-auto' })
  expect(store.has('follow:' + ROOT)).toBe(false)
  expect(await ui.find({ type: 'Text', text: 'Demo — Tasked' })).toBeDefined()
})

test('opens by itself when the first spec of the session appears, and only once', async ($, on) => {
  const files: Record<string, string> = {}
  const { opened, clock } = project(on, files)
  await startSession($)
  await clock.advance(3000)
  expect(opened).toEqual([])
  Object.assign(files, DEMO_SPECS)
  await clock.advance(3000)
  expect(opened).toEqual(['speckit-companion'])
  // Closing it is the user's call, so nothing later opens it again.
  await clock.advance(3000)
  await $.tool.call({ name: 'Write', input: {} })
  await clock.advance(3000)
  expect(opened).toEqual(['speckit-companion'])
})

test('opens once at the start when a spec already exists, and never again by itself', async ($, on) => {
  const { opened, clock } = project(on, { ...DEMO_SPECS })
  await startSession($)
  expect(opened).toEqual(['speckit-companion'])
  await clock.advance(6000)
  expect(opened).toEqual(['speckit-companion'])
})

test('draws no pane for the first spec where nothing is drawn', async ($, on) => {
  const files: Record<string, string> = {}
  const { opened, clock } = project(on, files, { surfaces: ['vscode'] })
  await startSession($)
  Object.assign(files, DEMO_SPECS)
  await clock.advance(3000)
  expect(opened).toEqual([])
})
