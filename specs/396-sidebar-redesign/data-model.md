# Data Model: Sidebar Redesign

No persisted data changes. This feature reshapes in-memory presentation entities only; nothing is written to `.spec-context.json`, workspace state, or settings.

## ProviderIconKey (new, `src/features/steering/providerIcon.ts`)

A discriminated union describing *what kind* of icon a provider row should carry, independent of VS Code's `Uri` machinery.

| Variant | Fields | Meaning |
|---|---|---|
| `asset` | `file: string` | A single colored SVG under `assets/icons/providers/` (e.g. `claude.svg`). |
| `mono` | `name: string` | A monochrome mark with light/dark variants (`<name>-light.svg` / `<name>-dark.svg`). |
| `codicon` | `id: string` | A themed `ThemeIcon` — the neutral fallback. |

### HostIde (new)

`'vscode' | 'cursor' | 'windsurf' | 'unknown'` — derived from `vscode.env.uriScheme` and `vscode.env.appName`, the same two signals `getProviderDisplayName()` already reads.

### Resolution rules

| Provider id | Host | Result |
|---|---|---|
| `claude`, `claude-vscode` | any | `asset: claude.svg` |
| `gemini` | any | `asset: gemini.svg` |
| `qwen` | any | `asset: qwen.svg` |
| `copilot` | any | `mono: copilot` |
| `codex` | any | `mono: codex` |
| `opencode` | any | `mono: opencode` |
| `ide-chat` | `vscode` | `mono: copilot` |
| `ide-chat` | `cursor` | `mono: cursor` |
| `ide-chat` | `windsurf` | `mono: windsurf` |
| `ide-chat` | `unknown` | `codicon: comment-discussion` |
| `wibey`, `wibey-vscode` | any | `codicon: comment-discussion` (documented fallback — no official mark ships) |
| anything else | any | `codicon: comment-discussion` |

**Invariant**: for every (provider, host) pair, the resolved icon and `getProviderDisplayName()` refer to the same product. The unknown-host `ide-chat` case is the one the current code violates.

## SpecStatusLabel (new, `src/features/specs/specStatusLabel.ts`)

Pure map from a canonical lifecycle status to a friendly Title Case label used in tooltips.

| Status | Label |
|---|---|
| `draft` | Draft |
| `specifying` | Specifying |
| `specified` | Specified |
| `planning` | Planning |
| `planned` | Planned |
| `tasking` | Tasking |
| `ready-to-implement` | Ready to Implement |
| `implementing` | Implementing |
| `implemented` | Implemented |
| `completed` | Completed |
| `archived` | Archived |
| unknown | the raw value, Title Cased on `-` boundaries |

## SpecItem (reshaped)

| Field | Before | After |
|---|---|---|
| `collapsibleState` (spec row) | `Expanded` by default | `Collapsed` by default |
| `iconPath` (group row) | custom SVG (`group-active.svg`, `spec-completed.svg`, `group-archived.svg`) | `ThemeIcon('pulse')` / `ThemeIcon('pass-filled', testing.iconPassed)` / `ThemeIcon('archive')` |
| `iconPath` (document row) | set only when the parent is neither completed nor archived | set from the document's own state regardless of the parent |
| `description` (spec row) | `· T004 · 22h ago` | `T004 · 22h ago` (no leading bullet) |
| `tooltip` (spec row) | `SpecKit Spec: x — Status: ready-to-implement — Last: …` | multi-line: name / `Status: Ready to Implement` / `Last activity: Plan completed · 22h ago` |
| `tooltip` (related doc) | `Related: <label>.md` (label-reconstructed) | the row's exact workspace-relative `filePath` |

## SteeringItem (reshaped)

| Element | Before | After |
|---|---|---|
| root order | Steering Docs, SpecKit Files, References, Provider, create-rule rows, with Companion `splice`d to index 1 | explicit: Companion, Provider, Steering Docs, SpecKit Project Files, References |
| create-rule rows | loose at root, tooltip hard-codes `CLAUDE.md` | nested under Provider → Project / User, tooltip names `providerPaths.steeringFile` |
| category icons | `folder.svg`, `globe.svg`, `agents.svg`, `skills.svg`, `settings.svg`, `library.svg`, `scripts.svg`, `templates.svg`, `constitution.svg`, `doc.svg`, `warning.svg` | `root-folder`, `account`, `hubot`, `tools`, `gear`, `library`, `terminal`, `files`, `law`, `file`, `warning` (ThemeIcons) |
| Companion → Configuration | collapsible folder, no click action | collapsible **and** clickable — opens `.specify/companion.yml` |
| agent description | `Tools: 3` | `3 tools` |

## OverviewItem

Unchanged. Only the containing view's contributed title changes (`Settings` → `Settings & Feedback`).
