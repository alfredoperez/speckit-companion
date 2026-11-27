# Protocol additions (apps/vscode/src/protocol/pipeline.ts)

Builder to extension, allowed on a stock project:

```ts
{ type: 'addStockHook'; step: string; when: HookWhen; hook: StockHookDraft }
{ type: 'updateStockHook'; step: string; when: HookWhen; index: number; hook: StockHookDraft }
{ type: 'removeStockHook'; step: string; when: HookWhen; index: number }
```

`step` is a stock step name (`plan`), `index` is the hook's place under `<when>_<step>`, as on `StockHookRow`. A refusal posts a `notice`; success re-sends `stock` and a `status`.

Example: `{ type: 'addStockHook', step: 'plan', when: 'after', hook: { command: 'house-note', description: 'Log a house note after plan', optional: false } }`.

Extension to builder: `stock.view.steps[].hooks[]` gains `own` and `prompt`; `stock.view.templates[]` gains `inForce` and `layers`.
