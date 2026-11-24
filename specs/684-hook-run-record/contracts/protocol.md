# Contract

## CLI

```
write-context.py [--feature-dir DIR] --hook-outcome '<step>/<when>/<anchor>/<index>/<type>[:<ref>]=<ran|skipped>[: <reason>]' [any other flags]
```

Repeatable. Rides on any call. A malformed value prints one `[companion]` line on stderr and writes nothing for that value.

## Panel messages (`apps/vscode/src/protocol/pipeline.ts`)

Webview → host: `{ type: 'readHookRuns' }`

Host → webview: `{ type: 'hookRuns'; answer: HookRunsAnswer }`

```ts
interface HookRun {
  key: string;            // `${step}/${when}/${anchor}/${index}`
  step: string; when: HookWhen; anchor: string; index: number;
  type: HookType; ref: string;
  outcome: 'ran' | 'skipped';
  reason?: string;
  at: string;
}
interface HookRunsAnswer {
  spec: { name: string; path: string } | null;
  runAt: string | null;
  runs: HookRun[];
}
```

A board hook drawn from the graph matches a run by `key`. No match means "not seen". A match whose `type` or `ref` differs is a record of a hook that has since changed.
