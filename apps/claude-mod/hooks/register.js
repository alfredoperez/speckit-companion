// Every $ call lives here, as the hooks module rules require; the mod only reads, never submits a prompt, and runs one command: the editor, when asked.

import {
  DEFAULT_SPEC_DIRS,
  PIPELINE_STEPS,
  buildSpecRow,
  findSpec,
  isSpecFolder,
  isWritten,
  parseSpecContext,
  parseSpecDirsSetting,
  pickFeatureSpecName,
  recordLiveIn,
  sortSpecs,
} from './vendor/board-rules.mjs'
import {
  FROM_FILES_NOTE,
  bandParts,
  defaultFollow,
  documentChunks,
  documentFacts,
  documentKind,
  editorCommands,
  fileLink,
  fileOverview,
  followText,
  listText,
  overviewModel,
  paneModel,
  progressBar,
  taskSummaryLines,
} from './board.js'

const REFRESH_MS = 3000
const PANE = 'speckit-companion'
const TITLE = 'SpecKit Companion'
const PICKER_SIZE = 15
const SCAN_BATCH = 32
const COMMAND = 'speckit-tracker'
const ALIAS = 'spec'
const MAX_DOCS = 40
const MAX_SUBDIRS = 8
const MAX_PARSED_BYTES = 1 << 20
// The documents whose text is read; every other markdown file is listed by name only.
const PARSED = ['spec', 'plan', 'tasks', 'research', 'data-model', 'checklist']
const COMPANION_SKILL = ['.claude', 'skills', 'speckit-companion-plan']
const GLYPH = { completed: '✓', 'in-progress': '●', 'not-started': '○' }
// Every colour is a theme key, so the pane follows the user's theme: one per state, one per section heading.
const C = { accent: 'warning', done: 'success', failed: 'error', title: 'claude', steps: 'suggestion', documents: 'autoAccept', tasks: 'planMode', chip: 'subtle' }
const HEADING = {
  intent: C.steps,
  approach: C.title,
  'user stories': C.documents,
  'open questions': C.accent,
  expectations: C.tasks,
  decisions: C.documents,
  verified: C.done,
  concerns: C.accent,
  'success criteria': C.done,
  'plan summary': C.title,
}
const RUNNING = { color: C.accent }
const FAILED = { color: C.failed }
const STEP_STYLE = { completed: { color: C.done }, 'in-progress': RUNNING, 'not-started': { dimColor: true } }
const BAND_BAR = 8
const BAND_BAR_MIN_COLUMNS = 80
const ROW_WIDTH = 34
const EDITOR_TIMEOUT_MS = 10000
const READ_HINT = '↵ read'
const TONE = { plain: {}, dim: { dimColor: true }, running: RUNNING }

let view = 'run'
let root = null
let rows = []
let pinned = null
let followed = null
let signature = ''
let timer = null
// The document that is open, and the control the Run view puts the focus on.
let doc = null
let focusKey = null
// The step or document the focus was last on, which `o` opens from the Run tab.
let ringKey = null
let companionSkills = false
// Whether Companion's recorder owns this project's run records, and the templates Spec Kit copies into a new spec folder.
let recordLive = false
let templates = {}
const STEP_DOCS = ['spec', 'plan', 'tasks']
// When the last turn of the main loop ended; a file written before then is not being written any more.
let settledAt = null
// The pane is offered once; after that it is the user's to close and to open.
let offered = false
// Each followed file's text and facts, kept until its time or size changes.
const parsed = new Map()

const at = (...parts) => [root, ...parts].join('/')
const followKey = () => 'follow:' + root

async function readText($, path) {
  try {
    return await $.fs.read(path)
  } catch {
    return null
  }
}

async function listDir($, path) {
  try {
    return await $.fs.list(path)
  } catch {
    return null
  }
}

