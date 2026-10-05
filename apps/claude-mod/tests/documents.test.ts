import { expect, test } from 'claude-code/testing'
import { documentChunks, editorCommands, fileLink, paneModel, stepDocument, taskSummaryLines } from '../hooks/board.js'
import { buildSpecRow } from '../hooks/vendor/board-rules.mjs'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { PANE, ROOT, project, startSession, toText } from './harness.ts'

const follow = (id: string) => ({ store: new Map([['follow:' + ROOT, id]]) })
const at = (minutes: number, seconds = 0) => new Date(Date.UTC(2026, 0, 1, 10, minutes, seconds)).toISOString()
const entry = (step: string, kind: string, minutes: number, by = 'extension') => ({ step, substep: null, kind, by, at: at(minutes) })
const row = (ctx: any) =>
  buildSpecRow({ id: 'specs/007-small-fix', ctx, specText: null, files: { spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md' }, tasksText: '- [x] **T001** one\n', updatedAt: null })

test('pressing a step opens its document, and Back returns to the same step', async ($, on) => {
  project(on, { ...DEMO_SPECS }, follow('specs/_02_demo-tasked'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const opens = [
    ['specify', 'specs/_02_demo-tasked/spec.md'],
    ['plan', 'specs/_02_demo-tasked/plan.md'],
    ['tasks', 'specs/_02_demo-tasked/tasks.md'],
    ['implement', 'specs/_02_demo-tasked/tasks.md'],
  ]
  for (const [step, path] of opens) {
    expect((await ui.find({ key: 'step-' + step })).type).toBe('Button')
    await ui.press({ key: 'step-' + step })
    expect((await ui.find({ key: 'doc-path' })).props.text).toBe(fileLink(ROOT, path))
    const shown = await ui.find({ key: 'doc-0' })
    expect(shown.type).toBe('Markdown')
    expect(shown.props.text).toBe(DEMO_SPECS[path].trim())
    const back = await ui.find({ key: 'doc-back' })
    expect(back.props.hotkey).toBe('b')
    await ui.press({ key: 'doc-back' })
    expect(await ui.find({ key: 'doc-0' })).toBeUndefined()
    expect((await ui.find({ key: 'step-' + step })).props.autoFocus).toBe(true)
  }
  expect((await ui.find({ key: 'step-specify' })).props.autoFocus).toBeUndefined()
})

test('a step whose file is not written yet is not pressable and says so', async ($, on) => {
  project(on, { ...DEMO_SPECS }, follow('specs/_01_demo-planned'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'step-plan' })).toBeDefined()
  expect(await ui.find({ key: 'step-tasks' })).toBeUndefined()
  expect(await ui.find({ key: 'step-implement' })).toBeUndefined()
  const tasks = await ui.find({ key: 'row-tasks' })
  expect(JSON.stringify(tasks)).toContain('not written yet')
  expect(JSON.stringify(await ui.find({ key: 'row-plan' }))).not.toContain('not written yet')
})

test('the open document follows the file as the agent writes it', async ($, on) => {
  const files: Record<string, string> = { ...DEMO_SPECS }
  const { clock } = project(on, files, follow('specs/_02_demo-tasked'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'step-plan' })
  files['specs/_02_demo-tasked/plan.md'] = '# Plan\n\nA second draft.\n'
  await clock.advance(3000)
  expect((await ui.find({ key: 'doc-0' })).props.text).toBe('# Plan\n\nA second draft.')
  files['specs/_02_demo-tasked/plan.md'] = '# Plan\n\nA third draft.\n'
  await $.tool.call({ name: 'Write', input: {} })
  expect((await ui.find({ key: 'doc-0' })).props.text).toBe('# Plan\n\nA third draft.')
})

test('Implement lists what each finished task did above the task file', async ($, on) => {
  const ctx = JSON.parse(DEMO_SPECS['specs/_02_demo-tasked/.spec-context.json'])
  ctx.task_summaries = { T002: { status: 'DONE', did: 'Added the recent-items hook' }, T001: { status: 'DONE', did: 'Wrote the fuzzy matcher' }, T003: { status: 'DONE' } }
  project(on, { ...DEMO_SPECS, 'specs/_02_demo-tasked/.spec-context.json': JSON.stringify(ctx) }, follow('specs/_02_demo-tasked'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'step-implement' })
  expect((await ui.find({ type: 'Text', text: 'What each finished task did' })).props.bold).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'T001 Wrote the fuzzy matcher' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'T002 Added the recent-items hook' })).toBeDefined()
  expect((await ui.find({ key: 'doc-0' })).props.text).toContain('Phase 1: Core Implementation')
  await ui.press({ key: 'doc-back' })
  await ui.press({ key: 'step-tasks' })
  expect(await ui.find({ type: 'Text', text: 'What each finished task did' })).toBeUndefined()
  expect(taskSummaryLines(ctx).map(t => t.id)).toEqual(['T001', 'T002'])
})

test('a long file is split between paragraphs into pieces one element can hold', async () => {
  const paragraphs = Array.from({ length: 900 }, (_, i) => `Paragraph ${i} ` + 'word '.repeat(i % 40).trim())
  const text = paragraphs.join('\n\n')
  expect(text.length).toBeGreaterThan(60000)
  const { chunks, omitted, note } = documentChunks(text)
  expect(chunks.length).toBeGreaterThan(5)
  for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(10000)
  // Every piece is whole paragraphs, in order; only the last one can be the paragraph the limit cut.
  const shown = chunks.flatMap(chunk => chunk.split('\n\n'))
  shown.slice(0, -1).forEach((paragraph, i) => expect(paragraph).toBe(paragraphs[i]))
  expect(chunks.join('\n\n')).toBe(text.slice(0, 60000).trimEnd())
  expect(omitted).toBe(text.length - 60000)
  expect(note).toBe(`${(text.length - 60000).toLocaleString('en-US')} more characters not shown`)
})

test('a short file is one piece, a code fence stays whole, and control characters are dropped', async () => {
  expect(documentChunks('# Title\r\n\r\nBody\u001b[1m text\n')).toEqual({ chunks: ['# Title\n\nBody text'], omitted: 0, note: null })
  const fence = '```\n' + 'line\n\n'.repeat(40) + '```'
  const { chunks } = documentChunks('x'.repeat(9900) + '\n\n' + fence)
  expect(chunks).toEqual(['x'.repeat(9900), fence])
  expect(documentChunks('').chunks).toEqual([])
  for (const chunk of documentChunks('y'.repeat(25000)).chunks) expect(chunk.length).toBeLessThanOrEqual(10000)
})

test('the pane says how much of a file over the limit was left out', async ($, on) => {
  const long = Array.from({ length: 1500 }, (_, i) => `Paragraph ${i} of a very long plan document.`).join('\n\n')
  project(on, { ...DEMO_SPECS, 'specs/_02_demo-tasked/plan.md': long }, follow('specs/_02_demo-tasked'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'step-plan' })
  expect(await ui.find({ key: 'doc-6' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: `${(long.length - 60000).toLocaleString('en-US')} more characters not shown` })).toBeDefined()
})

test('a step folded into Specify reads "with Specify" and the run keeps a total', async ($, on) => {
  const ctx = { specName: 'Small fix', status: 'completed', currentStep: 'implement', history: [entry('specify', 'start', 0), entry('specify', 'complete', 4), entry('implement', 'start', 5), entry('implement', 'complete', 20)] }
  const model = paneModel(row(ctx), ctx, '')
  expect(model.steps.map(s => [s.step, s.time, s.folded])).toEqual([
    ['specify', '4m', false],
    ['plan', null, true],
    ['tasks', null, true],
    ['implement', '15m', false],
  ])
  expect(model.total).toBe('19m active')

  project(on, { 'specs/007-small-fix/.spec-context.json': JSON.stringify(ctx), 'specs/007-small-fix/spec.md': '# Small fix\n' })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: 'with Specify' })).props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: /Timing coverage/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: '19m active' })).toBeDefined()
})

