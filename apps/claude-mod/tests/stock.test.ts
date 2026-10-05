import { expect, test } from 'claude-code/testing'
import { FROM_FILES_NOTE, NO_RECORD_NOTE, activityLine, ago, bandLine, documentFacts, documentKind, documentLines, fileOverview, nextStepLine, paneModel, writtenAt, fileLink } from '../hooks/board.js'
import { buildSpecRow } from '../hooks/vendor/board-rules.mjs'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { BAND, PANE, ROOT, project, startSession, toText, withoutHints } from './harness.ts'

// A stock Spec Kit project: spec files and no run record. Times are local, so the clock texts read the same anywhere.
const today = (hours: number, minutes: number) => new Date(2026, 9, 4, hours, minutes).getTime()
const NOW = today(19, 30)
const ID = 'specs/001-clear-completed'
const path = (name: string) => `${ID}/${name}`

const SPEC = `# Feature Specification: Clear Completed Todos

**Feature Branch**: \`001-clear-completed\`

**Input**: User description: "Let me clear all completed todos with one button"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clear all completed todos at once (Priority: P1)

A person presses one button and every completed todo disappears.

### User Story 2 - Cleared todos stay gone (Priority: P1)

### User Story 3 - The button hides when it has nothing to do (Priority: P2)

## Requirements *(mandatory)*

- **FR-001**: The app MUST provide one control that removes all completed todos.
- **FR-002**: Activating the control MUST remove every todo marked as done.
- **FR-003**: The remaining todos MUST keep their order.
- **FR-004**: The removal MUST [NEEDS CLARIFICATION: Should clearing ask for confirmation?]
- **FR-005**: The removal MUST persist.
- **FR-006**: The control MUST be available only when a todo is done.
- **FR-007**: The control MUST update immediately.
- **FR-008**: The control MUST be operable by keyboard.
- **FR-009**: Cleared todos are kept for [NEEDS CLARIFICATION: Is there an undo, and for how long?]

## Success Criteria *(mandatory)*

- **SC-001**: A user can remove all completed todos with 1 action.
- **SC-002**: 100% of active todos remain.
- **SC-003**: The list reflects the clear in under 1 second.
- **SC-004**: Cleared todos stay gone after reopening.
`

const PLAN = `# Implementation Plan: Clear Completed Todos

**Branch**: \`001-clear-completed\` | **Spec**: [spec.md](./spec.md)

## Summary

Add one "Clear completed" button that removes every todo marked as done and saves the result.

## Project Structure

### Documentation (this feature)

\`\`\`text
specs/001-clear-completed/
├── plan.md              # This file
└── tasks.md             # Phase 2 output
\`\`\`

### Source Code (repository root)

\`\`\`text
index.html           # CHANGE: add the button
src/
├── app.js           # CHANGE: wire the button
├── store.js         # CHANGE: add clearCompleted(items)
└── store.test.js    # CHANGE: add tests
\`\`\`
`

const TASK_LINES = [
  ['Phase 1: Setup', 'T001 Run the existing tests'],
  ['Phase 2: Foundational', 'T002 [P] Add the store function in src/store.js'],
  ['Phase 2: Foundational', 'T003 [P] Add the store tests in src/store.test.js'],
  ['Phase 3: User Story 1 - Clear all completed todos at once (Priority: P1)', 'T004 [US1] Add the clear button to index.html'],
  ['Phase 3: User Story 1 - Clear all completed todos at once (Priority: P1)', 'T005 [US1] Wire the button in src/app.js'],
  ['Phase 4: User Story 2 - Cleared todos stay gone (Priority: P1)', 'T006 [US2] Save after clearing'],
  ['Phase 4: User Story 2 - Cleared todos stay gone (Priority: P1)', 'T007 [P] [US2] Test that a reload keeps the list'],
  ['Phase 5: Polish', 'T008 [P] Update the README'],
  ['Phase 5: Polish', 'T009 Run the quickstart'],
  ['Phase 5: Polish', 'T010 Run the whole suite'],
]
const tasks = (ticked: number) => {
  const lines = ['# Tasks: Clear Completed Todos', '', '## Format: `[ID] [P?] [Story] Description`']
  TASK_LINES.forEach(([phase, task], i) => {
    if (TASK_LINES[i - 1]?.[0] !== phase) lines.push('', `## ${phase}`, '')
    lines.push(`- [${i < ticked ? 'x' : ' '}] ${task}`)
  })
  return lines.join('\n') + '\n'
}

