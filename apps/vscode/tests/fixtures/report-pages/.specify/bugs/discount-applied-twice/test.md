# Bug Verification: promo code discount is applied twice at checkout

- **Slug**: discount-applied-twice
- **Tested**: 2026-10-02
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: failed

## Summary

The reported percent-code case is fixed: an `80.00` order with `SAVE10` now totals `72`. The fix is not complete, though. A fixed-amount code is still subtracted twice, so the bug reproduces on the other promo branch.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | `node -e 'const {orderTotal}=require("./src/checkout.js");console.log(orderTotal({subtotal:80,promo:{code:"SAVE10",percent:10}}))'` | pass | Prints `72`. Before the fix it printed `64.8` |
| Fixed-amount code | `node -e 'const {orderTotal}=require("./src/checkout.js");console.log(orderTotal({subtotal:80,promo:{code:"FIVEOFF",amount:5}}))'` | fail | Prints `70`, expected `75`. `src/checkout.js:21` subtracts `promo.amount` after `applyPromo` already did |
| Lint / type-check | n/a | not-run | No linter and no TypeScript config in the project |

## Output Excerpts

```
$ node -e '... SAVE10 ...'
72

$ node -e '... FIVEOFF ...'
70

$ npm test
> node src/checkout.test.js
ok
```

## Residual Risks

- Fixed-amount codes are still discounted twice, and no test covers that branch, so `npm test` passes while the bug remains.
- The number of undercharged orders is still unknown. The assessment's open question is unanswered.
- Totals are not rounded to cents, so a percent code on an odd subtotal can show a third decimal.

## Recommendation

Do not close the bug. Reopen the fix to remove the second subtraction on the fixed-amount branch at `src/checkout.js:21`, add a test for a fixed-amount code, then verify again.
