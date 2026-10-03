// What the band, the pane and the text replies say, from rows the shared board rules built. No IO.

import { PIPELINE_STEPS, currentTask, formatElapsed, listTasks, phaseTimings, timingSummaryText } from './vendor/board-rules.mjs'

const SEP = ' · '
// Optional Spec Kit phases, in the order they run around the pipeline; other history steps are not phases.
const STEP_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement', 'converge']
const RECENT = 10
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/** The most recently active unfinished spec, else the most recent one. Rows arrive sorted. */
export function defaultFollow(rows) {
  return rows.find(r => !r.done) ?? rows[0] ?? null
}

/** "Plan done · Tasks 7/12 · Implement running" for a spec, or null with no spec. */
export function bandLine(row, ctx) {
  if (!row) return null
  const { steps, tasks } = row
  const counted = tasks != null && tasks.total > 0
  const count = counted ? `Tasks ${tasks.checked}/${tasks.total}` : null
  if (row.done || steps.implement === 'completed') {
    const timings = ctx ? phaseTimings(ctx) : null
    // A phase after implement, such as converge, can still be running on a finished pipeline.
    const extra = timings?.phases.find(p => p.inFlight && STEP_ORDER.includes(p.step) && !PIPELINE_STEPS.includes(p.step))
    const tail = extra ? `${cap(extra.step)} running` : timings?.totalMs != null ? `${formatElapsed(timings.totalMs)} active` : null
    return [row.status ? row.statusLabel : 'Done', count, tail].filter(Boolean).join(SEP)
  }
  // The task count stands in for a finished tasks step, so it is not also named as done.
  const done = PIPELINE_STEPS.filter(s => steps[s] === 'completed' && !(s === 'tasks' && counted)).pop()
  const running = PIPELINE_STEPS.find(s => steps[s] === 'in-progress')
  const next = running ? null : PIPELINE_STEPS.find(s => steps[s] === 'not-started')
  return [
    done ? `${cap(done)} done` : null,
    count,
    running ? `${cap(running)} running` : null,
    next ? `${cap(next)} next` : null,
  ].filter(Boolean).join(SEP)
}

/** Everything the pane's Run view draws for the followed spec. */
export function paneModel(row, ctx, tasksText) {
  const timings = phaseTimings(ctx ?? {})
  const timeOf = step => timings.phases.find(p => p.step === step)
  const time = phase => (phase?.durationMs != null ? formatElapsed(phase.durationMs) : null)
  // The four pipeline steps always show; clarify, analyze and converge only once the record has them.
  const steps = STEP_ORDER.flatMap(step => {
    const phase = timeOf(step)
    if (PIPELINE_STEPS.includes(step)) return [{ step, label: cap(step), state: row.steps[step], time: time(phase) }]
    return phase ? [{ step, label: cap(step), state: phase.inFlight ? 'in-progress' : 'completed', time: time(phase) }] : []
  })
  const inFlight = ctx ? currentTask(ctx) : null
  const phases = []
  for (const task of listTasks(tasksText ?? '')) {
    const name = task.phase ?? 'Tasks'
    let phase = phases.find(p => p.name === name)
    if (!phase) phases.push((phase = { name, checked: 0, total: 0, tasks: [] }))
    phase.total++
    if (task.checked) phase.checked++
    phase.tasks.push({ id: task.id, text: task.text, checked: task.checked, current: task.id === inFlight })
  }
  return {
    title: row.title,
    name: row.name,
    statusLabel: row.statusLabel,
    steps,
    total: timings.phases.length ? timingSummaryText(timings) : null,
    phases,
  }
}

/** The text reply for bare `/spec` where nothing draws. */
export function listText(followed, rows, pinned) {
  if (!rows.length) return 'No specs found'
  const lines = []
  if (followed) {
    lines.push(`Following ${followed.row.name}${pinned ? '' : ' (picked automatically)'}: ${bandLine(followed.row, followed.ctx)}`, '')
  }
  lines.push('Recent specs:')
  for (const row of rows.slice(0, RECENT)) lines.push(`  ${row.name}${SEP}${row.statusLabel}`)
  lines.push('', 'Run /spec <number or name> to follow one, or /spec auto to follow the latest.')
  return lines.join('\n')
}

/** The text reply after `/spec <query>` or `/spec auto` where nothing draws. */
export function followText(followed, pinned) {
  const lead = pinned ? `Following ${followed.row.name}` : `Following automatically: ${followed.row.name}`
  return `${lead}\n${bandLine(followed.row, followed.ctx)}`
}
