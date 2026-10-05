import { expect, test } from 'claude-code/testing'
import { bandLine, progressBar } from '../hooks/board.js'
import { buildSpecRow } from '../hooks/vendor/board-rules.mjs'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { BAND, ROOT, project, startSession, toText } from './harness.ts'

const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString()
const entry = (step: string, kind: string, minutes: number) => ({ step, kind, by: 'extension', at: at(minutes) })
const tasksText = (checked: number, total: number) =>
  Array.from({ length: total }, (_, i) => `- [${i < checked ? 'x' : ' '}] **T${String(i + 1).padStart(3, '0')}** task`).join('\n')
const row = (ctx: any, text: string | null, plan: string | null = 'plan.md') =>
  buildSpecRow({ id: 'specs/042-export-csv', ctx, specText: null, files: { spec: 'spec.md', plan, tasks: text ? 'tasks.md' : null }, tasksText: text, updatedAt: null })

test('names the last finished step, the task count and the step in flight', async () => {
  const ctx = {
    status: 'implementing',
    currentStep: 'implement',
    history: [entry('specify', 'start', 0), entry('specify', 'complete', 4), entry('plan', 'start', 5), entry('plan', 'complete', 9), entry('tasks', 'start', 10), entry('tasks', 'complete', 12), entry('implement', 'start', 13)],
  }
  expect(bandLine(row(ctx, tasksText(7, 12)), ctx)).toBe('Plan done · Tasks 7/12 · Implement running')
})

test('names the next step when nothing is running', async () => {
  const ctx = { status: 'specified', currentStep: 'specify', history: [entry('specify', 'start', 0), entry('specify', 'complete', 4)] }
  expect(bandLine(row(ctx, null, null), ctx)).toBe('Specify done · Plan next')
})

test('follows the files when a document exists that the record never heard of', async () => {
  const ctx = { status: 'specifying', currentStep: 'specify', history: [entry('specify', 'start', 0)] }
  expect(bandLine(row(ctx, null, null), ctx)).toBe('Specify running')
  expect(bandLine(row(ctx, null), ctx)).toBe('Plan done · Tasks next')
})

test('gives a finished spec its status, task count and active time', async () => {
  const ctx = {
    status: 'completed',
    currentStep: 'implement',
    history: [
      entry('specify', 'start', 0), entry('specify', 'complete', 4),
      entry('plan', 'start', 10), entry('plan', 'complete', 19),
      entry('tasks', 'start', 20), entry('tasks', 'complete', 22),
      entry('implement', 'start', 30), entry('implement', 'complete', 45),
    ],
  }
  expect(bandLine(row(ctx, tasksText(12, 12)), ctx)).toBe('Completed · Tasks 12/12 · 30m active')
  expect(bandLine(null, null)).toBe(null)
})

test('names a phase after implement that is still running instead of a final total', async () => {
  const ctx = {
    status: 'implemented',
    currentStep: 'converge',
    history: [
      entry('specify', 'start', 0), entry('specify', 'complete', 4),
      entry('plan', 'start', 10), entry('plan', 'complete', 19),
      entry('tasks', 'start', 20), entry('tasks', 'complete', 22),
      entry('implement', 'start', 30), entry('implement', 'complete', 45),
      entry('converge', 'start', 46),
    ],
  }
  expect(bandLine(row(ctx, tasksText(12, 12)), ctx)).toBe('Implemented · Tasks 12/12 · Converge running')
})

test('draws the band from a real run record, and ticks when a task is checked', async ($, on) => {
  const files: Record<string, string> = { ...DEMO_SPECS }
  const { clock } = project(on, files, { store: new Map([['follow:' + ROOT, 'specs/_02_demo-tasked']]) })
  await startSession($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: '_02_demo-tasked' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' · Plan done · Tasks 0/4 · ' })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: 'Implement next' })).props.color).toBe('warning')
  await ui.unmount()

  files['specs/_02_demo-tasked/tasks.md'] = files['specs/_02_demo-tasked/tasks.md'].replace('- [ ] **T001**', '- [x] **T001**')
  await clock.advance(3000)
  const again = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await again.find({ type: 'Text', text: ' · Plan done · Tasks 1/4 · ' })).toBeDefined()
  expect(await again.find({ type: 'Text', text: '██' })).toBeDefined()
})

test('redraws right after a tool call, and when a spec without a record gains a plan', async ($, on) => {
  const files: Record<string, string> = { 'specs/042-export-csv/spec.md': '# Feature Specification: Export CSV\n' }
  const mtimes: Record<string, number> = { 'specs/042-export-csv/spec.md': 1000 }
  const { clock } = project(on, files, { mtimes })
  await clock.set(4 * 60000 + 1000)
  await startSession($)
  const band = async (_?: string) => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const found = toText(await ui.find({ key: 'speckit-band' }))
    await ui.unmount()
    return found
  }
  expect(await band()).toBe('○ 042-export-csv · Specify written 4m ago · Plan next')
  files['specs/042-export-csv/plan.md'] = '# Plan\n'
  mtimes['specs/042-export-csv/plan.md'] = 4 * 60000
  await $.tool.call({ tool: 'Write', file_path: 'specs/042-export-csv/plan.md', content: '# Plan\n' })
  expect(await band()).toBe('○ 042-export-csv · Plan written just now · Tasks next')
})

test('draws nothing of its own in a project with no specs', async ($, on) => {
  project(on, { 'README.md': '# app' })
  await startSession($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Tasks|done|next/ })).toBeUndefined()
})

test('the task bar is drawn from real counts: empty at none, full only when every task is ticked', async () => {
  expect(progressBar(0, 8, 8)).toEqual({ filled: '', empty: '░░░░░░░░', done: false })
  expect(progressBar(1, 100, 8)).toEqual({ filled: '█', empty: '░░░░░░░', done: false })
  expect(progressBar(7, 8, 8)).toEqual({ filled: '███████', empty: '░', done: false })
  expect(progressBar(99, 100, 8).filled.length).toBe(7)
  expect(progressBar(8, 8, 8)).toEqual({ filled: '████████', empty: '', done: true })
  expect(progressBar(0, 0, 8)).toBe(null)
  expect(progressBar(1, 2, 0)).toBe(null)
})