const CHECKLIST = '# Specification Quality Checklist\n\n## Content Quality\n\n- [x] No implementation details\n- [x] Focused on user value\n- [ ] No [NEEDS CLARIFICATION] markers remain\n'
const RESEARCH = '# Research\n\n## 1. Where the logic lives\n\n- **Decision**: A pure function.\n- **Rationale**: Testable.\n\n## 2. The label\n\n- **Decision**: "Clear completed".\n'
const DATA_MODEL = '# Data Model\n\n## Todo (unchanged)\n\n## New operation: clear completed\n\n## State transitions\n'

const WAITING_FOR_TASKS = { [path('spec.md')]: SPEC, [path('plan.md')]: PLAN, [path('checklists/requirements.md')]: CHECKLIST }
const WAITING_TIMES = { [path('spec.md')]: today(19, 14), [path('plan.md')]: today(19, 18), [path('checklists/requirements.md')]: today(19, 15) }
const MID_IMPLEMENT = {
  ...WAITING_FOR_TASKS,
  [path('tasks.md')]: tasks(3),
  [path('research.md')]: RESEARCH,
  [path('data-model.md')]: DATA_MODEL,
  [path('quickstart.md')]: '# Quickstart\n',
  [path('contracts/ui-contract.md')]: '# UI contract\n',
  [path('contracts/api.yaml')]: 'openapi: 3.1.0\n',
}
const IMPLEMENT_TIMES = { ...WAITING_TIMES, [path('tasks.md')]: today(19, 28), [path('research.md')]: today(19, 17) }

async function open($: any, on: any, files: Record<string, string>, mtimes: Record<string, number>, now = NOW) {
  const made = project(on, files, { mtimes })
  await made.clock.set(now)
  await startSession($)
  return made
}
const said = (element: any) => withoutHints(toText(element))
const paneText = async ($: any) => said(await (await $.ui.mount({ ...PANE, surface: 'terminal' })).find({ key: 'pane' }))
const bandText = async ($: any) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const text = toText(await ui.find({ key: 'speckit-band' }))
  await ui.unmount()
  return text
}

const HEAD = ['▸Run   Overview   Specs', 'Clear Completed Todos', '001-clear-completed']
const SPEC_LINE = ['spec  3 stories (2 P1, 1 P2) · 9 requirements · 4 success criteria', '  2 open questions']

test('a spec alone says when it was written, what comes next, and that nothing was recorded', async ($, on) => {
  await open($, on, { [path('spec.md')]: SPEC }, { [path('spec.md')]: today(19, 26) })
  expect(await bandText($)).toBe('○ 001-clear-completed · Specify written 4m ago · Plan next')
  expect(await paneText($)).toBe(
    [
      ...HEAD,
      'Waiting: plan next',
      ' ',
      'STEPS',
      '✓ Specify    written 7:26 PM',
      '○ Plan       not written yet',
      '○ Tasks      not written yet',
      '○ Implement ',
      NO_RECORD_NOTE,
      ' ',
      'DOCUMENTS',
      ...SPEC_LINE,
      ' ',
      'Next: /speckit-plan',
    ].join('\n'),
  )
})

