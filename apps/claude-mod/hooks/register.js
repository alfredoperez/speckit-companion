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
import { bandParts, defaultFollow, documentChunks, followText, listText, overviewModel, paneModel, taskSummaryLines } from './board.js'

const REFRESH_MS = 3000
const PANE = 'speckit-companion'
const TITLE = 'SpecKit Companion'
const PICKER_SIZE = 15
const SCAN_BATCH = 32
const COMMAND = 'spec-tracker'
const ALIAS = 'spec'
const GLYPH = { completed: '✓', 'in-progress': '●', 'not-started': '○' }
// 'warning' is the one theme key the mods types name for text; done and failed use the terminal's own green and red.
const RUNNING = { color: 'warning' }
const FAILED = { color: 'red' }
const STEP_STYLE = { completed: { color: 'green' }, 'in-progress': RUNNING, 'not-started': { dimColor: true } }

let view = 'run'
let root = null
let rows = []
let pinned = null
let followed = null
let signature = ''
let timer = null
// The step whose document is open, and the step the Run view puts the focus on.
let doc = null
let focusStep = null

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

/** One folder's row; `full` also reads the spec and task files the list view can do without. */
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
  // simplified: a list row reads the spec file only for a title the record lacks, and tasks only without a record; the followed spec reads both.
  const specText = hasSpec && (full || !ctx?.specName) ? await readText($, at(id, specFile)) : null
  const tasksText = hasTasks && (full || !ctx) ? await readText($, at(id, 'tasks.md')) : null
  const newest = Math.max(0, ...entries.map(f => f.mtimeMs || 0))
  const row = buildSpecRow({
    id,
    ctx,
    specText,
    files: { spec: hasSpec ? specFile : null, plan: names.includes('plan.md') ? 'plan.md' : null, tasks: hasTasks ? 'tasks.md' : null },
    tasksText,
    updatedAt: newest ? new Date(newest).toISOString() : null,
  })
  return { row, ctx, tasksText, ctxText }
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
  const sig = next ? [JSON.stringify(next.row), next.ctxText, next.tasksText].join('\u0000') : ''
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

async function openDocument($, step, path) {
  const spec = followed?.row.id
  const text = await readText($, at(path))
  focusStep = step
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
  const quiet = parts.filter(p => !p.running).map(p => p.text)
  const live = parts.find(p => p.running)
  // The running step is always the last fact, so the quiet ones lead up to it.
  const lead = [''].concat(quiet, live ? [''] : []).join(' · ')
  return [
    ...(lead ? [Text({ dimColor: true, wrap: 'truncate-end', children: [lead] })] : []),
    ...(live ? [Text({ ...RUNNING, wrap: 'truncate-end', children: [live.text] })] : []),
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

/** /spec-tracker and its alias /spec: follow a spec, then open the pane or answer in text. */
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
  if (!(await drawsHere($))) return { text: query ? followText(followed, activePin()) : listText(followed, rows, activePin()) }
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
        ...bandTexts(Text, bandParts(followed.row, followed.ctx)),
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
    const m = followed ? paneModel(followed.row, followed.ctx, followed.tasksText) : null
    const header = [Box({ flexDirection: 'row', columnGap: 3, children: [tab('run', 'Run', '1'), tab('overview', 'Overview', '2'), tab('specs', 'Specs', '3')] })]
    if (m) header.push(line(m.title, { bold: true }), line(m.name + ' · ' + m.statusLabel, { dimColor: true }))
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
      if (!o) {
        body.push(para('The run record is missing. The Companion Spec Kit extension writes it.', { dimColor: true }))
      } else if (o.empty) {
        body.push(para('The run record has no overview details yet.', { dimColor: true }))
      } else {
        const item = text => para('- ' + text)
        if (o.intent) body.push(line('Intent', { bold: true }), para(o.intent))
        if (o.approach) body.push(...(body.length ? section('Approach') : [line('Approach', { bold: true })]), para(o.approach))
        if (o.facts) body.push(...(body.length ? [gap()] : []), line(o.facts, { dimColor: true }))
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
      for (const s of m.steps) {
        const pressable = Boolean(s.document)
        const notes = []
        if (s.time) notes.push(Text({ dimColor: true, children: [s.time] }))
        else if (s.state === 'in-progress') notes.push(Text({ ...RUNNING, children: ['running'] }))
        else if (s.folded) notes.push(Text({ dimColor: true, children: ['with Specify'] }))
        if (PIPELINE_STEPS.includes(s.step) && !pressable) notes.push(Text({ dimColor: true, children: ['not written yet'] }))
        const name = pressable
          ? Button({
              key: 'step-' + s.step,
              label: s.label,
              plain: true,
              ...(focusStep === s.step ? { autoFocus: true } : {}),
              onPress: () => openDocument($, s.step, s.document),
            })
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
      for (const phase of m.phases) {
        body.push(gap(), line(phase.name + '  ' + phase.checked + '/' + phase.total, { bold: true }))
        for (const t of phase.tasks) {
          const mark = t.checked ? '✓' : t.current ? '▸' : '○'
          const style = t.checked ? { dimColor: true } : t.current ? RUNNING : {}
          body.push(line(mark + ' ' + t.id + ' ' + t.text, style))
        }
      }
    }

    return Box({ flexDirection: 'column', children: [Box({ key: 'header', flexDirection: 'column', children: header }), gap(), ...body] })
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
