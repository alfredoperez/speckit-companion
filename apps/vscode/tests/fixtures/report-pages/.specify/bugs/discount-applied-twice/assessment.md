# Bug Assessment: promo code discount is applied twice at checkout

- **Slug**: discount-applied-twice
- **Created**: 2026-10-02
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> Entering SAVE10 on a 80.00 order shows 64.80 on the checkout page instead of 72.00. The order summary line says "10% off" but the total looks like the discount was taken twice.

## Symptom

`orderTotal` in `src/checkout.js` subtracts the promo discount twice. For an `80.00` subtotal with a 10% code it returns `64.80` (`80 * 0.9 * 0.9`), but the expected value is `72.00`.

## Reproduction

1. `node -e 'const {orderTotal}=require("./src/checkout.js");console.log(orderTotal({subtotal:80,promo:{code:"SAVE10",percent:10}}))'`
2. Observed: `64.8`. Expected: `72`.
3. An order with no promo, `orderTotal({subtotal:80})`, returns `80`, so the fault is on the promo path only.

Reproduced locally on 2026-10-02.

## Suspected Code Paths

- `src/checkout.js:12`: `applyPromo(order)` returns a new order whose `subtotal` is already discounted.
- `src/checkout.js:18`: `orderTotal` calls `applyPromo(order)` and then multiplies the result by `1 - promo.percent / 100` again.
- `src/checkout.test.js`: the promo test uses a 0% code, so it passes with or without the bug.

## Root Cause Hypothesis

The discount moved into `applyPromo` when the order summary line was added, but the old inline multiplication in `orderTotal` was never removed. Every order with a non-zero percent code is discounted twice. Confidence: **high** (confirmed by reading the code and by reproduction).

## Proposed Remediation

**Preferred**: Delete the inline multiplication at `src/checkout.js:18` so `orderTotal` returns the subtotal that `applyPromo` already discounted. No API change.

**Alternatives**:
- Make `applyPromo` return only the discount amount and keep the subtraction in `orderTotal`. This puts the arithmetic in one place, but it changes the return shape that the order summary line reads.

**Files likely to change**:
- `src/checkout.js`
- `src/checkout.test.js`

**Tests to add or update**:
- Reported case: subtotal `80`, 10% code returns `72`.
- A 25% code on `40` returns `30`.
- Keep the no-promo test (`80`).

## Risks & Considerations

- Orders placed since the summary line shipped were undercharged. Correcting the total does not correct those orders.
- Out of scope, not fixed here: fixed-amount codes (`amount` instead of `percent`) follow a different branch and were not checked, and totals are not rounded to cents.

## Open Questions

- [NEEDS CLARIFICATION: How many orders were placed with a promo code since the summary line shipped, and should the undercharged amounts be recovered or written off?]