test('a spec and a plan show the gap between them, and the pane waits for tasks', async ($, on) => {
  await open($, on, WAITING_FOR_TASKS, WAITING_TIMES)
  expect(await bandText($)).toBe('○ 001-clear-completed · Plan written 12m ago · Tasks next')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(said(await ui.find({ key: 'pane' }))).toBe(
    [
      ...HEAD,
      'Waiting: tasks next',
      ' ',
      'STEPS',
      '✓ Specify    written 7:14 PM',
      '✓ Plan       written 7:18 PM · 4m after the spec',
      '○ Tasks      not written yet',
      '○ Implement ',
      NO_RECORD_NOTE,
      ' ',
      'DOCUMENTS',
      ...SPEC_LINE,
      'plan  4 files named',
      'checklist: requirements  2 of 3 checked',
      ' ',
      'Next: /speckit-tasks',
    ].join('\n'),
  )
  expect((await ui.find({ type: 'Text', text: '· 4m after the spec' })).props.dimColor).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'written 7:18 PM' })).props.dimColor).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: NO_RECORD_NOTE })).props.dimColor).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'Waiting: tasks next' })).props.dimColor).toBe(true)
  expect((await ui.find({ type: 'Text', text: '  2 open questions' })).props.color).toBe('warning')
  expect(await ui.find({ type: 'Text', text: /No record|Timing coverage/ })).toBeUndefined()
})

test('mid-implement the pane counts the ticked tasks and names the one that is next', async ($, on) => {
  await open($, on, MID_IMPLEMENT, IMPLEMENT_TIMES)
  expect(await bandText($)).toBe('● 001-clear-completed ██░░░░░░ · Implement 3/10 · last change 2m ago')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(said(await ui.find({ key: 'pane' })).split('\n').slice(0, 22)).toEqual([
    ...HEAD,
    'Implementing: T004 next · Add the clear button to index.html',
    ' ',
    'STEPS',
    '✓ Specify    written 7:14 PM',
    '✓ Plan       written 7:18 PM · 4m after the spec',
    '✓ Tasks      written 7:28 PM',
    '● Implement  3 of 10 tasks · last change 2m ago',
    NO_RECORD_NOTE,
    ' ',
    'DOCUMENTS',
    ...SPEC_LINE,
    'plan  4 files named',
    'tasks  10 tasks in 5 phases · 4 can run in parallel',
    'research  2 decisions',
    'data-model',
    'quickstart',
    'checklist: requirements  2 of 3 checked',
    'contracts  2 files',
  ])
  expect(said(await ui.find({ key: 'pane' })).split('\n').pop()).toBe('Next: /speckit-implement')
  expect((await ui.find({ type: 'Text', text: '3 of 10 tasks' })).props.color).toBe('warning')
  expect((await ui.find({ type: 'Text', text: /^Implementing: T004 next/ })).props.color).toBe('warning')
  await ui.unmount()
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await band.find({ type: 'Text', text: 'Implement 3/10' })).props.color).toBe('warning')
  expect((await band.find({ type: 'Text', text: ' · last change 2m ago' })).props.dimColor).toBe(true)
})

test('the minutes move on by themselves, and ticked tasks left alone stop reading as running', async ($, on) => {
  const { clock } = await open($, on, MID_IMPLEMENT, IMPLEMENT_TIMES)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(said(await ui.find({ key: 'row-implement' }))).toBe('● Implement  3 of 10 tasks · last change 2m ago')
  await clock.advance(60000)
  expect(said(await ui.find({ key: 'row-implement' }))).toBe('● Implement  3 of 10 tasks · last change 3m ago')
  expect(await bandText($)).toBe('● 001-clear-completed ██░░░░░░ · Implement 3/10 · last change 3m ago')
  await clock.advance(8 * 60000)
  expect(said(await ui.find({ key: 'row-implement' }))).toBe('○ Implement  3 of 10 tasks · last change 11m ago')
  expect((await ui.find({ type: 'Text', text: '3 of 10 tasks' })).props.dimColor).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Waiting: T004 next · Add the clear button to index.html' })).toBeDefined()
})

test('a finished stock run ticks Implement and names no next step', async ($, on) => {
  await open($, on, { ...MID_IMPLEMENT, [path('tasks.md')]: tasks(10) }, IMPLEMENT_TIMES)
  expect(await bandText($)).toBe('● 001-clear-completed ████████ · Done · Tasks 10/10')
  const text = await paneText($)
  expect(text).toContain('All 10 tasks ticked')
  expect(text).toContain('✓ Implement  10 of 10 tasks')
  expect(text).not.toContain('Next:')
  expect(text).not.toContain('last change')
})