/** One document's text and facts, read again only when the file's time or size changed. */
async function readDocument($, path, entry, kind) {
  const stamp = entry.mtimeMs > 0 ? entry.mtimeMs + ':' + entry.size : null
  const hit = parsed.get(path)
  if (stamp && hit?.stamp === stamp) return hit
  const small = kind === 'spec' || kind === 'tasks' || !(entry.size > MAX_PARSED_BYTES)
  const text = small ? await readText($, path) : null
  // A file too large to read is taken as written.
  const written = STEP_DOCS.includes(kind) ? (small ? isWritten(kind, text, templates[kind]) : true) : null
  const next = { stamp, text: kind === 'spec' || kind === 'tasks' ? text : null, facts: documentFacts(kind, text), written }
  parsed.set(path, next)
  return next
}

/** The followed folder's markdown files, one level of subfolders deep, with when each was written and what it says. */
async function readFolder($, id, entries, specFile) {
  const found = entries.filter(f => f.kind === 'file' && f.name.endsWith('.md')).map(f => ({ rel: f.name, entry: f }))
  let contracts = null
  for (const dir of entries.filter(f => f.kind === 'dir' && !f.name.startsWith('.')).slice(0, MAX_SUBDIRS)) {
    const inside = ((await listDir($, at(id, dir.name))) ?? []).filter(f => f.kind === 'file')
    if (dir.name === 'contracts') contracts = inside.length
    for (const f of inside) if (f.name.endsWith('.md')) found.push({ rel: dir.name + '/' + f.name, entry: f })
  }
  const texts = {}
  const written = { spec: false, plan: false, tasks: false }
  const files = await Promise.all(
    found.slice(0, MAX_DOCS).map(async ({ rel, entry }) => {
      const kind = documentKind(rel, specFile)
      const read = PARSED.includes(kind) ? await readDocument($, at(id, rel), entry, kind) : null
      if (read?.text != null) texts[kind] = read.text
      if (read && !rel.includes('/') && kind in written) written[kind] = Boolean(read.written)
      return { rel, kind, mtimeMs: entry.mtimeMs > 0 ? entry.mtimeMs : null, facts: read?.facts ?? null }
    }),
  )
  return { folder: { files, contracts }, texts, written }
}

/** One folder's row; `full` also reads the folder's documents, which the list view can do without. */
async function readSpec($, id, full) {
  const entries = await listDir($, at(id))
  if (!entries) return null
  const names = entries.filter(f => f.kind === 'file').map(f => f.name)
  if (!isSpecFolder(names)) return null
  const ctxText = names.includes('.spec-context.json') ? await readText($, at(id, '.spec-context.json')) : null
  const ctx = parseSpecContext(ctxText)
  const specFile = pickFeatureSpecName(id.split('/').pop(), names)
  const hasSpec = names.includes(specFile)
  const hasTasks = names.includes('tasks.md')
  const read = full ? await readFolder($, id, entries, specFile) : null
  // A list row of a closed spec reads only the title its record lacks; every other row reads what the followed spec reads, so the two agree.
  const closed = ctx?.status === 'completed' || ctx?.status === 'archived'
  const doc = async (name, kind) => {
    const entry = entries.find(f => f.kind === 'file' && f.name === name)
    return entry ? readDocument($, at(id, name), entry, kind) : null
  }
  const light = read ? null : { spec: !closed || !ctx?.specName ? await doc(specFile, 'spec') : null, plan: closed ? null : await doc('plan.md', 'plan'), tasks: closed ? null : await doc('tasks.md', 'tasks') }
  const specText = (read ? read.texts.spec : light.spec?.text) ?? null
  const tasksText = (read ? read.texts.tasks : light.tasks?.text) ?? null
  const written = read ? read.written : closed ? null : { spec: Boolean(light.spec?.written), plan: Boolean(light.plan?.written), tasks: Boolean(light.tasks?.written) }
  const newest = Math.max(0, ...entries.map(f => f.mtimeMs || 0))
  const row = buildSpecRow({
    id,
    ctx,
    specText,
    files: { spec: hasSpec ? specFile : null, plan: names.includes('plan.md') ? 'plan.md' : null, tasks: hasTasks ? 'tasks.md' : null },
    written,
    tasksText,
    recordLive,
    updatedAt: newest ? new Date(newest).toISOString() : null,
  })
  return { row, ctx, tasksText, ctxText, folder: read?.folder ?? null }
}

