# Contract

- `.specify/companion.yml`: `mutation: { enabled: true }` turns the check on; absent or false leaves it off.
- `write-context.py --mutation-report <path>`: reads a Stryker JSON report or a mutmut `mutmut-cicd-stats.json`; records `verified[]` `{what: "Mutation check", command: "stryker"|"mutmut", result: "<killed> of <total> caught", source: "derived"}` and, for Stryker, `coverage[req].weak = true` per weak requirement, clearing the rest. An unreadable report declines (exit 0).
- Overview: `Weak` with `tested, but a planted bug passed`.