test('the activity line tells writing from waiting by how lately a file changed', async () => {
  const folder = (files: [string, number][]) => ({ contracts: null, files: files.map(([rel, mtimeMs]) => ({ rel, kind: documentKind(rel), mtimeMs, facts: rel === 'tasks.md' ? documentFacts('tasks', tasks(0)) : null })) })
  const row = {}
  const say = (files: [string, number][]) => activityLine(row, folder(files), NOW)
  expect(say([['spec.md', NOW - 60000]])).toEqual({ text: 'Writing the spec', live: true })
  expect(say([['spec.md', NOW - 180000]])).toEqual({ text: 'Waiting: plan next', live: false })
  expect(say([['spec.md', NOW - 600000], ['plan.md', NOW - 30000]])).toEqual({ text: 'Writing the plan', live: true })
  // The plan step writes its research after the plan file, and that is still the plan being written.
  expect(say([['spec.md', NOW - 600000], ['plan.md', NOW - 300000], ['research.md', NOW - 30000]])).toEqual({ text: 'Writing the plan', live: true })
  expect(say([['spec.md', NOW - 600000], ['plan.md', NOW - 300000]])).toEqual({ text: 'Waiting: tasks next', live: false })
  expect(say([['spec.md', NOW - 600000], ['plan.md', NOW - 300000], ['tasks.md', NOW - 30000]])).toEqual({ text: 'Writing the tasks', live: true })
  expect(say([['spec.md', NOW - 600000], ['plan.md', NOW - 300000], ['tasks.md', NOW - 300000]])).toEqual({ text: 'Waiting: implement next', live: false })
  expect(say([['notes.md', NOW]])).toEqual({ text: 'Waiting: specify next', live: false })
  expect(activityLine(row, null, NOW)).toBe(null)
})

test('a time today is a clock time, another day carries its date, and spans round down', async () => {
  expect(writtenAt(today(19, 14), NOW)).toBe('7:14 PM')
  expect(writtenAt(today(0, 5), NOW)).toBe('12:05 AM')
  expect(writtenAt(new Date(2026, 9, 3, 19, 14).getTime(), NOW)).toBe('Oct 3, 7:14 PM')
  expect([0, 59000, 60000, 59 * 60000, 3 * 3600000, 49 * 3600000, -5000].map(ago)).toEqual(['just now', 'just now', '1m ago', '59m ago', '3h ago', '2d ago', 'just now'])
})

test('every document line opens its file, and Back returns to that line', async ($, on) => {
  await open($, on, MID_IMPLEMENT, IMPLEMENT_TIMES)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const opens = [
    ['doc-spec.md', 'spec.md', SPEC],
    ['doc-research.md', 'research.md', RESEARCH],
    ['doc-checklists-requirements.md', 'checklists/requirements.md', CHECKLIST],
    ['doc-contracts', 'contracts/ui-contract.md', '# UI contract\n'],
  ]
  for (const [key, file, text] of opens) {
    expect((await ui.find({ key })).type).toBe('Button')
    await ui.press({ key })
    expect((await ui.find({ key: 'doc-path' })).props.text).toBe(fileLink(ROOT, path(file)))
    expect((await ui.find({ key: 'doc-0' })).props.text).toBe(text.trim())
    await ui.press({ key: 'doc-back' })
    expect((await ui.find({ key })).props.autoFocus).toBe(true)
  }
  expect((await ui.find({ key: 'step-plan' })).props.autoFocus).toBeUndefined()
})

