import { expect, test } from 'claude-code/testing'
import { DEMO_SPECS } from './fixtures/demo-specs.js'
import { project, startSession } from './harness.ts'

test('where nothing draws, bare /spec answers with the followed spec and the recent list', async ($, on) => {
  const { opened } = project(on, { ...DEMO_SPECS }, { surfaces: [] })
  await startSession($)
  const answer = await $.command.run({ command: 'spec', args: '' })
  expect(answer.text).toBe(
    [
      'Following _02_demo-tasked (picked automatically): Plan done · Tasks 0/4 · Implement next',
      '',
      'Recent specs:',
      '  _03_demo-living · Completed',
      '  _02_demo-tasked · Ready to Implement',
      '  _01_demo-planned · Planned',
      '  _00_demo-specified · Specified',
      '',
      'Run /spec-tracker <number or name> to follow one, or /spec-tracker auto to follow the latest.',
    ].join('\n'),
  )
  expect(opened).toEqual([])
})

test('where nothing draws, /spec <name> confirms the switch with the band line', async ($, on) => {
  project(on, { ...DEMO_SPECS }, { surfaces: ['vscode'] })
  await startSession($)
  const answer = await $.command.run({ command: 'spec', args: 'planned' })
  expect(answer.text).toBe('Following _01_demo-planned\nPlan done · Tasks next')
})

test('a project with no specs gets a one-line answer', async ($, on) => {
  project(on, { 'README.md': '# app' }, { surfaces: [] })
  await startSession($)
  expect((await $.command.run({ command: 'spec', args: '' })).text).toBe('No specs found')
})
