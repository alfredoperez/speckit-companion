# Bug Assessment: cartTotal skips the first cart item

- **Slug**: cart-total-skips-first
- **Created**: 2026-10-01
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> cartTotal in src/cart.js returns the wrong total: for [{price:5,qty:2},{price:3,qty:1}] it returns 3 instead of 13. The first item seems to be skipped.

## Symptom

`cartTotal` leaves out the first item's `price * qty`. For the reported input it returns `3`, but the expected value is `13` (`5*2 + 3*1`).

## Reproduction

1. `node -e 'const {cartTotal}=require("./src/cart.js");console.log(cartTotal([{price:5,qty:2},{price:3,qty:1}]))'`
2. Observed: `3`. Expected: `13`.
3. A one-item cart, `cartTotal([{price:4,qty:1}])`, returns `0` instead of `4`.

Reproduced locally on 2026-10-01.

## Suspected Code Paths

- `src/cart.js:3`: the loop starts at `i = 1`, so it never reads `items[0]`.
- `src/cart.test.js`: the only assertion covers the empty cart (`cartTotal([]) === 0`), which passes with or without the bug. No test covers a non-empty cart.

## Root Cause Hypothesis

Off-by-one in the loop start index. `for (let i = 1; i < items.length; i++)` skips index 0. Every non-empty cart is undercounted by exactly the first item's subtotal. Confidence: **high** (confirmed by reading the code and by reproduction).

## Proposed Remediation

**Preferred**: Change the loop start in `src/cart.js:3` from `let i = 1` to `let i = 0`. This is a one-character change with no API change.

**Alternatives**:
- Rewrite as `items.reduce((sum, it) => sum + it.price * it.qty, 0)`. This removes the index entirely so this bug class cannot come back. Trade-off: a slightly larger diff for the same behavior.

**Files likely to change**:
- `src/cart.js`
- `src/cart.test.js`

**Tests to add or update**:
- Reported case: `[{price:5,qty:2},{price:3,qty:1}]` returns `13`.
- Single item: `[{price:4,qty:1}]` returns `4` (this test fails today with `0`).
- Keep the existing empty-cart test (`0`).

## Risks & Considerations

- Any downstream code or stored data that compensated for the low totals would now see higher, correct values. No such code exists in this repo.
- Out of scope, not fixed here: no validation for missing or non-numeric `price` / `qty` (they produce `NaN`), and floating-point rounding on decimal prices.

## Open Questions

- [NEEDS CLARIFICATION: Did wrong totals reach users or orders in production, and does anything need correcting after the fix?]
