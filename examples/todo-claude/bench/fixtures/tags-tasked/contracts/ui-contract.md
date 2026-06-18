# UI Contract: Tags

This feature exposes a UI surface (routes + interactive controls), not an API. The identifiers below are copied **verbatim** from the spec's Verbatim Constraints and Functional Requirements — implementation and tests MUST use these exact strings.

## Routes

| Path | Page | Source |
|------|------|--------|
| `/tags` | Tags area (create / list / remove tags) | Verbatim: Route `/tags` |
| `/` | Todos list (assignment controls + tag filter row) | existing |

## Navigation

- The application header MUST contain a navigation link whose text is exactly `Tags`, pointing to `/tags` (FR-001).

## Tags area (`/tags`)

- A name input + create action that adds a tag from the entered text (FR-002).
- A list of all existing tags. Each tag's label reads exactly the text that was entered — `<name>` in, `<name>` shown, with no decoration or reformatting (FR-003, Verbatim).
- A remove control per tag (FR-004).
- Empty or whitespace-only submissions create no tag (FR-005).

## Todo list assignment (`/`)

- Each todo row offers an independent on/off control for every existing tag (FR-006).
- Turning a control on assigns that tag to that todo; turning it off removes the assignment — affecting only that todo (FR-007). No specific verbatim label was pinned for the "assigned" state.

## Filter row (`/`)

- A row of filter controls: one control per existing tag, plus a control labelled exactly `All` (FR-008, Verbatim).
- Selecting a specific tag shows only todos assigned that tag; selecting `All` shows every todo (FR-009).
- `All` is the default view when no tag filter is selected.
- Removing the currently filtered tag reverts the view to `All` (FR-010).

## Persistence

- Tags and every todo's tag assignments persist via `localStorage` and are restored on reload / app re-mount (FR-011, Verbatim: persistence mechanism `localStorage`).

## Verbatim identifier checklist

| Identifier | Exact string |
|------------|--------------|
| Route | `/tags` |
| Header nav link text | `Tags` |
| Filter control label | `All` |
| Persistence mechanism | `localStorage` |
| Tag label | matches entered text verbatim (`<name>` → `<name>`) |
