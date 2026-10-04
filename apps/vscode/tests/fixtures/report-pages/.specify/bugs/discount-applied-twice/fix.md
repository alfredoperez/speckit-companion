# Bug Fix: promo code discount is applied twice at checkout

- **Slug**: discount-applied-twice
- **Fixed**: 2026-10-02
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Removed the second discount multiplication from `orderTotal`, so the total now uses the subtotal that `applyPromo` already discounted. Replaced the 0% promo test with real percentages so a double discount cannot pass silently again.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/checkout.js` | modified | Dropped the inline `* (1 - promo.percent / 100)` in `orderTotal` (line 18) |
| `src/checkout.test.js` | added tests | 10% and 25% promo cases; no-promo test kept, 0% test removed |

## Diff Highlights

```diff
   const discounted = applyPromo(order);
-  return discounted.subtotal * (1 - order.promo.percent / 100);
+  return discounted.subtotal;
```

```diff
 assert.strictEqual(orderTotal({ subtotal: 80 }), 80);
-assert.strictEqual(orderTotal({ subtotal: 80, promo: { code: 'FREE0', percent: 0 } }), 80);
+assert.strictEqual(orderTotal({ subtotal: 80, promo: { code: 'SAVE10', percent: 10 } }), 72);
+assert.strictEqual(orderTotal({ subtotal: 40, promo: { code: 'QUARTER', percent: 25 } }), 30);
```

## Tests Added or Updated

- `src/checkout.test.js` reported case, subtotal `80` with `SAVE10` → `72`: pins the exact report (returned `64.8` before the fix).
- `src/checkout.test.js` subtotal `40` with a 25% code → `30`: pins a second percentage (returned `22.5` before the fix).
- `src/checkout.test.js` no promo → `80`: kept unchanged.

## Local Verification

- Commands run: `npm test` → `ok` (all 3 assertions pass).
- Manual checks: confirmed `src/checkout.js:18` returns `discounted.subtotal` with no further multiplication.

## Deviations from Assessment

None. Used the preferred remediation and left the return shape of `applyPromo` alone.

## Follow-ups

- Open question from the assessment is still unanswered: how many promo orders were undercharged, and are those amounts recovered or written off?
- Out of scope, still unchecked: fixed-amount codes take a different branch, and totals are not rounded to cents.
