# Contract: `livingHealthResolved`

The message is unchanged in type and timing. Its `livingMeta` gains one optional field, declared once in `src/protocol/viewer.ts`.

```ts
/** Coverage label per requirement key; absent when no requirement has a mapped test or coverage is unknown. */
requirementCoverage?: Record<string, string>;
```

Sender, the extension:

- Posts the message when any of `coverage`, `drifted`, `newRequirements` or `requirementCoverage` resolved.
- Omits the field rather than sending `{}`.

Receiver, the webview:

- Calls `setLivingCoverage(message.livingMeta.requirementCoverage ?? null)` and redraws the cards when it, the drifted set or the new set changed.
- Calls `setLivingCoverage(null)` when a nav state arrives whose `livingMeta.specPath` differs from the one on screen.

Rendered result, which the tests code against:

- A card with a label carries `<span class="living-req-coverage">` and a `data-req-coverage` attribute, both holding the label verbatim.
- A card without one carries neither.