test('a step that ran but was not measured is not called folded, and the coverage line stays', async () => {
  // Two starts make the plan span untrusted: it ran for minutes, and nobody can say how many.
  const ctx = {
    status: 'completed',
    currentStep: 'implement',
    history: [
      entry('specify', 'start', 0), entry('specify', 'complete', 4),
      entry('plan', 'start', 5), entry('plan', 'start', 7), entry('plan', 'complete', 12),
      entry('implement', 'start', 13), entry('implement', 'complete', 20),
    ],
  }
  const model = paneModel(row(ctx), ctx, '')
  expect(model.steps.find(s => s.step === 'plan')).toMatchObject({ time: null, folded: false })
  expect(model.steps.find(s => s.step === 'tasks')).toMatchObject({ time: null, folded: true })
  expect(model.total).toBe('Timing coverage: 2 of 4 phases')

  // A run still in flight has untimed steps that are not folded either.
  const running = { status: 'implementing', currentStep: 'implement', history: [entry('specify', 'start', 0), entry('specify', 'complete', 4), entry('implement', 'start', 5)] }
  expect(paneModel(row(running), running, '').total).toBe('Timing coverage: 1 of 4 phases')
})

test('each step opens its own file, and a step with no file opens nothing', async () => {
  const some = buildSpecRow({ id: 'specs/042-export-csv', ctx: null, specText: null, files: { spec: 'export-csv.spec.md', plan: 'plan.md', tasks: null }, tasksText: null, updatedAt: null })
  expect(['specify', 'plan', 'tasks', 'implement'].map(step => stepDocument(some, step))).toEqual(['specs/042-export-csv/export-csv.spec.md', 'specs/042-export-csv/plan.md', null, null])
})