test('a count the file does not give is left out, never shown as zero', async ($, on) => {
  const bare = '# Feature Specification: Bare\n\nAdd a thing people asked for.\n\n### User Story 1 - Use the thing\n\n### User Story 2 - Undo the thing (Priority: P2)\n'
  const files = {
    [path('spec.md')]: bare,
    [path('plan.md')]: '# Plan\n\n## Summary\n\nOne module and its tests, wired into the toolbar that every list page already shares.\n\n## Project Structure\n\n```text\nsrc/\n├── models/\n└── services/\n```\n',
    [path('tasks.md')]: '# Tasks\n\n- [ ] T001 Before any phase\n\n## Phase 1: Setup\n\n- [ ] T002 Inside one\n',
    [path('research.md')]: '# Research\n\n## Options\n\nWe looked at two.\n',
    [path('data-model.md')]: DATA_MODEL,
    [path('checklists/ux.md')]: '# UX\n\nNothing to tick.\n',
    [path('notes.md')]: '# Notes\n',
  }
  await open($, on, files, {})
  const lines = (await paneText($)).split('\n')
  const block = lines.slice(lines.indexOf('DOCUMENTS') + 1, lines.indexOf(' ', lines.indexOf('DOCUMENTS')))
  expect(block).toEqual([
    'spec  2 stories',
    'plan  One module and its tests, wired into the toolbar that every…',
    'tasks  2 tasks',
    'research',
    'data-model',
    'checklist: ux',
    'notes',
  ])
  expect(block.join('\n')).not.toMatch(/\b0 /)

  expect(documentFacts('spec', bare)).toMatchObject({ description: 'Add a thing people asked for.', requirements: [], success: [], questions: [] })
  expect(documentFacts('data-model', '# Data Model\n\n## Entities\n\n### Todo\n\n### List\n')).toEqual({ entities: 2 })
  expect(documentFacts('data-model', '## Entity: Todo\n')).toEqual({ entities: 1 })
  // A marker inside a code block or a comment is an example, not a question.
  expect(documentFacts('spec', '<!-- [NEEDS CLARIFICATION: example] -->\n```\n- **FR-001**: [NEEDS CLARIFICATION: example]\n```\n').questions).toEqual([])
  for (const junk of ['', '\u0000\u001b[1m', '#'.repeat(5000), '- [ ]\n'.repeat(50)]) {
    for (const kind of ['spec', 'plan', 'tasks', 'research', 'data-model', 'checklist']) expect(documentFacts(kind, junk)).toBeDefined()
  }
  expect(documentFacts('quickstart', '# Quickstart')).toBe(null)
  expect(documentFacts('spec', null)).toBe(null)
  expect(['spec.md', 'export.spec.md', 'plan.md', 'checklists/a.md', 'contracts/a.md', 'notes.md', 'checklists/deep/a.md'].map(rel => documentKind(rel, 'export.spec.md'))).toEqual(['other', 'spec', 'plan', 'checklist', 'contract', 'other', 'other'])
  expect(documentLines(null, null)).toEqual([])
})

test('the Overview of a stock project comes from its spec and plan', async ($, on) => {
  await open($, on, WAITING_FOR_TASKS, WAITING_TIMES)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-overview' })
  expect(said(await ui.find({ key: 'pane' })).split('\n').slice(4)).toEqual([
    ' ',
    'Let me clear all completed todos with one button',
    ' ',
    'USER STORIES',
    '- Clear all completed todos at once · P1',
    '- Cleared todos stay gone · P1',
    '- The button hides when it has nothing to do · P2',
    ' ',
    'OPEN QUESTIONS',
    '- Should clearing ask for confirmation?',
    '- Is there an undo, and for how long?',
    ' ',
    'REQUIREMENTS · 9',
    '- FR-001 The app MUST provide one control that removes all completed todos.',
    '- FR-002 Activating the control MUST remove every todo marked as done.',
    '- FR-003 The remaining todos MUST keep their order.',
    '- FR-004 The removal MUST [NEEDS CLARIFICATION: Should clearing ask for confirmation?]',
    '- FR-005 The removal MUST persist.',
    '4 more in the spec',
    ' ',
    'SUCCESS CRITERIA',
    '- SC-001 A user can remove all completed todos with 1 action.',
    '- SC-002 100% of active todos remain.',
    '- SC-003 The list reflects the clear in under 1 second.',
    '- SC-004 Cleared todos stay gone after reopening.',
    ' ',
    'PLAN SUMMARY',
    'Add one "Clear completed" button that removes every todo marked as done and saves the result.',
    ' ',
    FROM_FILES_NOTE,
  ])
  expect((await ui.find({ type: 'Text', text: '- Is there an undo, and for how long?' })).props.color).toBe('warning')
  expect((await ui.find({ type: 'Text', text: FROM_FILES_NOTE })).props.dimColor).toBe(true)
  expect((await ui.find({ type: 'Text', text: 'USER STORIES' })).props.bold).toBe(true)
  expect(await ui.find({ type: 'Text', text: /run record/ })).toBeUndefined()
})

