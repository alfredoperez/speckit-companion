# Idea Research: Shared todo lists

- **Slug**: shared-lists
- **Created**: 2026-10-03
- **Evidence confidence (overall)**: low (repo evidence is high; demand and market evidence is absent)

Scope: repo and `.specify/` only. No web fetches (headless, time-boxed). External claims are marked ASSUMPTION.

## Users & Demand

- No evidence anyone asked for this. The intake has no requester or trigger. — [source: `.specify/assessments/shared-lists/intake.md`] (confidence: high that the signal is missing)
- No tickets, issues, analytics, or user feedback exist in the repo. The app has no telemetry. — [source: repo scan: `index.html`, `src/*`, `package.json`] (confidence: high)
- Demand for shared lists in general todo apps is common. — [source: ASSUMPTION] (confidence: low)

## Prior Art

- **Internal:** none. No specs, past decisions, or sharing code exist. `.specify/assessments/` holds only this idea. — [source: `.specify/`] (confidence: high)
- **Current storage:** one `localStorage` key, `tiny-todo.items`, a JSON array of `{id, title, done}`. No user identity, no timestamps, no versions. — [source: `src/store.js`] (confidence: high)
- **Item ids are `Date.now()`**. Two people adding in the same millisecond would collide. A merge would need better ids. — [source: `src/store.js:add`] (confidence: high)
- **External:** hosted todo apps (Todoist, Google Tasks, Apple Reminders) offer sharing through accounts and a backend. — [source: ASSUMPTION, not verified this run] (confidence: low)
- **No-backend sharing patterns** exist: a URL that encodes a list snapshot, a file export and import, or peer-to-peer (WebRTC, which needs a signaling step). — [source: ASSUMPTION] (confidence: low)

## Market & Context

- **Today's workaround:** people cannot share. One browser means one list. Two people would send each other the items by chat or use a different app. — [source: `src/store.js`; ASSUMPTION on the chat workaround] (confidence: medium)
- **Cost of doing nothing:** the app stays a private single-user list, which matches its stated purpose ("A tiny, dependency-free browser todo app"). — [source: `.specify/memory/constitution.md`] (confidence: high)

## Data & Constraints

- **The constitution blocks the usual approach.** Principle III: "MUST NOT use a backend, cookies, IndexedDB, or any network call to store or sync data." Cross-device sharing needs a network call. — [source: `.specify/memory/constitution.md`, v1.0.0] (confidence: high)
- **Principle I** forbids third-party runtime code. A sync library (CRDT, Firebase, a WebRTC wrapper) is out. — [source: `.specify/memory/constitution.md`] (confidence: high)
- **Same-browser sharing is the only case that fits as written.** `localStorage` is shared across tabs of one origin, and the `storage` event fires on the other tabs. That serves two people on one device and nobody else. — [source: browser platform behavior, ASSUMPTION from general knowledge] (confidence: medium)
- **Principle IV** requires a `node:test` for every exported store function, with storage injected and no DOM. Any merge or share logic must live in `src/store.js` and be testable that way. — [source: constitution; `src/store.test.js`] (confidence: high)
- **Principle II** requires WCAG AA for any new UI (share control, conflict or status messages). — [source: constitution] (confidence: high)
- **Privacy:** a share link that embeds list contents puts todo text into URLs and browser history. — [source: ASSUMPTION] (confidence: low)
- **Size:** the app is 4 source files and 42 lines. Sharing would likely be the largest feature by a wide margin. — [source: `wc -l src/*`] (confidence: high)

## Evidence Against the Idea

- **It conflicts with the constitution.** Real two-person sharing across devices needs a network, which Principle III forbids. Building it means amending a MAJOR principle first (per the Governance section), or limiting scope to same-browser use. — [source: `.specify/memory/constitution.md`]
- **No demand signal.** No requester, trigger, or user data. — [source: intake.md]
- **Scope mismatch.** A "tiny" app built for privacy and offline use would gain identity, conflict handling, and hosting concerns. — [source: constitution; `src/store.js`]
- **Data-loss risk.** Without versions or timestamps, concurrent edits to one array overwrite each other. — [source: `src/store.js`]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Who wants this, and what happened that prompted it? No demand evidence exists.]
- [NEEDS CLARIFICATION: Is the constitution open to amendment (Principle III), or is the idea limited to what fits it?]
- [NEEDS CLARIFICATION: Same device or different devices? This decides whether the constitution is a blocker.]
- [NEEDS CLARIFICATION: External prior art (competitors, no-backend sharing patterns) was not verified. Confirm in a web pass if the idea proceeds.]
- [NEEDS CLARIFICATION: What should happen to existing local items when a list becomes shared?]

## Sources

- `.specify/assessments/shared-lists/intake.md` (local file)
- `.specify/memory/constitution.md` (local file)
- `src/store.js`, `src/store.test.js`, `package.json`, `index.html` (local files)
- No URLs fetched. No hosts contacted (policy: none needed).
