# Data Model: Reach one requirement, from anywhere

Nothing is added to disk except an optional registry block. Everything else reshapes values that already exist in memory.

## Rules block (new, in `living-specs.yml`)

```yaml
rules:
  spec:
    - "Write every scenario as WHEN/THEN with one outcome"
  plan:
    - "Name the capability each decision belongs to"
```

| Field | Type | Rules |
|---|---|---|
| `rules` | mapping, optional | Absent means today's behaviour exactly. A non-mapping value normalizes to no rules and raises one warning. |
| `rules.spec` | list of strings | Guidance handed to the specify step. A non-list normalizes to empty. Blank entries are dropped. |
| `rules.plan` | list of strings | Guidance handed to the plan step. Same rules. |

Any other key under `rules` is dropped with one warning, so adding a step later is additive and an old reader never chokes on a new key. Rules are project-wide; there is no per-capability form and no precedence to resolve.

The normalized shape returned by `load_living_specs_block` becomes:

```
{"enabled": bool, "exempt": [glob], "capabilities": [...], "rules": {"spec": [str], "plan": [str]}}
```

`rules` is always present after normalization, empty lists when unset, so no reader needs a presence check.

## Requirement slice (existing, unchanged)

Already produced by `requirement_slices` in `resolve-spec-paths.py` and `requirementSlices` in `livingSpecsModel.ts`.

| Field | Type | Meaning |
|---|---|---|
| `heading` | string | The requirement's heading text, verbatim. The join key fold-back, coverage and the cards already share. |
| `touches` | list of globs, optional | The files the requirement describes. Absent means it describes the whole capability. |
| `body` | list of lines | Everything under the heading up to the next requirement or section, marker line removed. |

This wave adds readers of this shape and changes none of its fields.

## File claim (new, derived, in-memory only)

What the status bar shows for the active editor. Computed per editor change, never stored.

| Field | Type | Meaning |
|---|---|---|
| `capability` | string | Name of a capability whose `match` globs claim the file and whose `exclude`/exempt globs do not. |
| `specPath` | string | The capability's spec path, workspace-relative. |
| `requirements` | list of headings | The requirements in that spec whose `touches` marker matches this file. Empty when the spec has no markers or none match — the capability still counts as claiming the file. |

The indicator's count is the number of claiming capabilities, not the number of requirements, because a capability claims a file whether or not any requirement is marked for it.

## Viewer target (new field on an existing call)

`speckit.viewSpecDocument(filePath, opts)` gains one optional field on `opts`:

| Field | Type | Meaning |
|---|---|---|
| `requirement` | string, optional | A requirement heading to bring into view once the spec renders. An unmatched heading opens the spec at the top rather than failing. |
