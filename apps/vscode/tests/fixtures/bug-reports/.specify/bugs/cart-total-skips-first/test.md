# Bug Verification: cartTotal skips the first cart item

- **Slug**: cart-total-skips-first
- **Tested**: 2026-10-01
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The bug no longer reproduces. The reported cart now totals `13` and the single-item cart totals `4`. The test suite passes and no regressions turned up.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | `node -e 'const {cartTotal}=require("./src/cart.js");console.log(cartTotal([{price:5,qty:2},{price:3,qty:1}]), cartTotal([{price:4,qty:1}]), cartTotal([]))'` | pass | Prints `13 4 0`. Before the fix it printed `3 0 0` |
| Code inspection | Read `src/cart.js:3` | pass | Loop starts at `let i = 0` |
| New / updated tests | `npm test` | pass | Exit 0. All 3 assertions pass: empty, single item, reported case |
| Regression suite | `npm test` | pass | `src/cart.test.js` is the only suite in the repo |
| Lint / type-check | n/a | not-run | No linter, no TypeScript config, no `node_modules` in the project |

## Output Excerpts

```
$ node -e '...'
13 4 0

$ npm test
> node src/cart.test.js
ok
```

## Residual Risks

- The production impact is still unknown. The assessment's open question is unanswered: did wrong totals reach users or orders?
- Out of scope and unhandled: missing or non-numeric `price` / `qty` gives `NaN`. Decimal prices may hit floating-point rounding.
- No lint or type-check exists, so style and type issues are not covered.

## Recommendation

Close the bug. The fix is verified end-to-end through the reproduction and the test suite. Track the production-impact question and the `NaN` / rounding gaps as separate items.