test('an Overview with nothing to draw from says so, and a part the files lack is left out', async ($, on) => {
  await open($, on, { [path('spec.md')]: '# Feature Specification: Bare\n' }, {})
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-overview' })
  expect(await ui.find({ type: 'Text', text: 'The spec files have nothing to summarise yet.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: FROM_FILES_NOTE })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^(User stories|Open questions|Requirements|Success criteria|Plan summary)/i })).toBeUndefined()
  expect(fileOverview(null)).toMatchObject({ empty: true, stories: [], requirements: null })
})

test('a recorded run keeps its measured times, and gains the stories and questions its record lacks', async ($, on) => {
  const living = 'specs/_03_demo-living'
  const files = { ...DEMO_SPECS, [living + '/spec.md']: SPEC }
  const { clock } = project(on, files, { store: new Map([['follow:' + ROOT, living]]) })
  await clock.set(NOW)
  await startSession($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const run = said(await ui.find({ key: 'pane' }))
  for (const time of ['6m', '7m 30s', '2m 30s', '22m 30s', '38m 30s active']) expect(run).toContain(time)
  expect(run).toContain('_03_demo-living · Completed')
  expect(run).not.toMatch(/written \d|last change|Nothing recorded|Waiting|Next:/)
  expect(run).toContain(SPEC_LINE[0])
  await ui.press({ key: 'tab-overview' })
  const overview = said(await ui.find({ key: 'pane' }))
  expect(overview).toContain('INTENT')
  expect(overview).toContain('USER STORIES\n- Clear all completed todos at once · P1')
  expect(overview).toContain('OPEN QUESTIONS\n- Should clearing ask for confirmation?')
  expect(overview).not.toContain(FROM_FILES_NOTE)
  expect(overview).not.toContain('SUCCESS CRITERIA')
})

test('a recorded step nobody measured takes its file time, and a measured one never does', async () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 10, minutes)).toISOString()
  const entry = (step: string, kind: string, minutes: number) => ({ step, substep: null, kind, by: 'extension', at: at(minutes) })
  // Two starts leave the plan span untrusted, so the record has no time for it.
  const ctx = { status: 'implementing', currentStep: 'implement', history: [entry('specify', 'start', 0), entry('specify', 'complete', 4), entry('plan', 'start', 5), entry('plan', 'start', 7), entry('plan', 'complete', 12), entry('tasks', 'start', 13), entry('tasks', 'complete', 15), entry('implement', 'start', 16)] }
  const row = buildSpecRow({ id: ID, ctx, specText: SPEC, files: { spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md' }, tasksText: tasks(3), updatedAt: null })
  const folder = { contracts: null, files: [['spec.md', today(19, 14)], ['plan.md', today(19, 18)], ['tasks.md', today(19, 28)]].map(([rel, mtimeMs]) => ({ rel, kind: documentKind(rel as string), mtimeMs, facts: null })) }
  const model = paneModel(row, ctx, tasks(3), { folder, now: NOW })
  expect(model.steps.map((s: any) => [s.step, s.time, s.notes.map((n: any) => n.text).join(' ')])).toEqual([
    ['specify', '4m', ''],
    ['plan', null, 'written 7:18 PM · 4m after the spec'],
    ['tasks', '2m', ''],
    ['implement', null, ''],
  ])
  expect(model.footnote).toBe(null)
  expect(model.activity).toBe(null)
  expect(model.total).toBe('Timing coverage: 2 of 4 phases')
  expect(bandLine(row, ctx, folder, NOW)).toBe('Plan done · Tasks 3/10 · Implement running')
})

test('the next step names the stock command, or the Companion one with the spec folder', async ($, on) => {
  const row = (files: any, tasksText: string | null, ctx: any = null) => buildSpecRow({ id: ID, ctx, specText: null, files, tasksText, updatedAt: null })
  const all = { spec: 'spec.md', plan: 'plan.md', tasks: 'tasks.md' }
  expect(nextStepLine(row({ spec: null, plan: null, tasks: null }, null), null)).toBe('Next: /speckit-specify')
  expect(nextStepLine(row({ spec: 'spec.md', plan: null, tasks: null }, null), null)).toBe('Next: /speckit-plan')
  expect(nextStepLine(row({ spec: 'spec.md', plan: 'plan.md', tasks: null }, null), null, true)).toBe('Next: /speckit-companion-tasks specs/001-clear-completed')
  expect(nextStepLine(row(all, tasks(3)), null)).toBe('Next: /speckit-implement')
  expect(nextStepLine(row(all, tasks(10)), null)).toBe(null)
  const planned = { workflow: 'speckit-companion', status: 'planned', currentStep: 'plan', history: [] }
  expect(nextStepLine(row(all, null, planned), planned)).toBe('Next: /speckit-companion-tasks specs/001-clear-completed')
  // A record says which workflow ran, whatever skills the project has.
  expect(nextStepLine(row(all, null, { ...planned, workflow: 'speckit' }), { ...planned, workflow: 'speckit' }, true)).toBe('Next: /speckit-tasks')
  const implementing = { ...planned, status: 'implementing', currentStep: 'implement' }
  expect(nextStepLine(row(all, tasks(3), implementing), implementing)).toBe(null)
  const completed = { ...planned, status: 'completed', currentStep: 'implement' }
  expect(nextStepLine(row(all, tasks(10), completed), completed)).toBe(null)

  await open($, on, { ...WAITING_FOR_TASKS, '.claude/skills/speckit-companion-plan/SKILL.md': '# plan\n' }, WAITING_TIMES)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: 'Next: /speckit-companion-tasks specs/001-clear-completed' })).props.dimColor).toBe(true)
})

