import { expect, test } from 'claude-code/testing'
import { overviewModel } from '../hooks/board.js'
import { buildSpecRow } from '../hooks/vendor/board-rules.mjs'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { PANE, ROOT, project, startSession } from './harness.ts'

const FULL = {
  ...JSON.parse(DEMO_SPECS['specs/_03_demo-living/.spec-context.json']),
  intent: 'Export any list as a CSV file',
  approach: 'One pure serializer, called from the list toolbar',
  size: 'normal',
  expectations: ['Excel files', 'Scheduled exports'],
  decisions: [{ decision: 'Stream the rows', why: 'A large list must not be held in memory', rejected: 'Building one string' }, 'Quote every field'],
  verified: [
    { what: 'unit suite', command: 'npm test', exitCode: 0, result: '\u001b[1m212 passed\u001b[22m, 0 failed' },
    { what: 'type-check', command: 'npm run compile', exitCode: 2, result: '3 errors' },
    { what: 'manual export', result: 'Failed on a list of 10,000 rows' },
    'Opened the file in a spreadsheet',
  ],
  concerns: [{ note: 'Not tried on Windows line endings', step: 'implement' }, 'Dates use the browser locale'],
  coverage: { 'FR-001': { tasks: ['T001'], tests: ['csv.test.ts'] }, 'FR-002': { tasks: ['T002'] }, 'FR-003': { tasks: ['T003'], tests: 'a.test.ts, b.test.ts' } },
}
const SECTIONS = ['Intent', 'Approach', 'Expectations', 'Decisions', 'Verified', 'Concerns']
const living = (ctx: any) => ({ ...DEMO_SPECS, 'specs/_03_demo-living/.spec-context.json': JSON.stringify(ctx) })
const follow = { store: new Map([['follow:' + ROOT, 'specs/_03_demo-living']]) }

test('shows every part of a full record, in order', async ($, on) => {
  project(on, living(FULL), follow)
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-overview' })
  for (const title of SECTIONS) expect((await ui.find({ type: 'Text', text: title })).props.bold).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Export any list as a CSV file' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'One pure serializer, called from the list toolbar' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: 'Size: normal · Workflow: speckit-companion' })).props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: '- Scheduled exports' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '- Stream the rows' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: '  because A large list must not be held in memory' })).props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: '- Quote every field' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '  212 passed, 0 failed' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: 'failed (exit 2)' })).props.color).toBe('red')
  expect((await ui.find({ type: 'Text', text: /^failed$/ })).props.color).toBe('red')
  expect(await ui.find({ type: 'Text', text: '- Not tried on Windows line endings' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Requirements: 2 covered by tests of 3' })).toBeDefined()

  const model = overviewModel(buildSpecRow({ id: 'specs/_03_demo-living', ctx: FULL, specText: null, files: {}, tasksText: null, updatedAt: null }), FULL)
  expect(model.verified.map((v: any) => v.failed)).toEqual([false, true, true, false])
  expect(model.empty).toBe(false)
})

test('leaves out each part the record does not have', async ($, on) => {
  // The living demo's own record has an intent and a workflow, and nothing else for this tab.
  project(on, { ...DEMO_SPECS }, follow)
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-overview' })
  expect(await ui.find({ type: 'Text', text: 'Intent' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Workflow: speckit-companion' })).toBeDefined()
  for (const title of SECTIONS.slice(1)) expect(await ui.find({ type: 'Text', text: title })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^Requirements:/ })).toBeUndefined()

  const row = buildSpecRow({ id: 'specs/x', ctx: FULL, specText: null, files: {}, tasksText: null, updatedAt: null })
  const drop = (key: string) => overviewModel(row, { ...FULL, [key]: undefined })
  expect(drop('intent').intent).toBe(null)
  expect(drop('approach').approach).toBe(null)
  expect(drop('expectations').expectations).toEqual([])
  expect(drop('decisions').decisions).toEqual([])
  expect(drop('verified').verified).toEqual([])
  expect(drop('concerns').concerns).toEqual([])
  expect(drop('coverage').requirements).toBe(null)
  expect(overviewModel({ ...row, workflow: null }, { ...FULL, size: undefined }).facts).toBe(null)
  expect(overviewModel({ ...row, workflow: null }, { status: 'specified', history: [] }).empty).toBe(true)
})

test('cuts one long item at 400 characters and keeps every item of a long list', async () => {
  const ctx = { concerns: Array.from({ length: 60 }, (_, i) => `Concern ${i} ` + 'x'.repeat(i === 0 ? 900 : 5)) }
  const model = overviewModel(buildSpecRow({ id: 'specs/x', ctx, specText: null, files: {}, tasksText: null, updatedAt: null }), ctx)
  expect(model.concerns.length).toBe(60)
  expect(model.concerns[0].length).toBe(400)
  expect(model.concerns[0].endsWith('…')).toBe(true)
  expect(model.concerns[1]).toBe('Concern 1 xxxxx')
})

test('says the run record is missing when a spec has none', async ($, on) => {
  project(on, { 'specs/042-export-csv/spec.md': '# Feature Specification: Export CSV\n' })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-overview' })
  const missing = await ui.find({ type: 'Text', text: 'The run record is missing. The Companion Spec Kit extension writes it.' })
  expect(missing.props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Intent' })).toBeUndefined()
  expect(overviewModel(buildSpecRow({ id: 'specs/x', ctx: null, specText: null, files: {}, tasksText: null, updatedAt: null }), null)).toBe(null)
})
