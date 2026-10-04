import { mock } from 'claude-code/testing'

export const ROOT = '/work'

// What Claude Code passes to the band and the pane, apart from the surface.
export const BAND = {
  plugin: 'speckit-companion',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

export const PANE = {
  plugin: 'speckit-companion',
  component: 'Pane',
  requestId: 'speckit-companion',
  viewport: { columns: 160, rows: 40 },
  props: { title: 'SpecKit Companion', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

type Options = { surfaces?: string[]; store?: Map<string, unknown>; mtimes?: Record<string, number> }

/** Stubs every call the mod makes over an in-memory project; change `files` between calls to simulate the agent writing. */
export function project(on: any, files: Record<string, string>, options: Options = {}) {
  const store = options.store ?? new Map<string, unknown>()
  const rel = (path: string) => (path === ROOT ? '' : path.startsWith(ROOT + '/') ? path.slice(ROOT.length + 1) : path)
  on('fs.read', ($: any, e: any) => (rel(e.path) in files ? { value: files[rel(e.path)] } : { deny: 'ENOENT' }))
  on('fs.list', ($: any, e: any) => {
    const prefix = rel(e.path) ? rel(e.path) + '/' : ''
    const seen = new Map<string, any>()
    for (const key of Object.keys(files)) {
      if (!key.startsWith(prefix)) continue
      const [name, ...rest] = key.slice(prefix.length).split('/')
      const kind = rest.length ? 'dir' : 'file'
      seen.set(name, { name, kind, size: 0, mtimeMs: kind === 'file' ? (options.mtimes?.[key] ?? 1) : 0, isLink: false })
    }
    return seen.size ? { value: [...seen.values()] } : { deny: 'ENOENT' }
  })
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($: any, e: any) => {
    store.delete(e.key)
    return { value: undefined }
  })
  const commands: { name: string; description: string }[] = []
  on('command.register', ($: any, e: any) => {
    commands.push({ name: e.name, description: e.description })
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: options.surfaces ?? ['terminal'] }))
  const opened: string[] = []
  on('ui.open', ($: any, e: any) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.start', () => ({ cwd: ROOT }))
  on('session.cwd', () => ({ value: ROOT }))
  on('tool.call', () => ({ result: 'ok' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  return { store, opened, commands, clock: mock.clock(on) }
}

export async function startSession($: any) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: ROOT })
}
