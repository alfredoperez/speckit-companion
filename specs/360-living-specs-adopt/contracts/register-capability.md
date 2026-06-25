# Contract: `register-capability.py`

Deterministic registry-append helper. Appends one capability to `livingSpecs.capabilities[]` in `.specify/companion.yml` idempotently, reusing `companion_config.py`'s reader.

## CLI

```
register-capability.py --name <name> --match <glob> [--match <glob> …] [--exclude <glob> …] [--spec <path>] [--root <dir>] [--json]
```

| Flag | Required | Meaning |
|------|----------|---------|
| `--name` | yes | Capability name (idempotency key). |
| `--match` | yes (≥1) | Membership glob(s). Repeatable. |
| `--exclude` | no | Exclusion glob(s). Repeatable. |
| `--spec` | no | Spec path. Defaults to `capabilities/<name>/spec.md` (centralized). |
| `--root` | no | Repo root. Defaults to cwd. |
| `--json` | no | Emit a machine-readable result object instead of the human line. |

## Behavior

- **Absent config** → create `.specify/companion.yml` with a minimal well-formed `livingSpecs` block (`enabled: true`) containing the one capability.
- **Present config, name not registered** → append the capability; preserve all existing capabilities and unrelated config.
- **Present config, name already registered** → no-op; file byte-identical; report `already registered` on stderr.
- **Malformed config** → refuse to write; exit non-zero with a clear stderr message; file untouched.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Capability appended, or already present (idempotent no-op). |
| 2 | Refused — malformed config, or no `--match` supplied. |

## Result object (`--json`)

```jsonc
{
  "name": "billing",
  "action": "appended" | "already-registered" | "created",
  "spec": "capabilities/billing/spec.md",
  "match": ["src/billing/**"],
  "configPath": ".specify/companion.yml"
}
```

## Post-condition (verified by the resolver)

After `--action` is `appended`/`created`, `resolve-spec-paths.py --changed <file-under-match> --json` returns the new capability in `matched[]`.
