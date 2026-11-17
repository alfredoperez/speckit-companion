# Overview UI contract

Exact visible strings in the Overview. Tests and stories code against these.

## Request block

- Label: `Your request, word for word`
- Rendered in the kicker style, which uppercases it on screen. The source string stays as written.
- Placed under Intent, with the stored request as plain text that wraps and never widens the page. Markup in the request shows as text.
- Renders only when the record has a non-empty `request`. Older records show Intent as before, with no empty block.

## Decision lines

- Current decision: `answered by <who> · <when>`
- Renders only when the decision has an author (`by`). `<who>` is `agent` for the assistant or a person's name. `<when>` is the `at` time, formatted with the existing absolute-time helper.
- Older decisions with no author or time render as before, with no "answered by" text.

## Earlier answers

- Line: `earlier answer · <who> · <when> · reopened`
- Renders beneath the current decision, indented and struck through, one per entry in `earlier`, oldest first.
- Renders only when the decision has been reopened. A decision with no `earlier` list shows nothing extra.

## Unchanged

Records written before this change render exactly as they do today, and every existing Overview fixture is unchanged.