test('every row with a file says Enter reads it, and the foot lists the keys', async ($, on) => {
  project(on, { ...DEMO_SPECS }, follow('specs/_01_demo-planned'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(toText(await ui.find({ key: 'row-plan' }))).toMatch(/ ↵ read$/)
  expect(toText(await ui.find({ key: 'row-doc-plan.md' }))).toMatch(/ ↵ read$/)
  expect((await ui.find({ type: 'Text', text: '↵ read' })).props.dimColor).toBe(true)
  // Tasks has no file yet, so nothing says it can be read.
  expect(toText(await ui.find({ key: 'row-tasks' }))).not.toContain('↵')
  expect(toText(await ui.find({ key: 'hints' }))).toBe(' 1  Run   2  Overview   3  Specs   ↵  Read   o  Editor   Esc  Prompt')
  await ui.press({ key: 'step-plan' })
  expect(toText(await ui.find({ key: 'doc-controls' }))).toBe('Back   Open in editor')
  expect((await ui.find({ key: 'open-editor' })).props.hotkey).toBe('o')
  expect(toText(await ui.find({ key: 'hints' }))).toBe(' 1  Run   2  Overview   3  Specs   b  Back   o  Editor   Esc  Prompt')
  await ui.press({ key: 'tab-specs' })
  expect(toText(await ui.find({ key: 'hints' }))).toBe(' 1  Run   2  Overview   3  Specs   Esc  Prompt')
})

test('o opens the open document in the editor, trying each command until one works', async ($, on) => {
  const { ran, toasts, copied } = project(on, { ...DEMO_SPECS }, { ...follow('specs/_02_demo-tasked'), env: { EDITOR: 'vim', TERM_PROGRAM: 'vscode' }, installed: ['open'] })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'step-plan' })
  await ui.press({ key: 'open-editor' })
  const file = ROOT + '/specs/_02_demo-tasked/plan.md'
  // vim needs the terminal, so it is never run; VS Code is not installed here, so the system opener takes it.
  expect(ran).toEqual([['code', file], ['open', file]])
  expect(toasts).toEqual(['Opened specs/_02_demo-tasked/plan.md with open'])
  expect(copied).toEqual([])
})

test('o on the Run tab opens the file of the step or document the focus is on', async ($, on) => {
  const { ran, toasts } = project(on, { ...DEMO_SPECS }, { ...follow('specs/_02_demo-tasked'), installed: ['code'] })
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'open-editor' })
  expect(ran).toEqual([])
  expect(toasts).toEqual(['Move to a step or a document first, then press o'])
  await $.ui.focus({ requestId: 'speckit-companion', key: 'step-tasks' })
  await ui.press({ key: 'open-editor' })
  await $.ui.focus({ requestId: 'speckit-companion', key: 'doc-spec.md' })
  await ui.press({ key: 'open-editor' })
  // Moving on to a tab keeps the last file, so pressing the control itself still has one to open.
  await $.ui.focus({ requestId: 'speckit-companion', key: 'tab-overview' })
  await ui.press({ key: 'open-editor' })
  expect(ran).toEqual([
    ['code', ROOT + '/specs/_02_demo-tasked/tasks.md'],
    ['code', ROOT + '/specs/_02_demo-tasked/spec.md'],
    ['code', ROOT + '/specs/_02_demo-tasked/spec.md'],
  ])
})

test('when no editor command works the path is copied instead', async ($, on) => {
  const { ran, toasts, copied } = project(on, { ...DEMO_SPECS }, follow('specs/_02_demo-tasked'))
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'step-plan' })
  await ui.press({ key: 'open-editor' })
  expect(ran.map(argv => argv[0])).toEqual(['code', 'open', 'xdg-open'])
  expect(copied).toEqual([ROOT + '/specs/_02_demo-tasked/plan.md'])
  expect(toasts).toEqual(['No editor command worked, so the path of specs/_02_demo-tasked/plan.md is on the clipboard'])
})

test('the editor is $VISUAL or $EDITOR when it has a window, then the terminal\'s own editor, then VS Code and the system opener', async () => {
  const first = (env: any) => editorCommands('/p/a.md', env)[0]
  expect(first({ visual: 'zed', editor: 'code' })).toEqual(['zed', '/p/a.md'])
  expect(first({ editor: '/usr/local/bin/code --wait --reuse-window' })).toEqual(['/usr/local/bin/code', '--reuse-window', '/p/a.md'])
  expect(first({ editor: 'nvim', termProgram: 'vscode', cursor: 'abc' })).toEqual(['cursor', '/p/a.md'])
  expect(first({ editor: 'nano', termProgram: 'vscode' })).toEqual(['code', '/p/a.md'])
  expect(editorCommands('/p/a.md', { editor: 'vim', termProgram: 'iTerm.app' })).toEqual([['code', '/p/a.md'], ['open', '/p/a.md'], ['xdg-open', '/p/a.md']])
  expect(editorCommands('/p/a.md')).toEqual([['code', '/p/a.md'], ['open', '/p/a.md'], ['xdg-open', '/p/a.md']])
})

test('the path of an open document is a file link, with what markdown would read as marks escaped', async () => {
  expect(fileLink('/work', 'specs/_02_demo-tasked/plan.md')).toBe('[specs/\\_02\\_demo-tasked/plan.md](file:///work/specs/_02_demo-tasked/plan.md)')
  expect(fileLink('/my work/', 'specs/a (b)/plan.md')).toBe('[specs/a (b)/plan.md](file:///my%20work/specs/a%20%28b%29/plan.md)')
  expect(fileLink('C:\\work', 'specs/a/plan.md')).toBe(null)
})
