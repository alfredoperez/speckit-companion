// What the band, the pane and the text replies say, from rows the shared board rules built. No IO.

import { PIPELINE_STEPS, currentTask, formatElapsed, listTasks, phaseTimings, stepTiming, timingSummaryText } from './vendor/board-rules.mjs'

const SEP = ' · '
// Optional Spec Kit phases, in the order they run around the pipeline; other history steps are not phases.
const STEP_ORDER = ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement', 'converge']
const RECENT = 10
const COMMAND = 'speckit-tracker'
const ITEM_MAX = 400
const CHUNK_MAX = 10000
const DOC_MAX = 60000
const FOLD_MS = 1000
const RECENT_MS = 2 * 60000
const TICKING_MS = 10 * 60000
const NOTE_MAX = 60
const TITLE_MAX = 120
const FIRST_REQUIREMENTS = 5
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOC_OF_STEP = { specify: 'spec', plan: 'plan', tasks: 'tasks' }
const STEP_OF_DOC = { spec: 'Specify', plan: 'Plan', tasks: 'Tasks' }
const GAP_AFTER = { plan: ['spec', 'the spec'], tasks: ['plan', 'the plan'] }
const PLAN_KINDS = ['plan', 'research', 'data-model', 'quickstart', 'contract']
export const NO_RECORD_NOTE = 'Times are when each file was last written. Nothing recorded this run.'
export const FROM_FILES_NOTE = 'From the spec files. Install the Companion Spec Kit extension to record step times, decisions and what was verified.'
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
// A file last written before the turn ended is finished, however lately that was; `settledAt` is when the last turn ended.
const lately = (at, now, within, settledAt) => at > 0 && now - at <= within && (settledAt == null || at > settledAt)

/** The most recently active unfinished spec, else the most recent one. Rows arrive sorted. */
export function defaultFollow(rows) {
  return rows.find(r => !r.done) ?? rows[0] ?? null
}

/** The band's facts in order, the one naming a running step marked; empty with no spec. */
export function bandParts(row, ctx, folder, now, settledAt = null) {
  if (!row) return []
  const { steps, tasks } = row
  const counted = tasks != null && tasks.total > 0
  const fact = text => (text ? { text, running: false } : null)
  if (!ctx && folder && now != null && !row.done) {
    const fromFiles = fileBandParts(row, folder, now, settledAt)
    if (fromFiles) return fromFiles
  }
  const live = step => (step ? { text: `${cap(step)} running`, running: true } : null)
  const upNext = step => (step ? { text: `${cap(step)} next`, running: false, next: true } : null)
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
  return [fact(done ? `${cap(done)} done` : null), count, live(running), upNext(next)].filter(Boolean)
}

/** The band of a run with no record: the last document written and how long ago, or the task count while tasks are ticked. */
function fileBandParts(row, folder, now, settledAt) {
  const written = kind => folder.files.find(f => f.kind === kind)?.mtimeMs || null
  const tasks = row.tasks
  if (tasks?.total > 0 && tasks.checked > 0) {
    const changed = written('tasks')
    const count = { text: `Implement ${tasks.checked}/${tasks.total}`, running: lately(changed, now, TICKING_MS, settledAt) }
    return changed != null ? [count, { text: `last change ${ago(now - changed)}`, running: false }] : [count]
  }
  const last = ['tasks', 'plan', 'spec'].find(kind => written(kind))
  if (!last) return null
  const next = PIPELINE_STEPS.find(s => row.steps[s] !== 'completed')
  return [
    { text: `${STEP_OF_DOC[last]} written ${ago(now - written(last))}`, running: false },
    ...(next ? [{ text: `${cap(next)} next`, running: false, next: true }] : []),
  ]
}

/** A bar of `width` cells for real task counts: full only when every task is ticked, never empty once one is. Null with no tasks. */
export function progressBar(checked, total, width) {
  if (!(total > 0) || !(width >= 1)) return null
  const done = checked >= total
  const share = Math.floor((Math.max(0, checked) / total) * width)
  const cells = done ? width : Math.min(width - 1, checked > 0 ? Math.max(1, share) : 0)
  return { filled: '█'.repeat(cells), empty: '░'.repeat(width - cells), done }
}

/** "Plan done · Tasks 7/12 · Implement running" for a spec, or null with no spec. */
export function bandLine(row, ctx, folder, now) {
  return row ? bandParts(row, ctx, folder, now).map(p => p.text).join(SEP) : null
}

