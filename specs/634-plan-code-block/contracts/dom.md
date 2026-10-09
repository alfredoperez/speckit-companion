# DOM contract

- Card root: `div.code-card`, plus `code-card--sketch` or `code-card--cite`, with `data-language`.
- Header: `div.code-head` with `span.code-badge` ("code"), `span.code-file`, `span.code-kind` ("sketch" or "lines 40-44").
- File: `button.file-ref[data-filename][data-line]` inside `span.code-file` for a citation, plain text for a sketch.
- Row: `div.code-row`, plus `code-row--hl` and `code-row--pinned`, holding `span.code-num` and `code.code-text`. Wrapped as a component line with `data-line` = plan line.
- Pin: `div.code-pin` holding `span.code-pin-text`, wrapped as a component line with `data-line` = the pin's plan line.
