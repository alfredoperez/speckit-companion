# speckit-viewer

## 0.2.0

### Minor Changes

- 14a7aa1: The Overview shows how many times a spec was amended and what the last change was.
- 2b3c348: The spec header shows how many open questions a spec still carries, and pressing it asks for Clarify.
- b57a283: Export `stalenessFrom`, `isStalenessRelevant` and `constitutionNeedsSetup` from the core, so every host decides stale documents and a template constitution by one rule.

### Patch Changes

- c967369: A tasks phase that lists two or more files shows one "N files" chip with the paths in its tooltip, instead of leaking markup as text.

## 0.1.0

### Minor Changes

- 946decf: First public release: the contract, the core, the styles with four themes, the Preact view and the `<speckit-viewer>` element.
