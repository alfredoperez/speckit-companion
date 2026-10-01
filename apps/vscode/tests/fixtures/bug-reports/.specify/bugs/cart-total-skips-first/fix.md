# Bug Fix: cartTotal skips the first cart item

- **Slug**: cart-total-skips-first
- **Fixed**: 2026-10-01
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

Changed the loop in `cartTotal` to start at index 0 instead of 1, so the first item's `price * qty` is now counted. Added tests for non-empty carts so this off-by-one cannot return silently.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/cart.js` | modified | Loop start `let i = 1` → `let i = 0` (line 3) |
| `src/cart.test.js` | added tests | Single-item and reported two-item cases; empty-cart test kept |

## Diff Highlights

```diff
-  for (let i = 1; i < items.length; i++) {
+  for (let i = 0; i < items.length; i++) {
```

```diff
 assert.strictEqual(cartTotal([]), 0);
+assert.strictEqual(cartTotal([{ price: 4, qty: 1 }]), 4);
+assert.strictEqual(cartTotal([{ price: 5, qty: 2 }, { price: 3, qty: 1 }]), 13);
```

## Tests Added or Updated

- `src/cart.test.js` single item `[{price:4,qty:1}]` → `4`: pins that index 0 is read (returned `0` before the fix).
- `src/cart.test.js` reported case `[{price:5,qty:2},{price:3,qty:1}]` → `13`: pins the exact report (returned `3` before the fix).
- `src/cart.test.js` empty cart → `0`: kept unchanged.

## Local Verification

- Commands run: `npm test` → `ok` (all 3 assertions pass).
- Manual checks: confirmed `src/cart.js:3` now reads `let i = 0`.

## Deviations from Assessment

None. Used the preferred remediation, not the `reduce` alternative.

## Follow-ups

- Open question from the assessment is still unanswered: did wrong totals reach users or orders in production, and do any need correcting?
- Out of scope, still unhandled: missing or non-numeric `price` / `qty` produce `NaN`; decimal prices may hit floating-point rounding.
