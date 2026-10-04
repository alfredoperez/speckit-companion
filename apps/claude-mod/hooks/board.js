// What the band, the pane and the text replies say, from rows the shared board rules built. No IO.

import { PIPELINE_STEPS, currentTask, formatElapsed, listTasks, phaseTimings, stepTiming, timingSummaryText } from './vendor/board-rules.mjs'

const SEP = ' · '
// Optional Spec Kit phases, in the order they run around the pipeline; other history steps are not phases.
const STEP_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement', 'converge']
const RECENT = 10
const COMMAND = 'spec-tracker'
const ITEM_MAX = 400
const CHUNK_MAX = 10000
const DOC_MAX = 60000
const FOLD_MS = 1000
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

/** The most recently active unfinished spec, else the most recent one. Rows arrive sorted. */
export function defaultFollow(rows) {
  return rows.find(r => !r.done) ?? rows[0] ?? null
}

/** The band's facts in order, the one naming a running step marked; empty with no spec. */
export function bandParts(row, ctx) {
  if (!row) return []
  const { steps, tasks } = row
  const counted = tasks != null && tasks.total > 0
  const fact = text => (text ? { text, running: false } : null)
  const live = step => (step ? { text: `${cap(step)} running`, running: true } : null)
  const count = fact(counted ? `Tasks ${tasks.checked}/${tasks.total}` : null)
  if (row.done || steps.implement === 'completed') {
    const timings = ctx ? phaseTimings(ctx) : null
    // A phase after implement, such as converge, can still be running on a finished pipeline.
    const extra = timings?.phases.find(p => p.inFlight && STEP_ORDER.includes(p.step) && !PIPELINE_STEPS.includes(p.step))
    const tail = extra ? live(extra.step) : fact(timings?.totalMs != null ? `${formatElapsed(timings.totalMs)} active` : null)
    return [fact(row.status ? row.statusLabel : 'Done'), count, tail].filter(Boolean)
  }
  // The task count stands in for a finished tasks step, so it is not also named as done.
  const done = PIPELINE_STEPS.filter(s => steps[s] === 'completed' && !(s === 'tasks' && counted)).pop()
  const running = PIPELINE_STEPS.find(s => steps[s] === 'in-progress')
  const next = running ? null : PIPELINE_STEPS.find(s => steps[s] === 'not-started')
  return [fact(done ? `${cap(done)} done` : null), count, live(running), fact(next ? `${cap(next)} next` : null)].filter(Boolean)
}

/** "Plan done · Tasks 7/12 · Implement running" for a spec, or null with no spec. */
export function bandLine(row, ctx) {
  return row ? bandParts(row, ctx).map(p => p.text).join(SEP) : null
}

/** The file each pipeline step opens, relative to the workspace, or null while it is not written. */
export function stepDocument(row, step) {
  const file = { specify: row.files?.spec, plan: row.files?.plan, tasks: row.files?.tasks, implement: row.files?.tasks }[step]
  return file ? `${row.id}/${file}` : null
}

/** Plan or tasks finished inside the specify pass: done, with no span of its own, while specify has one. */
export function foldedSteps(row, ctx) {
  const timing = stepTiming(ctx ?? {})
  const measured = step => Boolean(timing[step]?.durationTrusted && timing[step].completedAt && !timing[step].folded)
  if (!measured('specify')) return []
  return ['plan', 'tasks'].filter(step => {
    if (row.steps[step] !== 'completed' || measured(step)) return false
    const entry = timing[step]
    if (!entry || entry.folded) return true
    return Boolean(entry.completedAt) && Math.abs(Date.parse(entry.completedAt) - Date.parse(entry.startedAt)) < FOLD_MS
  })
}

/** Everything the pane's Run view draws for the followed spec. */
export function paneModel(row, ctx, tasksText) {
  const timings = phaseTimings(ctx ?? {})
  const timeOf = step => timings.phases.find(p => p.step === step)
  const time = phase => (phase?.durationMs != null ? formatElapsed(phase.durationMs) : null)
  // The four pipeline steps always show; clarify, analyze and converge only once the record has them.
  const folded = foldedSteps(row, ctx)
  const steps = STEP_ORDER.flatMap(step => {
    const phase = timeOf(step)
    if (PIPELINE_STEPS.includes(step)) {
      return [{ step, label: cap(step), state: row.steps[step], time: time(phase), folded: folded.includes(step), document: stepDocument(row, step) }]
    }
    return phase ? [{ step, label: cap(step), state: phase.inFlight ? 'in-progress' : 'completed', time: time(phase), folded: false, document: null }] : []
  })
  // A folded step's time is inside Specify, so a run whose other steps are all measured still has a total.
  const measuredMs = PIPELINE_STEPS.map(step => timeOf(step)?.durationMs ?? null)
  const foldedOnly = folded.length > 0 && PIPELINE_STEPS.every((step, i) => measuredMs[i] != null || folded.includes(step))
  const summary = foldedOnly ? `${formatElapsed(measuredMs.reduce((sum, ms) => sum + (ms ?? 0), 0))} active` : timingSummaryText(timings)
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
    total: timings.phases.length ? summary : null,
    phases,
  }
}

