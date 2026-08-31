### What the button runs

It opens a terminal and runs the upstream installer for you:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

Reload the window when it finishes so the extension picks it up.

### What needs it, and what does not

| Works with no CLI | Needs the CLI |
| --- | --- |
| The spec viewer | `/speckit.specify` |
| Inline review comments | `/speckit.plan` |
| The sidebar and steering docs | `/speckit.tasks` |
| The bundled sample spec | `/speckit.implement` |

The CLI is what defines those phase commands. The extension dispatches their text to whichever AI you configure; it never runs your AI itself, and it never reads a response back.