let knownFolders = ''

/** The spec folders that exist right now. Cheap: it lists the spec directories and reads no spec. */
async function listSpecIds($) {
  const settings = await readText($, at('.vscode', 'settings.json'))
  const dirs = (settings != null && parseSpecDirsSetting(settings)) || DEFAULT_SPEC_DIRS
  const ids = []
  for (const dir of dirs) {
    const entries = await listDir($, at(dir))
    for (const entry of entries ?? []) {
      if (entry.kind === 'dir' && !entry.name.startsWith('.')) ids.push(dir.replace(/\/+$/, '') + '/' + entry.name)
    }
  }
  return ids
}

/** Every spec folder under the spec directories, most recently active first. */
async function scanAll($) {
  const ids = await listSpecIds($)
  knownFolders = ids.join('\n')
  companionSkills = Boolean(await listDir($, at(...COMPANION_SKILL)))
  recordLive = Boolean(await recordLiveIn(async path => (await readText($, at(path))) != null))
  templates = {}
  for (const kind of STEP_DOCS) templates[kind] = await readText($, at('.specify', 'templates', kind + '-template.md'))
  const read = []
  for (let i = 0; i < ids.length; i += SCAN_BATCH) {
    read.push(...(await Promise.all(ids.slice(i, i + SCAN_BATCH).map(id => readSpec($, id, false)))))
  }
  rows = sortSpecs(read.filter(Boolean).map(r => r.row))
}

/** The hand-picked spec while its folder still exists; a vanished one counts as following the latest. */
const activePin = () => (pinned && rows.some(r => r.id === pinned) ? pinned : null)

/** Re-read the followed spec; true when anything it shows changed. */
const target = () => activePin() ?? defaultFollow(rows)?.id ?? null

async function refreshFollowed($) {
  const now = await $.clock.now()
  let id = target()
  let next = id ? await readSpec($, id, true) : null
  if (id && !next) {
    // The followed folder went away; look again so the band falls back to another spec.
    await scanAll($)
    id = target()
    next = id ? await readSpec($, id, true) : null
  }
  // The target moved while this read was in flight, so the call that moved it draws instead.
  if (id !== target()) return false
  if (doc && doc.spec !== id) doc = null
  for (const path of parsed.keys()) if (!id || !path.startsWith(at(id) + '/')) parsed.delete(path)
  // The texts that count minutes are part of what is shown, so a minute passing redraws too.
  const live = next ? [bandParts(next.row, next.ctx, next.folder, now, settledAt), paneModel(next.row, next.ctx, next.tasksText, { folder: next.folder, now, companionSkills, settledAt })] : null
  const sig = next ? [JSON.stringify(next.row), next.ctxText, next.tasksText, JSON.stringify(next.folder), JSON.stringify(live)].join('\u0000') : ''
  followed = next
  if (sig === signature) return false
  signature = sig
  return true
}

/** Re-read the open document, so it grows as the agent writes it; true when its text changed. */
async function refreshDocument($) {
  const open = doc
  if (!open) return false
  const text = await readText($, at(open.path))
  if (doc !== open || text === open.text) return false
  doc = { ...open, text }
  return true
}

async function openDocument($, key, step, path) {
  const spec = followed?.row.id
  const text = await readText($, at(path))
  focusKey = ringKey = key
  doc = { spec, step, path, text }
  $.ui.invalidate('ui.render')
  await moveFocus($, 'doc-back')
}

/** Opens a workspace file in the user's editor; when no command works the path goes to the clipboard instead. */
async function openInEditor($, path) {
  const set = read => read.catch(() => undefined)
  const env = {
    visual: await set($.env.get('VISUAL')),
    editor: await set($.env.get('EDITOR')),
    termProgram: await set($.env.get('TERM_PROGRAM')),
    cursor: await set($.env.get('CURSOR_TRACE_ID')),
  }
  for (const argv of editorCommands(at(path), env)) {
    try {
      const { exitCode } = await $.process.run(argv, { timeoutMs: EDITOR_TIMEOUT_MS })
      if (exitCode === 0) return $.ui.toast(`Opened ${path} with ${argv[0].split('/').pop()}`)
    } catch {
      // Not installed here; the next command may be.
    }
  }
  const copied = await $.ui.copy({ text: at(path) }).catch(() => null)
  $.ui.toast(copied?.isCopied ? `No editor command worked, so the path of ${path} is on the clipboard` : `No editor command worked for ${path}`)
}

