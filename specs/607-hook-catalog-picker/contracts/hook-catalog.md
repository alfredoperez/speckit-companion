# Contract: the hook catalog

## What the panel receives

`choices` gains one field beside the four it already carries:

```ts
interface OfferedEntry {
    id: string;
    label: string;
    note?: string;
    usually?: string;
    from?: string;
}

interface PipelineChoices {
    skills: string[];
    nodes: string[];
    commands: OfferedEntry[];
    fragments: PipelineFragment[];
    presets: PipelinePreset[];
}
```

`skills` and `nodes` keep their existing shape. They are names with nothing to say about them, and widening them would be churn for a field that would always be empty.

## Where the commands come from

Two registries, read in this order:

1. `.specify/extensions.yml` — every installed spec-kit extension's hooks, keyed by lifecycle step. Each entry carries `command`, `description`, `extension` and, from the key, the step it attaches at.
2. `speckit-extension/extension.yml` — Companion's own four, under `hooks:`, each carrying a `command` and a `description`.

De-duplicated on the command identifier, first description wins. An entry with no command name is skipped. A registry that cannot be read contributes nothing and never raises.

`usually` is rendered from the lifecycle key: `before_specify` becomes "before specify". A key that does not have that shape yields no placement rather than a guess.

## What the form does

- The kind selector is unchanged.
- The value control shows a picker when the chosen kind has entries, and a plain field when it does not.
- The picker lists the entries for the chosen kind and writes the chosen `id` into the value.
- The free-text field stays available for every kind that has an identifier, so anything the list lacks can still be typed.
- The instruction kind shows the text area it shows today and no picker.
- A kind with an empty catalog says the list is empty rather than showing an empty control.

Everything else about the form is unchanged: editing in place, moving to another boundary, the note, and what is submitted.