test('a file is read again only when its time or size changed', async ($, on) => {
  const files: Record<string, string> = { ...MID_IMPLEMENT }
  const mtimes: Record<string, number> = { ...IMPLEMENT_TIMES }
  const { clock, reads } = await open($, on, files, mtimes)
  const count = (name: string) => reads.filter(r => r === path(name)).length
  const counted = ['spec.md', 'plan.md', 'tasks.md', 'research.md', 'data-model.md', 'checklists/requirements.md']
  // Starting up reads the spec and the tasks once more, for the list of specs.
  const before = counted.map(count)
  expect(before).toEqual([2, 1, 2, 1, 1, 1])
  // A file with nothing to count is never read to draw the Run view.
  expect(count('quickstart.md') + count('contracts/ui-contract.md')).toBe(0)
  await clock.advance(9000)
  expect(counted.map(count)).toEqual(before)
  files[path('tasks.md')] = tasks(4)
  mtimes[path('tasks.md')] = NOW + 9000
  await clock.advance(3000)
  expect(counted.map(count)).toEqual([2, 1, 3, 1, 1, 1])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(said(await ui.find({ key: 'row-implement' }))).toBe('● Implement  4 of 10 tasks · last change just now')
})

test('where nothing draws, the text answer for a stock project reads like the band', async ($, on) => {
  const made = project(on, WAITING_FOR_TASKS, { mtimes: WAITING_TIMES, surfaces: [] })
  await made.clock.set(NOW)
  await startSession($)
  expect((await $.command.run({ command: 'spec', args: '1' })).text).toBe('Following 001-clear-completed\nPlan written 12m ago · Tasks next')
})