/** autoFocus only counts when the pane takes the keyboard, so a redraw that swaps the controls moves the focus itself. */
async function moveFocus($, key) {
  try {
    await $.ui.focus({ requestId: PANE, key })
  } catch {
    // Without the keyboard there is no focus to move.
  }
}

async function tick($) {
  try {
    // A spec created after the session started is in no row yet, so a new or removed folder means looking again.
    if ((await listSpecIds($)).join('\n') !== knownFolders) await scanAll($)
    const changed = await refreshFollowed($)
    if ((await refreshDocument($)) || changed) $.ui.invalidate('ui.render')
  } catch {
    // A failed read leaves the last drawing up; the next tick tries again.
  }
}

/** Follow a spec by id, or the latest with null, and remember the choice for this project. */
async function follow($, id) {
  pinned = id
  if (id) await $.store.set(followKey(), id)
  else await $.store.delete(followKey())
  await refreshFollowed($)
  $.ui.invalidate('ui.render')
}

/** Only the terminal and the Desktop app draw a mod's pane and band. */
async function drawsHere($) {
  const surfaces = await $.session.surfaces()
  return surfaces.includes('terminal') || surfaces.includes('desktop')
}

/** Opened unasked, Claude Code places the pane only beside the transcript of a wide terminal. */
async function offerPane($) {
  if (offered || !followed || !(await drawsHere($))) return
  offered = true
  await $.ui.open({ id: PANE, title: TITLE })
}

async function start($, cwd) {
  root = cwd ?? (await $.session.cwd())
  const saved = await $.store.get(followKey())
  pinned = typeof saved === 'string' ? saved : null
  await scanAll($)
  await refreshFollowed($)
  timer?.cancel()
  // The timer offers the pane for a session's first spec, so it is placed by the same width rule as at the start.
  timer = $.clock.every(REFRESH_MS, () => tick($).then(() => offerPane($)).catch(() => undefined))
  const commands = [
    [COMMAND, 'Show the specs and pick the one the SpecKit Companion pane follows'],
    [ALIAS, 'Same as /' + COMMAND],
  ]
  for (const [name, description] of commands) {
    try {
      await $.command.register({ name, description, argumentHint: '[number | name | auto]', immediate: true })
    } catch {
      // A name another command already holds is skipped, and the other name still works.
    }
  }
  await offerPane($)
}

/** A task bar: the filled part in the running colour, or the done colour once every task is ticked. */
function barText(Text, bar) {
  return Text({
    children: [
      ...(bar.filled ? [Text({ color: bar.done ? C.done : C.accent, children: [bar.filled] })] : []),
      ...(bar.empty ? [Text({ dimColor: true, children: [bar.empty] })] : []),
    ],
  })
}

/** The band's facts after the spec name: dim, with the running step bold and the next step in the accent colour. */
function bandTexts(Text, parts) {
  const at = parts.findIndex(p => p.running || p.next)
  const live = parts[at]
  const texts = some => some.map(p => p.text)
  const lead = [''].concat(texts(live ? parts.slice(0, at) : parts), live ? [''] : []).join(' · ')
  const trail = live ? [''].concat(texts(parts.slice(at + 1))).join(' · ') : ''
  return [
    ...(lead ? [Text({ dimColor: true, wrap: 'truncate-end', children: [lead] })] : []),
    ...(live ? [Text({ ...RUNNING, bold: live.running, wrap: 'truncate-end', children: [live.text] })] : []),
    ...(trail ? [Text({ dimColor: true, wrap: 'truncate-end', children: [trail] })] : []),
  ]
}

