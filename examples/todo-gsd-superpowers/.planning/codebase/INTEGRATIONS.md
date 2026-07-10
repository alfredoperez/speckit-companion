# External Integrations

**Analysis Date:** 2026-07-10

## APIs & External Services

**Not used.** This app does not consume any external APIs.

## Data Storage

**Databases:**
- None. Application uses browser localStorage only.

**File Storage:**
- Browser localStorage - All todo data persisted locally via `src/lib/storage.ts` (`load<T>()` / `save<T>()`)
- No server-side persistence
- No remote sync mechanism

**Caching:**
- Browser memory + localStorage (implicit)
- No cache invalidation needed (single-device, single-browser)

## Authentication & Identity

**Auth Provider:**
- None. Application is unauthenticated and single-user (local browser only).
- No login/signup flow
- No user accounts or multi-device sync

## Monitoring & Observability

**Error Tracking:**
- None configured

**Logs:**
- Console errors only (no structured logging)
- Test environment: auto-cleanup via `@testing-library/react`

## CI/CD & Deployment

**Hosting:**
- No configured deployment target
- Build output: `dist/` (static files ready for any host)
- Suitable for: file:// serving, local dev server, static CDN, GitHub Pages, Vercel, Netlify, etc.

**CI Pipeline:**
- No CI/CD configured
- Project includes test script (`npm test` via Vitest) for potential CI integration

## Environment Configuration

**Required env vars:**
- None

**Secrets location:**
- None required. No API keys, tokens, or credentials in use.

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs Used

**Standard Web APIs:**
- `crypto.randomUUID()` - Generate unique todo IDs
  - Shimmed in test environment (deterministic counter IDs for assertions)
  - File: `vitest.setup.ts`
- `localStorage` - Persist todos between sessions
  - Wrapper: `src/lib/storage.ts`
  - Graceful fallback on unavailability (e.g., private browser mode, quota exceeded)

## Development Workflow Integrations

**GSD (Get Shit Done):**
- Phase planning tool (command: `/gsd-plan-phase`)
- Used to structure feature development phases
- Not a runtime dependency — development workflow only

**Superpowers:**
- Claude Code subagent framework for execution (`superpowers-execute` command)
- TDD-driven development orchestration
- Not a runtime dependency — development workflow only

**SpecKit Companion:**
- VSCode extension for workflow visualization and phase management
- Provides sidebar UI for custom workflow: Discuss → Plan Phase → Execute → Verify
- Custom workflow defined in `.vscode/settings.json` (`gsd-superpowers` workflow)
- Not a runtime dependency — development tool only

---

*Integration audit: 2026-07-10*