/** The text reply for bare `/spec-tracker` where nothing draws. */
export function listText(followed, rows, pinned) {
  if (!rows.length) return 'No specs found'
  const lines = []
  if (followed) {
    lines.push(`Following ${followed.row.name}${pinned ? '' : ' (picked automatically)'}: ${bandLine(followed.row, followed.ctx)}`, '')
  }
  lines.push('Recent specs:')
  for (const row of rows.slice(0, RECENT)) lines.push(`  ${row.name}${SEP}${row.statusLabel}`)
  lines.push('', `Run /${COMMAND} <number or name> to follow one, or /${COMMAND} auto to follow the latest.`)
  return lines.join('\n')
}

/** The text reply after `/spec-tracker <query>` or `/spec-tracker auto` where nothing draws. */
export function followText(followed, pinned) {
  const lead = pinned ? `Following ${followed.row.name}` : `Following automatically: ${followed.row.name}`
  return `${lead}\n${bandLine(followed.row, followed.ctx)}`
}

// Escape sequences and control characters a record or a file can carry; an element takes neither.
const clean = value => String(value ?? '').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
const oneLine = value => clean(value).replace(/\s+/g, ' ').trim()
const clip = value => {
  const text = oneLine(value)
  return text.length > ITEM_MAX ? text.slice(0, ITEM_MAX - 1).trimEnd() + '…' : text
}
const list = value => (Array.isArray(value) ? value : [])
const names = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(v => String(v).trim()).filter(Boolean)

/** What the Overview tab shows, each part only when the record has it; null with no record. */
export function overviewModel(row, ctx) {
  if (!ctx) return null
  const size = typeof ctx.size === 'string' ? ctx.size : typeof ctx.classification?.verdict === 'string' ? ctx.classification.verdict : null
  const facts = [size ? `Size: ${oneLine(size)}` : null, row?.workflow ? `Workflow: ${oneLine(row.workflow)}` : null].filter(Boolean)
  const decisions = list(ctx.decisions)
    .map(d => (typeof d === 'string' ? { decision: clip(d), why: null } : { decision: clip(d?.decision), why: d?.why ? 'because ' + clip(d.why) : null }))
    .filter(d => d.decision)
  const verified = list(ctx.verified)
    .map(v => {
      if (typeof v === 'string') return { what: clip(v), result: null, failed: false }
      const exit = typeof v?.exitCode === 'number' ? v.exitCode : null
      const result = v?.result ? clip(v.result) : null
      // A measured exit code outranks the words of the result, which can say "0 failed".
      const failed = exit != null ? exit !== 0 : /^fail/i.test(result ?? '')
      return { what: clip(v?.what), result, failed, mark: failed ? (exit ? `failed (exit ${exit})` : 'failed') : null }
    })
    .filter(v => v.what)
  const coverage = ctx.coverage && typeof ctx.coverage === 'object' ? Object.values(ctx.coverage).filter(entry => entry && typeof entry === 'object') : []
  const model = {
    intent: typeof ctx.intent === 'string' && ctx.intent.trim() ? clip(ctx.intent) : null,
    approach: typeof ctx.approach === 'string' && ctx.approach.trim() ? clip(ctx.approach) : null,
    facts: facts.length ? facts.join(SEP) : null,
    expectations: list(ctx.expectations).map(clip).filter(Boolean),
    decisions,
    verified,
    concerns: list(ctx.concerns).map(c => clip(typeof c === 'string' ? c : c?.note)).filter(Boolean),
    requirements: coverage.length
      ? `Requirements: ${coverage.filter(entry => names(entry.tests).length > 0).length} covered by tests of ${coverage.length}`
      : null,
  }
  const empty = !model.intent && !model.approach && !model.facts && !model.requirements
    && !model.expectations.length && !model.decisions.length && !model.verified.length && !model.concerns.length
  return { ...model, empty }
}

/** What each finished task did, from the record's task summaries, in task order. */
export function taskSummaryLines(ctx) {
  const summaries = ctx?.task_summaries
  if (!summaries || typeof summaries !== 'object' || Array.isArray(summaries)) return []
  return Object.keys(summaries)
    .sort()
    .filter(id => typeof summaries[id]?.did === 'string' && summaries[id].did.trim())
    .map(id => ({ id, did: clip(summaries[id].did) }))
}

const cut = (text, max) => {
  const pieces = []
  for (let rest = text; rest; ) {
    if (rest.length <= max) {
      pieces.push(rest)
      break
    }
    const line = rest.lastIndexOf('\n', max)
    const end = line > 0 ? line : max
    pieces.push(rest.slice(0, end))
    rest = rest.slice(end).replace(/^\n/, '')
  }
  return pieces
}

/** A file's text as pieces one Markdown element each can hold, split between paragraphs, and how much was left out. */
export function documentChunks(text, max = CHUNK_MAX, limit = DOC_MAX) {
  const whole = clean(text)
  const shown = whole.length > limit ? whole.slice(0, limit) : whole
  const blocks = []
  let block = []
  let fence = false
  const close = () => {
    if (block.some(l => l.trim())) blocks.push(block.join('\n'))
    block = []
  }
  for (const line of shown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    // A blank line inside a code fence belongs to the code, so the fence stays in one piece.
    if (!line.trim() && !fence) close()
    else block.push(line)
  }
  close()
  const chunks = []
  let current = ''
  for (const paragraph of blocks.flatMap(b => (b.length > max ? cut(b, max) : [b]))) {
    if (current && current.length + 2 + paragraph.length > max) {
      chunks.push(current)
      current = ''
    }
    current = current ? current + '\n\n' + paragraph : paragraph
  }
  if (current) chunks.push(current)
  const omitted = whole.length - shown.length
  return { chunks, omitted, note: omitted ? `${omitted.toLocaleString('en-US')} more characters not shown` : null }
}