/** The band's leading dot: done, running, or waiting for its next step. */
function bandDot(Text, row, parts) {
  if (row.done || row.steps.implement === 'completed') return Text({ color: C.done, children: ['● '] })
  if (parts.some(p => p.running)) return Text({ ...RUNNING, children: ['● '] })
  return Text({ dimColor: true, children: ['○ '] })
}

let starting = null

/** A mod loaded by /reload-plugins never sees session.start, so the first hook that runs starts it. */
function ensureStarted($) {
  if (root) return undefined
  starting ??= start($).catch(() => undefined).finally(() => {
    starting = null
  })
  return starting
}

/** /speckit-tracker and its alias /spec: follow a spec, then open the pane or answer in text. */
async function runCommand($, e) {
  await ensureStarted($)
  const query = e.args.trim()
  await scanAll($)
  if (!rows.length) return { text: 'No specs found' }
  if (query === 'auto') {
    await follow($, null)
  } else if (query) {
    const hit = findSpec(rows, query)
    if (!hit) return { text: `No spec matches "${query}"` }
    await follow($, hit.id)
  } else {
    await refreshFollowed($)
  }
  if (!followed) return { text: 'No specs found' }
  if (!(await drawsHere($))) {
    const now = await $.clock.now()
    return { text: query ? followText(followed, activePin(), now) : listText(followed, rows, activePin(), now) }
  }
  view = query ? 'run' : 'specs'
  doc = null
  offered = true
  await $.ui.open({ id: PANE, title: TITLE, focus: true })
  $.ui.invalidate('ui.render')
  return {}
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await start($, e.cwd)
    return next(e)
  })

  on('ui.focus', ($, e, next) => {
    // The person's move names the element; the mod's own $.ui.focus names it as the key it asked for.
    const key = e.element ?? e.key
    if (e.requestId === PANE && typeof key === 'string' && /^(step-|doc-)/.test(key) && key !== 'doc-back') ringKey = key
    return next(e)
  })

  on('command.run', { command: COMMAND }, runCommand)
  on('command.run', { command: ALIAS }, runCommand)

  // Capture writes arrive through the agent's tool calls, so look again once each one finishes.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    await ensureStarted($)
    if (root) await tick($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await ensureStarted($)
    if (!followed || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const parts = bandParts(followed.row, followed.ctx, followed.folder, await $.clock.now(), settledAt)
    const count = followed.row.tasks
    const bar = e.props.bodyColumns >= BAND_BAR_MIN_COLUMNS ? progressBar(count?.checked ?? 0, count?.total ?? 0, BAND_BAR) : null
    const mine = Box({
      key: 'speckit-band',
      flexDirection: 'row',
      children: [
        bandDot(Text, followed.row, parts),
        Text({ bold: true, wrap: 'truncate-end', children: [followed.row.name] }),
        ...(bar ? [Text({ children: [' '] }), barText(Text, bar)] : []),
        ...bandTexts(Text, parts),
      ],
    })
    const theirs = await next(e)
    return theirs ? Box({ flexDirection: 'column', children: [mine, theirs] }) : mine
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    // A Button takes no colour, so the tab in view is marked by the Text beside it.
    const tab = (name, label, hotkey) =>
      Box({
        flexDirection: 'row',
        children: [
          Text({ ...RUNNING, bold: true, children: [view === name ? '▸' : ' '] }),
          Button({
            key: 'tab-' + name,
            label,
            hotkey,
            plain: true,
            dimColor: view !== name,
            onPress: async () => {
              view = name
              doc = null
              if (name === 'specs') await scanAll($)
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      })
    const line = (text, style = {}) => Text({ wrap: 'truncate-end', ...style, children: [text] })
    const para = (text, style = {}) => Text({ wrap: 'wrap', ...style, children: [text] })
    const gap = () => line(' ')
    const heading = (title, color) => line(title.toUpperCase(), { bold: true, color: color ?? HEADING[title.toLowerCase()] ?? C.tasks })
    const section = (title, color) => [gap(), heading(title, color)]
    // A background, not reverse video: the terminal draws the focused control in reverse.
    const chip = (key, label) =>
      Box({ flexDirection: 'row', columnGap: 1, children: [Text({ backgroundColor: C.chip, bold: true, children: [' ' + key + ' '] }), Text({ dimColor: true, children: [label] })] })
    const readHint = () => Box({ flexShrink: 0, children: [Text({ dimColor: true, children: [READ_HINT] })] })
    const editorButton = (path, label = 'Open in editor') =>
      Button({
        key: 'open-editor',
        label,
        hotkey: 'o',
        plain: true,
        dimColor: true,
        onPress: async () => {
          const file = path()
          if (file) await openInEditor($, file)
          else $.ui.toast('Move to a step or a document first, then press o')
        },
      })
    const width = Math.max(12, Math.min(e.props.bodyColumns ?? ROW_WIDTH, ROW_WIDTH))
    const now = await $.clock.now()
    const m = followed ? paneModel(followed.row, followed.ctx, followed.tasksText, { folder: followed.folder, now, companionSkills, settledAt }) : null
    const header = [Box({ flexDirection: 'row', columnGap: 2, children: [tab('run', 'Run', '1'), tab('overview', 'Overview', '2'), tab('specs', 'Specs', '3')] })]
    if (m) header.push(line(m.title, { bold: true, color: C.title }), line(m.recorded ? m.name + ' · ' + m.statusLabel : m.name, { dimColor: true }))
    if (m?.activity) header.push(line(m.activity.text, m.activity.live ? RUNNING : { dimColor: true }))
    const body = []
    let readable = false

    if (view === 'specs') {
      body.push(line('Pick the spec this pane and the band follow.', { dimColor: true }))
      body.push(
        Button({
          key: 'follow-auto',
          label: activePin() ? 'Follow the latest' : 'Follow the latest (now)',
          plain: true,
          onPress: async () => {
            view = 'run'
            await follow($, null)
          },
        }),
      )
      rows.slice(0, PICKER_SIZE).forEach((spec, i) => {
        body.push(
          Button({
            key: 'follow-' + i,
            label: spec.name + ' · ' + spec.statusLabel,
            plain: true,
            dimColor: spec.id !== followed?.row.id,
            onPress: async () => {
              view = 'run'
              await follow($, spec.id)
            },
          }),
        )
      })
    } else if (!followed) {
      body.push(line('No specs found in this project yet. Run /speckit-specify or /speckit-companion-specify to start one.'))
    } else if (view === 'overview') {
      const o = overviewModel(followed.row, followed.ctx)
      const f = fileOverview(followed.folder)
      const item = text => para('- ' + text)
      const titled = title => (body.length ? section(title) : [heading(title)])
      const stories = () => {
        if (f.stories.length) body.push(...titled('User stories'), ...f.stories.map(s => item(s.priority ? s.title + ' · ' + s.priority : s.title)))
        if (f.questions.length) body.push(...titled('Open questions'), ...f.questions.map(q => para('- ' + q, RUNNING)))
      }
      if (!o) {
        if (f.description) body.push(para(f.description))
        stories()
        if (f.requirements) {
          body.push(...titled(f.requirements.title), ...f.requirements.first.map(item))
          if (f.requirements.more) body.push(line(f.requirements.more + ' more in the spec', { dimColor: true }))
        }
        if (f.success.length) body.push(...titled('Success criteria'), ...f.success.map(item))
        if (f.summary) body.push(...titled('Plan summary'), para(f.summary))
        if (f.empty) body.push(para('The spec files have nothing to summarise yet.', { dimColor: true }))
        body.push(gap(), para(FROM_FILES_NOTE, { dimColor: true }))
      } else if (o.empty) {
        body.push(para('The run record has no overview details yet.', { dimColor: true }))
        stories()
      } else {
        if (o.intent) body.push(heading('Intent'), para(o.intent))
        if (o.approach) body.push(...titled('Approach'), para(o.approach))
        if (o.facts) body.push(...(body.length ? [gap()] : []), line(o.facts, { dimColor: true }))
        stories()
        if (o.expectations.length) body.push(...section('Expectations'), line('Out of scope', { dimColor: true }), ...o.expectations.map(item))
        if (o.decisions.length) {
          body.push(...section('Decisions'))
          for (const d of o.decisions) body.push(item(d.decision), ...(d.why ? [para('  ' + d.why, { dimColor: true })] : []))
        }
        if (o.verified.length) {
          body.push(...section('Verified'))
          for (const v of o.verified) {
            body.push(
              Box({
                flexDirection: 'row',
                columnGap: 1,
                children: [para('- ' + v.what), ...(v.failed ? [Text({ ...FAILED, bold: true, children: [v.mark] })] : [])],
              }),
              ...(v.result ? [para('  ' + v.result, { dimColor: true })] : []),
            )
          }
        }
        if (o.concerns.length) body.push(...section('Concerns'), ...o.concerns.map(item))
        if (o.requirements) body.push(gap(), line(o.requirements))
      }
    } else if (doc) {
      const link = fileLink(root, doc.path)
      body.push(link ? Markdown({ key: 'doc-path', text: link }) : line(doc.path, { bold: true, color: C.documents }))
      body.push(
        Box({
          key: 'doc-controls',
          flexDirection: 'row',
          columnGap: 3,
          children: [
            Button({
              key: 'doc-back',
              label: 'Back',
              hotkey: 'b',
              plain: true,
              autoFocus: true,
              onPress: async () => {
                doc = null
                $.ui.invalidate('ui.render')
                await moveFocus($, focusKey)
              },
            }),
            editorButton(() => doc?.path),
          ],
        }),
        gap(),
      )
      const did = doc.step === 'implement' ? taskSummaryLines(followed.ctx) : []
      if (did.length) {
        body.push(line('What each finished task did', { bold: true, color: C.tasks }), ...did.map(t => para(t.id + ' ' + t.did)), gap())
      }
      if (doc.text == null) {
        body.push(line('not written yet', { dimColor: true }))
      } else {
        const { chunks, note } = documentChunks(doc.text)
        if (!chunks.length) body.push(line('This file is empty.', { dimColor: true }))
        chunks.forEach((text, i) => body.push(Markdown({ key: 'doc-' + i, text })))
        if (note) body.push(gap(), line(note, { dimColor: true }))
      }
    } else {
      const focus = key => (focusKey === key ? { autoFocus: true } : {})
      body.push(heading('Steps', C.steps))
      // Measured times sit in one column, so the read hints after them do too.
      const timed = m.steps.some(s => s.time)
      for (const s of m.steps) {
        const pressable = Boolean(s.document)
        const notes = []
        if (s.time) notes.push(Box({ flexGrow: 1 }), Box({ flexShrink: 0, children: [Text({ dimColor: true, children: [s.time] })] }))
        else if (s.notes.length) notes.push(...s.notes.map(n => Text({ ...TONE[n.tone], wrap: 'truncate-end', children: [n.text] })))
        else if (s.state === 'in-progress') notes.push(Text({ ...RUNNING, children: ['running'] }))
        else if (s.folded) notes.push(Text({ dimColor: true, children: ['with Specify'] }))
        // Without a record Implement has no file of its own to wait for, so it says nothing until tasks are ticked.
        const awaited = PIPELINE_STEPS.includes(s.step) && !pressable && (m.recorded || s.step !== 'implement')
        if (awaited) notes.push(Text({ dimColor: true, children: ['not written yet'] }))
        const name = pressable
          ? Button({ key: 'step-' + s.step, label: s.label, plain: true, ...focus('step-' + s.step), onPress: () => openDocument($, 'step-' + s.step, s.step, s.document) })
          : Text({ children: [s.label] })
        body.push(
          Box({
            key: 'row-' + s.step,
            flexDirection: 'row',
            columnGap: 1,
            ...(s.time || (timed && pressable) ? { width } : {}),
            children: [Text({ ...STEP_STYLE[s.state], children: [GLYPH[s.state]] }), Box({ width: 10, children: [name] }), ...notes, ...(pressable ? [...(timed && !s.time ? [Box({ flexGrow: 1 })] : []), readHint()] : [])],
          }),
        )
      }
      if (m.total) body.push(line(m.total, { dimColor: true }))
      if (m.footnote) body.push(para(m.footnote, { dimColor: true }))
      if (m.documents.length) body.push(...section('Documents', C.documents))
      for (const d of m.documents) {
        const name = d.path
          ? Button({ key: d.key, label: d.label, plain: true, ...focus(d.key), onPress: () => openDocument($, d.key, null, d.path) })
          : Text({ children: [d.label] })
        body.push(
          Box({ key: 'row-' + d.key, flexDirection: 'row', columnGap: 2, children: [name, ...(d.note ? [Text({ dimColor: true, wrap: 'truncate-end', children: [d.note] })] : []), ...(d.path ? [readHint()] : [])] }),
        )
        // A line of its own, so a narrow pane cannot cut the one fact that needs an answer.
        if (d.warn) body.push(line('  ' + d.warn, RUNNING))
      }
      const files = { ...Object.fromEntries(m.steps.map(s => ['step-' + s.step, s.document])), ...Object.fromEntries(m.documents.map(d => [d.key, d.path])) }
      readable = Object.values(files).some(Boolean)
      if (readable) body.push(gap(), editorButton(() => files[ringKey], 'Open the focused file in your editor'))
      const bar = progressBar(m.tasks.checked, m.tasks.total, width - (m.tasks.checked + '/' + m.tasks.total).length - 1)
      if (bar) {
        body.push(
          ...section('Tasks', C.tasks),
          Box({
            key: 'task-bar',
            flexDirection: 'row',
            columnGap: 1,
            width,
            children: [barText(Text, bar), Text({ ...(bar.done ? { color: C.done } : { dimColor: true }), children: [m.tasks.checked + '/' + m.tasks.total] })],
          }),
        )
      }
      // Tasks under no phase heading are counted by the bar alone.
      const named = m.phases.length > 1 || m.phases[0]?.name !== 'Tasks'
      m.phases.forEach((phase, i) => {
        if (named) {
          body.push(
            ...(i ? [gap()] : []),
            Box({
              key: 'phase-' + i,
              flexDirection: 'row',
              columnGap: 2,
              children: [
                Box({ flexShrink: 1, children: [line(phase.name, { bold: true })] }),
                Box({ flexShrink: 0, children: [Text({ ...(phase.checked === phase.total ? { color: C.done } : { dimColor: true }), children: [phase.checked + '/' + phase.total] })] }),
              ],
            }),
          )
        }
        for (const t of phase.tasks) {
          const mark = t.checked ? Text({ color: C.done, children: ['✓'] }) : t.current ? Text({ ...RUNNING, bold: true, children: ['▸'] }) : Text({ dimColor: true, children: ['○'] })
          const style = t.checked ? { dimColor: true } : t.current ? RUNNING : {}
          body.push(Box({ flexDirection: 'row', columnGap: 1, children: [mark, Box({ flexShrink: 1, children: [line(t.id + ' ' + t.text, style)] })] }))
        }
      })
      if (m.next) body.push(gap(), para(m.next, { dimColor: true }))
    }

    const hints = [chip('1', 'Run'), chip('2', 'Overview'), chip('3', 'Specs'), ...(doc && view === 'run' ? [chip('b', 'Back'), chip('o', 'Editor')] : []), ...(readable ? [chip('↵', 'Read'), chip('o', 'Editor')] : []), chip('Esc', 'Prompt')]
    return Box({
      flexDirection: 'column',
      children: [
        Box({ key: 'pane', flexDirection: 'column', children: [Box({ key: 'header', flexDirection: 'column', children: header }), gap(), ...body] }),
        gap(),
        Box({ key: 'hints', flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, children: hints }),
      ],
    })
  })

  // A new run may have started a new spec; follow it unless the user picked one. Whatever the turn was writing is written.
  on('turn.complete', async ($, e, next) => {
    if (root && !e.agentId) {
      settledAt = await $.clock.now()
      await scanAll($)
      await tick($)
    }
    return next(e)
  })
}