/** "7:14 PM" for a time today, "Oct 3, 7:14 PM" for another day, in the local time zone. */
export function writtenAt(ms, now) {
  const d = new Date(ms)
  const n = new Date(now)
  const hours = d.getHours()
  const time = `${hours % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
  const today = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
  return today ? time : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`
}

/** "2m ago" for a span in milliseconds; under a minute, or a file time ahead of the clock, is "just now". */
export function ago(ms) {
  const minutes = Math.floor(ms / 60000)
  if (!(minutes >= 1)) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

const between = ms => {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return `${Math.floor(hours / 24)}d`
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`
}

/** What a step says from its file when nothing measured it: when it was written, or the task count for Implement. */
function fileNotes(step, row, folder, now, recorded, settledAt) {
  if (!folder || now == null) return []
  const written = kind => folder.files.find(f => f.kind === kind)?.mtimeMs || null
  if (step === 'implement') {
    const tasks = row.tasks
    if (recorded || !tasks?.total || !tasks.checked) return []
    const count = `${tasks.checked} of ${tasks.total} tasks`
    if (tasks.checked === tasks.total) return [{ text: count, tone: 'plain' }]
    const changed = written('tasks')
    const live = lately(changed, now, TICKING_MS, settledAt)
    return [{ text: count, tone: live ? 'running' : 'dim' }, ...(changed != null ? [{ text: `· last change ${ago(now - changed)}`, tone: 'dim' }] : [])]
  }
  const at = written(DOC_OF_STEP[step])
  if (!at) return []
  const notes = [{ text: `written ${writtenAt(at, now)}`, tone: 'plain' }]
  const [before, name] = GAP_AFTER[step] ?? []
  const earlier = before ? written(before) : null
  // Ticking a task rewrites tasks.md, so its time stops saying when the list was written.
  const ticked = step === 'tasks' && row.tasks?.checked > 0
  // Files checked out together are seconds apart, which says nothing about the run.
  if (earlier && at - earlier >= 60000 && !ticked) notes.push({ text: `· ${between(at - earlier)} after ${name}`, tone: 'dim' })
  return notes
}

/** The file each pipeline step opens, relative to the workspace, or null while it is not written. */
export function stepDocument(row, step) {
  const file = { specify: row.files?.spec, plan: row.files?.plan, tasks: row.files?.tasks, implement: row.files?.tasks }[step]
  return file ? `${row.id}/${file}` : null
}

const WINDOWED_EDITORS = ['code', 'code-insiders', 'codium', 'cursor', 'windsurf', 'zed', 'subl', 'mate', 'idea', 'webstorm', 'fleet']

/** The commands that could open a file in an editor window, in the order to try them: $VISUAL or $EDITOR, the editor whose terminal this is, VS Code, then the system's opener. */
export function editorCommands(path, env = {}) {
  const commands = []
  const add = argv => {
    if (!commands.some(c => c[0] === argv[0])) commands.push(argv)
  }
  for (const set of [env.visual, env.editor]) {
    const [bin, ...flags] = String(set ?? '').trim().split(/\s+/)
    const name = bin.split(/[\\/]/).pop().replace(/\.(exe|cmd)$/i, '')
    // vim and its kind need the terminal the pane is drawn in, so only an editor with a window of its own is run, and never told to wait.
    if (WINDOWED_EDITORS.includes(name)) add([bin, ...flags.filter(f => f !== '-w' && f !== '--wait'), path])
  }
  if (/vscode|cursor/i.test(env.termProgram ?? '')) add([env.cursor || /cursor/i.test(env.termProgram) ? 'cursor' : 'code', path])
  for (const bin of ['code', 'open', 'xdg-open']) add([bin, path])
  return commands
}

/** A markdown link that shows a workspace path and points at the file itself, for a terminal that opens file links; null off POSIX paths. */
export function fileLink(root, path) {
  if (typeof root !== 'string' || !root.startsWith('/')) return null
  const href = 'file://' + encodeURI(root.replace(/\/+$/, '') + '/' + path).replace(/[()#?]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `[${path.replace(/[\\\[\]_*`<>]/g, '\\$&')}](${href})`
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
export function paneModel(row, ctx, tasksText, { folder = null, now = null, companionSkills = false, settledAt = null } = {}) {
  const recorded = Boolean(ctx)
  const fromFiles = !recorded && folder != null && now != null
  const timings = phaseTimings(ctx ?? {})
  const timeOf = step => timings.phases.find(p => p.step === step)
  const time = phase => (phase?.durationMs != null ? formatElapsed(phase.durationMs) : null)
  // The four pipeline steps always show; clarify, analyze and converge only once the record has them.
  const folded = foldedSteps(row, ctx)
  const steps = STEP_ORDER.flatMap(step => {
    const phase = timeOf(step)
    if (PIPELINE_STEPS.includes(step)) {
      const measured = time(phase)
      const isFolded = folded.includes(step)
      const state = row.steps[step]
      // A step takes its file's time only when nothing measured it, so the two never share a line.
      const silent = measured || isFolded || (recorded && state !== 'completed')
      const notes = silent ? [] : fileNotes(step, row, folder, now, recorded, settledAt)
      // Without a record, tasks ticked a while ago do not mean Implement is running now.
      const stalled = fromFiles && step === 'implement' && state === 'in-progress' && notes[0]?.tone !== 'running'
      return [{ step, label: cap(step), state: stalled ? 'not-started' : state, time: measured, folded: isFolded, document: stepDocument(row, step), notes }]
    }
    return phase ? [{ step, label: cap(step), state: phase.inFlight ? 'in-progress' : 'completed', time: time(phase), folded: false, document: null, notes: [] }] : []
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
    tasks: { checked: phases.reduce((sum, p) => sum + p.checked, 0), total: phases.reduce((sum, p) => sum + p.total, 0) },
    recorded,
    footnote: fromFiles && steps.some(st => st.notes.length) ? NO_RECORD_NOTE : null,
    activity: recorded ? null : activityLine(row, folder, now, settledAt),
    documents: documentLines(row, folder),
    next: nextStepLine(row, ctx, companionSkills),
  }
}

/** The text reply for bare `/speckit-tracker` where nothing draws. */
export function listText(followed, rows, pinned, now) {
  if (!rows.length) return 'No specs found'
  const lines = []
  if (followed) {
    lines.push(`Following ${followed.row.name}${pinned ? '' : ' (picked automatically)'}: ${bandLine(followed.row, followed.ctx, followed.folder, now)}`, '')
  }
  lines.push('Recent specs:')
  for (const row of rows.slice(0, RECENT)) lines.push(`  ${row.name}${SEP}${row.statusLabel}`)
  lines.push('', `Run /${COMMAND} <number or name> to follow one, or /${COMMAND} auto to follow the latest.`)
  return lines.join('\n')
}

/** The text reply after `/speckit-tracker <query>` or `/speckit-tracker auto` where nothing draws. */
export function followText(followed, pinned, now) {
  const lead = pinned ? `Following ${followed.row.name}` : `Following automatically: ${followed.row.name}`
  return `${lead}\n${bandLine(followed.row, followed.ctx, followed.folder, now)}`
}

// Escape sequences and control characters a record or a file can carry; an element takes neither.
const clean = value => String(value ?? '').replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
const oneLine = value => clean(value).replace(/\s+/g, ' ').trim()
const clip = value => {
  const text = oneLine(value)
  return text.length > ITEM_MAX ? text.slice(0, ITEM_MAX - 1).trimEnd() + '…' : text
}
const short = (value, max) => {
  const text = oneLine(value)
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`
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

/** A file's lines outside HTML comments, each marked as inside a code fence or as a heading. */
function scan(text) {
  const rows = []
  let fence = null
  for (const line of clean(text).replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const mark = line.match(/^\s*(`{3,}|~{3,})/)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null
      else rows.push({ line, fenced: true, level: 0, title: null })
      continue
    }
    if (mark) {
      fence = mark
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    rows.push({ line, fenced: false, level: heading ? heading[1].length : 0, title: heading ? heading[2] : null })
  }
  return rows
}

/** The rows under the first heading that matches, up to the next heading of its level or above. */
function section(rows, pattern) {
  const start = rows.findIndex(r => r.level && pattern.test(r.title))
  if (start < 0) return null
  const rest = rows.slice(start + 1)
  const end = rest.findIndex(r => r.level && r.level <= rows[start].level)
  return end < 0 ? rest : rest.slice(0, end)
}

/** The first run of plain prose lines: no heading, list, table, quote or `**Label**:` line. */
function firstParagraph(rows) {
  const lines = []
  for (const row of rows) {
    const text = row.line.trim()
    const prose = !row.fenced && !row.level && text && !/^([-*+]\s|\d+[.)]\s|\||>|\*\*[^*]+\*\*\s*:|\*\*[^*]+:\*\*|-{3,}$)/.test(text)
    if (prose) lines.push(text)
    else if (lines.length) break
  }
  return lines.length ? clip(lines.join(' ')) : null
}

const plain = text => oneLine(text).replace(/\*\*|`/g, '')

function specFacts(text) {
  const rows = scan(text)
  const stories = []
  const requirements = []
  const success = []
  const questions = []
  let input = null
  for (const row of rows) {
    if (row.fenced) continue
    if (row.level) {
      const story = row.title.match(/^User Story\s+\d+\s*[-–—:]\s*(.+)$/i)
      if (story) {
        const ranked = story[1].match(/^(.*?)\s*\(Priority:\s*(P\d)\)\s*$/i)
        stories.push({ title: short(plain(ranked ? ranked[1] : story[1]), TITLE_MAX), priority: ranked ? ranked[2].toUpperCase() : null })
      }
      continue
    }
    const item = row.line.match(/^\s*[-*+]\s*\*\*((FR|SC)-\d+[a-z]?)\*\*\s*:?\s*(.*)$/i)
    if (item) (item[2].toUpperCase() === 'FR' ? requirements : success).push(short(`${item[1].toUpperCase()} ${plain(item[3])}`, TITLE_MAX))
    for (const marker of row.line.matchAll(/\[NEEDS CLARIFICATION(?:\s*:\s*([^\]]*))?\]?/gi)) {
      const asked = oneLine(marker[1] ?? '')
      questions.push(clip(asked || plain(row.line.replace(/^\s*[-*+]\s*/, ''))))
    }
    if (input == null) {
      const given = row.line.match(/^\*\*Input\*\*\s*:\s*(.+)$/i) ?? row.line.match(/^\*\*Input:\*\*\s*(.+)$/i)
      if (given) input = clip(given[1].replace(/^User description:\s*/i, '').replace(/^"(.*)"$/, '$1')) || null
    }
  }
  return { description: input ?? firstParagraph(rows), stories, requirements, success, questions }
}

const TREE_FILE = /^[\w@.()[\]/-]*[\w)\]]\.[A-Za-z]\w{0,7}$/

/** Files a plan names in its structure section: tree lines in a code block, or list items that open with a path in backticks. */
function planFiles(rows) {
  const part = section(rows, /^Source Code\b/i) ?? section(rows, /^(Project Structure|File Structure|Files)$/i)
  if (!part) return null
  let files = 0
  for (const row of part) {
    const name = row.fenced
      ? row.line.replace(/^[\s│├└─|+\\-]*/, '').split(/\s+/)[0].replace(/,$/, '')
      : row.line.match(/^\s*[-*+]\s+`([^`\s]+)`/)?.[1] ?? ''
    if (TREE_FILE.test(name)) files++
  }
  return files || null
}

function planFacts(text) {
  const rows = scan(text)
  const summary = section(rows, /^Summary$/i)
  return { summary: summary ? firstParagraph(summary) : null, files: planFiles(rows) }
}

function tasksFacts(text) {
  const tasks = listTasks(text)
  const open = tasks.find(t => !t.checked)
  let phase = null
  let inPhases = 0
  const phases = new Set()
  for (const row of scan(text)) {
    if (row.fenced) continue
    if (row.level === 2) phase = /^Phase\s+\d+/i.test(row.title) ? row.title : null
    else if (/^\s*[-*+]\s*\[[ xX]\]\s*(?:\*\*)?T\d+/.test(row.line) && phase) {
      phases.add(phase)
      inPhases++
    }
  }
  return {
    total: tasks.length,
    checked: tasks.filter(t => t.checked).length,
    parallel: tasks.filter(t => /(^|\s)\[P\](\s|$)/.test(t.text)).length,
    // A task outside every phase heading makes "in N phases" untrue, so the count is left out.
    phases: phases.size && inPhases === tasks.length ? phases.size : null,
    firstOpen: open ? { id: open.id, text: plain(open.text.replace(/\[(P|US\d+)\]\s*/g, '')) } : null,
  }
}

function researchFacts(text) {
  const rows = scan(text).filter(r => !r.fenced)
  const labels = rows.filter(r => !r.level && /^\s*(?:[-*+]\s*)?\*{0,2}Decision(?:\*{0,2}\s*:|:\*{0,2})/i.test(r.line)).length
  const headings = rows.filter(r => r.level >= 2 && /^Decision\b/i.test(r.title)).length
  // Both ways of marking a decision in one file would count some twice.
  return { decisions: labels && headings && labels !== headings ? null : labels || headings || null }
}

function dataModelFacts(text) {
  const rows = scan(text).filter(r => !r.fenced)
  const named = rows.filter(r => r.level >= 2 && /^Entity\s*[:\-–—]\s*\S/i.test(r.title)).length
  const listed = section(rows, /^(Key )?Entities$/i)?.filter(r => r.level === 3).length ?? 0
  return { entities: named || listed || null }
}

function checklistFacts(text) {
  const boxes = scan(text).filter(r => !r.fenced).map(r => r.line.match(/^\s*[-*+]\s*\[([ xX])\]/)).filter(Boolean)
  return { total: boxes.length, checked: boxes.filter(b => b[1] !== ' ').length }
}

/** Which Spec Kit document a markdown file in a spec folder is, by its path inside the folder. */
export function documentKind(rel, specFile = 'spec.md') {
  if (rel === specFile) return 'spec'
  const top = { 'plan.md': 'plan', 'tasks.md': 'tasks', 'research.md': 'research', 'data-model.md': 'data-model', 'quickstart.md': 'quickstart' }[rel]
  if (top) return top
  if (/^checklists\/[^/]+\.md$/.test(rel)) return 'checklist'
  return rel.startsWith('contracts/') ? 'contract' : 'other'
}

const PARSERS = { spec: specFacts, plan: planFacts, tasks: tasksFacts, research: researchFacts, 'data-model': dataModelFacts, checklist: checklistFacts }

/** What one document says, counted from Spec Kit's own headings and markers; null for a kind with nothing to count. */
export function documentFacts(kind, text) {
  if (typeof text !== 'string' || !Object.hasOwn(PARSERS, kind)) return null
  try {
    return PARSERS[kind](text)
  } catch {
    return null
  }
}

const factsOf = (folder, kind) => folder?.files.find(f => f.kind === kind)?.facts ?? null
const baseName = rel => rel.split('/').pop().replace(/\.md$/, '')

function specNote(facts) {
  const { stories, requirements, success } = facts
  const ranks = stories.every(s => s.priority) ? [...new Set(stories.map(s => s.priority))].sort() : []
  const byRank = ranks.map(rank => `${stories.filter(s => s.priority === rank).length} ${rank}`).join(', ')
  return [
    stories.length ? plural(stories.length, 'story', 'stories') + (byRank ? ` (${byRank})` : '') : null,
    requirements.length ? plural(requirements.length, 'requirement') : null,
    success.length ? `${success.length} success criteria` : null,
  ].filter(Boolean).join(SEP)
}

function tasksNote(facts) {
  if (!facts.total) return ''
  return [
    plural(facts.total, 'task') + (facts.phases ? ` in ${plural(facts.phases, 'phase')}` : ''),
    facts.parallel ? `${facts.parallel} can run in parallel` : null,
  ].filter(Boolean).join(SEP)
}

/** The Documents block: one line per file in the spec folder, with what it holds and the file it opens. */
export function documentLines(row, folder) {
  if (!row || !folder) return []
  const lines = []
  const add = (file, label, note = '', warn = null) => lines.push({ key: 'doc-' + file.rel.replace(/[^\w.-]+/g, '-'), path: `${row.id}/${file.rel}`, label, note, warn })
  const of = kind => folder.files.filter(f => f.kind === kind).sort((a, b) => a.rel.localeCompare(b.rel))
  for (const file of of('spec')) {
    const asked = file.facts?.questions.length ?? 0
    add(file, 'spec', file.facts ? specNote(file.facts) : '', asked ? plural(asked, 'open question') : null)
  }
  for (const file of of('plan')) {
    const facts = file.facts
    add(file, 'plan', facts?.files ? `${plural(facts.files, 'file')} named` : facts?.summary ? short(facts.summary, NOTE_MAX) : '')
  }
  for (const file of of('tasks')) add(file, 'tasks', file.facts ? tasksNote(file.facts) : '')
  for (const file of of('research')) add(file, 'research', file.facts?.decisions ? plural(file.facts.decisions, 'decision') : '')
  for (const file of of('data-model')) add(file, 'data-model', file.facts?.entities ? plural(file.facts.entities, 'entity', 'entities') : '')
  for (const file of of('quickstart')) add(file, 'quickstart')
  for (const file of of('checklist')) add(file, 'checklist: ' + baseName(file.rel), file.facts?.total ? `${file.facts.checked} of ${file.facts.total} checked` : '')
  const contracts = of('contract')
  if (folder.contracts) {
    // The count line opens the contract when there is one to read; several each get a line of their own.
    lines.push({ key: 'doc-contracts', path: contracts.length === 1 ? `${row.id}/${contracts[0].rel}` : null, label: 'contracts', note: plural(folder.contracts, 'file'), warn: null })
    if (contracts.length > 1) for (const file of contracts) add(file, 'contract: ' + baseName(file.rel))
  }
  for (const file of of('other')) add(file, file.rel.replace(/\.md$/, ''))
  return lines
}

/** What is happening in a run with no record, from which files exist and how lately each changed; nothing written before `settledAt` reads as in progress. */
export function activityLine(row, folder, now, settledAt = null) {
  if (!row || !folder || now == null) return null
  const has = kind => folder.files.some(f => f.kind === kind)
  const fresh = (kinds, within = RECENT_MS) => lately(Math.max(0, ...folder.files.filter(f => kinds.includes(f.kind)).map(f => f.mtimeMs || 0)), now, within, settledAt)
  const writing = text => ({ text, live: true })
  // The band's own words, without its minutes: the step row beside it carries the time.
  const written = (doc, step) => ({ text: (doc ? STEP_OF_DOC[doc] + ' written' + SEP : '') + cap(step) + ' next', live: false })
  if (has('tasks')) {
    const tasks = factsOf(folder, 'tasks')
    if (tasks?.total > 0 && tasks.checked === tasks.total) return { text: `All ${plural(tasks.total, 'task')} ticked`, live: false }
    if (tasks?.checked > 0 && tasks.firstOpen) {
      const { id, text } = tasks.firstOpen
      if (fresh(['tasks'], TICKING_MS)) return writing(`Implementing: ${id} next${text ? SEP + short(text, NOTE_MAX) : ''}`)
      return { text: `Implement stopped at ${tasks.checked} of ${tasks.total}${SEP}${id} left`, live: false }
    }
    return fresh(['tasks']) ? writing('Writing the tasks') : written('tasks', 'implement')
  }
  if (has('plan')) return fresh(PLAN_KINDS) ? writing('Writing the plan') : written('plan', 'tasks')
  if (has('spec')) return fresh(['spec', 'checklist']) ? writing('Writing the spec') : written('spec', 'plan')
  return written(null, 'specify')
}

/** The Overview a spec's own files can give: what it is for, its stories, open questions, requirements and plan summary. */
export function fileOverview(folder) {
  const spec = factsOf(folder, 'spec')
  const plan = factsOf(folder, 'plan')
  const requirements = spec?.requirements ?? []
  const model = {
    description: spec?.description ?? null,
    stories: spec?.stories ?? [],
    questions: spec?.questions ?? [],
    requirements: requirements.length
      ? { title: `Requirements${SEP}${requirements.length}`, first: requirements.slice(0, FIRST_REQUIREMENTS), more: Math.max(0, requirements.length - FIRST_REQUIREMENTS) }
      : null,
    success: spec?.success ?? [],
    summary: plan?.summary ?? null,
  }
  const empty = !model.description && !model.stories.length && !model.questions.length && !model.requirements && !model.success.length && !model.summary
  return { ...model, empty }
}

/** "Next: /speckit-plan", the command for the step that comes next; null once the spec is complete or its last step is running. */
export function nextStepLine(row, ctx, companionSkills = false) {
  if (!row || row.done || row.steps.implement === 'completed') return null
  const running = PIPELINE_STEPS.findIndex(s => row.steps[s] === 'in-progress')
  // A recorded step in flight was already started, so the step after it is next; without a record nothing says a step is done but its file.
  const step = ctx && running >= 0
    ? PIPELINE_STEPS.slice(running + 1).find(s => row.steps[s] === 'not-started')
    : PIPELINE_STEPS.find(s => row.steps[s] !== 'completed')
  if (!step) return null
  const companion = ctx ? /companion/i.test(row.workflow ?? '') : Boolean(companionSkills)
  return companion ? `Next: /speckit-companion-${step} ${row.id}` : `Next: /speckit-${step}`
}
