// Every $ call lives here, as the hooks module rules require; the mod only reads and never submits a prompt.

import {
  DEFAULT_SPEC_DIRS,
  PIPELINE_STEPS,
  buildSpecRow,
  findSpec,
  isSpecFolder,
  parseSpecContext,
  parseSpecDirsSetting,
  pickFeatureSpecName,
  sortSpecs,
} from './vendor/board-rules.mjs'
import {
  FROM_FILES_NOTE,
  bandParts,
  defaultFollow,
  documentChunks,
  documentFacts,
  documentKind,
  fileOverview,
  followText,
  listText,
  overviewModel,
  paneModel,
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
// 'warning' is the one theme key the mods types name for text; done and failed use the terminal's own green and red.
const RUNNING = { color: 'warning' }
const FAILED = { color: 'red' }
const STEP_STYLE = { completed: { color: 'green' }, 'in-progress': RUNNING, 'not-started': { dimColor: true } }
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
let companionSkills = false
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
  const next = { stamp, text: kind === 'spec' || kind === 'tasks' ? text : null, facts: documentFacts(kind, text) }
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
  const files = await Promise.all(
    found.slice(0, MAX_DOCS).map(async ({ rel, entry }) => {
      const kind = documentKind(rel, specFile)
      const read = PARSED.includes(kind) ? await readDocument($, at(id, rel), entry, kind) : null
      if (read?.text != null) texts[kind] = read.text
      return { rel, kind, mtimeMs: entry.mtimeMs > 0 ? entry.mtimeMs : null, facts: read?.facts ?? null }
    }),
  )
  return { folder: { files, contracts }, texts }
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
  // A list row reads the spec file only for a title the record lacks, and tasks only without a record; the followed spec reads both.
  const specText = read ? (read.texts.spec ?? null) : hasSpec && !ctx?.specName ? await readText($, at(id, specFile)) : null
  const tasksText = read ? (read.texts.tasks ?? null) : hasTasks && !ctx ? await readText($, at(id, 'tasks.md')) : null
  const newest = Math.max(0, ...entries.map(f => f.mtimeMs || 0))
  const row = buildSpecRow({
    id,
    ctx,
    specText,
    files: { spec: hasSpec ? specFile : null, plan: names.includes('plan.md') ? 'plan.md' : null, tasks: hasTasks ? 'tasks.md' : null },
    tasksText,
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
  const live = next ? [bandParts(next.row, next.ctx, next.folder, now), paneModel(next.row, next.ctx, next.tasksText, { folder: next.folder, now, companionSkills })] : null
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
  focusKey = key
  doc = { spec, step, path, text }
  $.ui.invalidate('ui.render')
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

async function start($, cwd) {
  root = cwd ?? (await $.session.cwd())
  const saved = await $.store.get(followKey())
  pinned = typeof saved === 'string' ? saved : null
  await scanAll($)
  await refreshFollowed($)
  timer?.cancel()
  timer = $.clock.every(REFRESH_MS, () => tick($))
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
  // Opened unasked, Claude Code places the pane only beside the transcript of a wide terminal.
  if (followed && (await drawsHere($))) await $.ui.open({ id: PANE, title: TITLE })
}

/** The band's facts after the spec name: dim, with the running step in the warning colour. */
function bandTexts(Text, parts) {
  const at = parts.findIndex(p => p.running)
  const live = parts[at]
  const texts = some => some.map(p => p.text)
  const lead = [''].concat(texts(live ? parts.slice(0, at) : parts), live ? [''] : []).join(' · ')
  const trail = live ? [''].concat(texts(parts.slice(at + 1))).join(' · ') : ''
  return [
    ...(lead ? [Text({ dimColor: true, wrap: 'truncate-end', children: [lead] })] : []),
    ...(live ? [Text({ ...RUNNING, wrap: 'truncate-end', children: [live.text] })] : []),
    ...(trail ? [Text({ dimColor: true, wrap: 'truncate-end', children: [trail] })] : []),
  ]
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
  await $.ui.open({ id: PANE, title: TITLE, focus: true })
  $.ui.invalidate('ui.render')
  return {}
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await start($, e.cwd)
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
    const mine = Box({
      key: 'speckit-band',
      flexDirection: 'row',
      children: [
        Text({ bold: true, wrap: 'truncate-end', children: [followed.row.name] }),
        ...bandTexts(Text, bandParts(followed.row, followed.ctx, followed.folder, await $.clock.now())),
      ],
    })
    const theirs = await next(e)
    return theirs ? Box({ flexDirection: 'column', children: [mine, theirs] }) : mine
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const tab = (name, label, hotkey) =>
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
      })
    const line = (text, style = {}) => Text({ wrap: 'truncate-end', ...style, children: [text] })
    const para = (text, style = {}) => Text({ wrap: 'wrap', ...style, children: [text] })
    const gap = () => line(' ')
    const section = title => [gap(), line(title, { bold: true })]
    const now = await $.clock.now()
    const m = followed ? paneModel(followed.row, followed.ctx, followed.tasksText, { folder: followed.folder, now, companionSkills }) : null
    const header = [Box({ flexDirection: 'row', columnGap: 3, children: [tab('run', 'Run', '1'), tab('overview', 'Overview', '2'), tab('specs', 'Specs', '3')] })]
    if (m) header.push(line(m.title, { bold: true }), line(m.recorded ? m.name + ' · ' + m.statusLabel : m.name, { dimColor: true }))
    if (m?.activity) header.push(line(m.activity.text, m.activity.live ? RUNNING : { dimColor: true }))
    const body = []

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
      const titled = title => (body.length ? section(title) : [line(title, { bold: true })])
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
        if (o.intent) body.push(line('Intent', { bold: true }), para(o.intent))
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
      body.push(line(doc.path, { bold: true }))
      body.push(
        Button({
          key: 'doc-back',
          label: 'Back',
          hotkey: 'b',
          plain: true,
          autoFocus: true,
          onPress: () => {
            doc = null
            $.ui.invalidate('ui.render')
          },
        }),
        gap(),
      )
      const did = doc.step === 'implement' ? taskSummaryLines(followed.ctx) : []
      if (did.length) {
        body.push(line('What each finished task did', { bold: true }), ...did.map(t => para(t.id + ' ' + t.did)), gap())
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
      for (const s of m.steps) {
        const pressable = Boolean(s.document)
        const notes = []
        if (s.time) notes.push(Text({ dimColor: true, children: [s.time] }))
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
            children: [Text({ ...STEP_STYLE[s.state], children: [GLYPH[s.state]] }), Box({ width: 10, children: [name] }), ...notes],
          }),
        )
      }
      if (m.total) body.push(line(m.total, { dimColor: true }))
      if (m.footnote) body.push(para(m.footnote, { dimColor: true }))
      if (m.documents.length) body.push(...section('Documents'))
      for (const d of m.documents) {
        const name = d.path
          ? Button({ key: d.key, label: d.label, plain: true, ...focus(d.key), onPress: () => openDocument($, d.key, null, d.path) })
          : Text({ children: [d.label] })
        body.push(
          Box({ key: 'row-' + d.key, flexDirection: 'row', columnGap: 2, children: [name, ...(d.note ? [Text({ dimColor: true, wrap: 'truncate-end', children: [d.note] })] : [])] }),
        )
        // A line of its own, so a narrow pane cannot cut the one fact that needs an answer.
        if (d.warn) body.push(line('  ' + d.warn, RUNNING))
      }
      for (const phase of m.phases) {
        body.push(gap(), line(phase.name + '  ' + phase.checked + '/' + phase.total, { bold: true }))
        for (const t of phase.tasks) {
          const mark = t.checked ? '✓' : t.current ? '▸' : '○'
          const style = t.checked ? { dimColor: true } : t.current ? RUNNING : {}
          body.push(line(mark + ' ' + t.id + ' ' + t.text, style))
        }
      }
      if (m.next) body.push(gap(), para(m.next, { dimColor: true }))
    }

    return Box({ key: 'pane', flexDirection: 'column', children: [Box({ key: 'header', flexDirection: 'column', children: header }), gap(), ...body] })
  })

  // A new run may have started a new spec; follow it unless the user picked one.
  on('turn.complete', async ($, e, next) => {
    if (root && !e.agentId) {
      await scanAll($)
      await tick($)
    }
    return next(e)
  })
}
