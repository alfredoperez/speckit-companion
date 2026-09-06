# Data Model: Living specs — trust the fold

Nothing here is stored. A finding is produced by reading a file and is discarded once reported. The only persisted change is one optional key on an existing registry entry.

## Finding

One thing wrong with one spec. Produced identically by both runtimes.

| Field | Type | Meaning |
|---|---|---|
| `severity` | `"error"` \| `"warning"` | Whether a fold stops on it. Nothing else reads this. |
| `code` | string | Stable identifier for the kind of finding. Searchable, and safe to match on. |
| `path` | string | Repository-relative path of the file the finding is about, forward slashes. |
| `line` | integer | One-based line in that file. The heading or bullet the finding is about, never the file's first line as a stand-in. |
| `message` | string | One sentence saying what is wrong, in the words a person would use. |
| `fix` | string | One line saying what to do about it. |
| `capability` | string \| null | The capability whose spec this is, or null for a feature spec's delta section. |

### The codes

| Code | Severity | Raised when |
|---|---|---|
| `requirement-without-scenario` | warning | A requirement heading has no scenario heading before the next requirement or section. |
| `scenario-missing-half` | error | A scenario has a condition and no outcome, or an outcome and no condition. The message names which half is absent. |
| `duplicate-requirement` | error | Two requirement headings in one capability's spec share the same text. The message names the other line. |
| `unknown-capability` | error | A delta block's capability marker names a capability the registry does not list. |
| `delta-heading-not-found` | error | A modification or removal names a heading the target spec does not carry. |
| `unmatched-touches-glob` | warning | A file marker's pattern matches no file on disk. |
| `unreadable-spec` | warning | The file could not be read or decoded. One finding for the whole file, at line 1. |

`scenario-missing-half` is an error because a scenario with no outcome is a requirement nobody can test, and folding one into the durable record makes it permanent. The rest of the severity split follows whether the record would be damaged or merely untidy.

## Report

What one run of the check produces.

| Field | Type | Meaning |
|---|---|---|
| `enabled` | boolean | False when living specs are off for the project. Then `checked` is 0 and `findings` is empty. |
| `checked` | integer | How many spec files were examined. |
| `findings` | Finding[] | Every finding, ordered by path then line then code. |
| `skipped` | `{path, reason}[]` | Files that could not be examined, each with its reason stated plainly. |

## Retirement declaration

One optional key on a capability's existing entry in `living-specs.yml`.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `retire` | boolean | absent, read as false | Emptying this capability's spec is intended. Only the fold's empty-spec guard reads it. |

A capability that omits the key behaves exactly as it does today. The key changes nothing about matching, ordering, or resolution — it is read at one point, in the fold, and only when the fold would otherwise leave a spec with no requirements.

## What the fold decides

The fold's behaviour per capability, given the findings for that capability's deltas:

| Condition | Outcome |
|---|---|
| No error-level finding | Apply, exactly as today. |
| An error-level finding | Refuse this capability, name the finding, leave the file byte-for-byte unchanged. |
| Would leave the spec with no requirements, `retire` absent or false | Refuse this capability and name it. |
| Would leave the spec with no requirements, `retire` true | Apply. |

Each capability is decided on its own. A refusal for one never prevents another's sound delta from being applied in the same run.
