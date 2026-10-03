// Every $ call lives here, as the hooks module rules require; the mod only reads and never submits a prompt.

import {
  DEFAULT_SPEC_DIRS,
  buildSpecRow,
  findSpec,
  isSpecFolder,
  parseSpecContext,
  parseSpecDirsSetting,
  pickFeatureSpecName,
  sortSpecs,
} from './vendor/board-rules.mjs'
import { bandLine, defaultFollow, followText, listText, paneModel } from './board.js'

const REFRESH_MS = 3000
const PANE = 'speckit-companion'
const TITLE = 'SpecKit Companion'
const PICKER_SIZE = 15
const SCAN_BATCH = 32
const GLYPH = { completed: '✓', 'in-progress': '●', 'not-started': '○' }
const STEP_STYLE = { completed: { color: 'green' }, 'in-progress': { color: 'yellow' }, 'not-started': { dimColor: true } }

let view = 'run'
let root = null
let rows = []
let pinned = null
let followed = null
let signature = ''
let timer = null

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

/** Every spec folder under the spec directories, most recently active first. */
async function scanAll($) {
  const settings = await readText($, at('.vscode', 'settings.json'))
  const dirs = (settings != null && parseSpecDirsSetting(settings)) || DEFAULT_SPEC_DIRS
  const ids = []
  for (const dir of dirs) {
    const entries = await listDir($, at(dir))
    for (const entry of entries ?? []) {
      if (entry.kind === 'dir' && !entry.name.startsWith('.')) ids.push(dir.replace(/\/+$/, '') + '/' + entry.name)
    }
  }
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
  const sig = next ? [JSON.stringify(next.row), next.ctxText, next.tasksText].join('\u0000') : ''
  followed = next
  if (sig === signature) return false
  signature = sig
  return true
}

async function tick($) {
  try {
    if (await refreshFollowed($)) $.ui.invalidate('ui.render')
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

export function register(on) {
  on('session.start', async ($, e, next) => {
    root = e.cwd ?? (await $.session.cwd())
    const saved = await $.store.get(followKey())
    pinned = typeof saved === 'string' ? saved : null
    await scanAll($)
    await refreshFollowed($)
    timer?.cancel()
    timer = $.clock.every(REFRESH_MS, () => tick($))
    await $.command.register({
      name: 'spec',
      description: 'Show the specs and pick the one the SpecKit Companion pane follows',
      argumentHint: '[number | name | auto]',
      immediate: true,
    })
    // Opened unasked, Claude Code places the pane only beside the transcript of a wide terminal.
    if (followed && (await drawsHere($))) await $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'spec' }, async ($, e) => {
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
    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    $.ui.invalidate('ui.render')
    return {}
  })

  // Capture writes arrive through the agent's tool calls, so look again once each one finishes.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (root) await tick($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!followed || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const mine = Box({
      key: 'speckit-band',
      flexDirection: 'row',
      children: [
        Text({ bold: true, wrap: 'truncate-end', children: [followed.row.name] }),
        Text({ dimColor: true, wrap: 'truncate-end', children: [' · ' + bandLine(followed.row, followed.ctx)] }),
      ],
    })
    const theirs = await next(e)
    return theirs ? Box({ flexDirection: 'column', children: [mine, theirs] }) : mine
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const tab = (name, label, hotkey) =>
      Button({
        key: 'tab-' + name,
        label,
        hotkey,
        plain: true,
        dimColor: view !== name,
        onPress: async () => {
          view = name
          if (name === 'specs') await scanAll($)
          $.ui.invalidate('ui.render')
        },
      })
    const line = (text, style = {}) => Text({ wrap: 'truncate-end', ...style, children: [text] })
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
    } else {
      const m = paneModel(followed.row, followed.ctx, followed.tasksText)
      body.push(line(m.title, { bold: true }), line(m.name + ' · ' + m.statusLabel, { dimColor: true }), line(' '))
      for (const s of m.steps) {
        const note = s.time ?? (s.state === 'in-progress' ? 'running' : null)
        body.push(
          Box({
            key: 'step-' + s.step,
            flexDirection: 'row',
            columnGap: 1,
            children: [
              Text({ ...STEP_STYLE[s.state], children: [GLYPH[s.state]] }),
              Text({ children: [s.label.padEnd(10)] }),
              ...(note ? [Text({ dimColor: true, children: [note] })] : []),
            ],
          }),
        )
      }
      if (m.total) body.push(line(m.total, { dimColor: true }))
      for (const phase of m.phases) {
        body.push(line(' '), line(phase.name + '  ' + phase.checked + '/' + phase.total, { bold: true }))
        for (const t of phase.tasks) {
          const mark = t.checked ? '✓' : t.current ? '▸' : '○'
          const style = t.checked ? { dimColor: true } : t.current ? { color: 'yellow' } : {}
          body.push(line(mark + ' ' + t.id + ' ' + t.text, style))
        }
      }
    }

    return Box({
      flexDirection: 'column',
      children: [Box({ flexDirection: 'row', columnGap: 3, children: [tab('run', 'Run', '1'), tab('specs', 'Specs', '2')] }), line(' '), ...body],
    })
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
