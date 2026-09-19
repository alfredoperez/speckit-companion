## Purpose

A markdown formatter puts a blank line between a heading and an HTML comment. The marker survives it.

## Requirements

### Route paths are named, never spelled out

<!-- touches: src/shared/router.ts -->

A route is referenced through the path map, never as a string literal.

#### Scenario: a page links to another page
- **WHEN** a page needs to link somewhere
- **THEN** it takes the path from the map

### Still unmarked when prose comes first

Some prose first.

<!-- touches: src/late/** -->

The comment above is body, not a marker.
