# DOM contract

- Card root: `div.calls-card`; header `div.calls-head` with `span.calls-badge` ("calls"), `span.calls-title`, `span.calls-counts`.
- Row: `div.calls-row` plus `calls-row--add|chg|del`, and `calls-row--struck` when struck; wrapped as a component line with `data-line` = source line.
- Chip: `button.file-ref[data-filename][data-line]`, same as the inline chip. New file: `span.calls-new` ("new file") and plain `span.calls-where`.
- Strike: `button.calls-strike[aria-label][data-line]`, only on `+ ~ -` rows.
- Footer: `div.calls-note`.
- Strike message: `addComment` with `comment: "Remove this call from the plan."`.
