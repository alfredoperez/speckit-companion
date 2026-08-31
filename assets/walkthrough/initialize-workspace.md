### What the button runs

It opens a terminal in this folder and runs:

```bash
specify init .
```

Reload the window when it finishes.

### What it leaves in your repo

```text
.specify/
  memory/
    constitution.md        your project principles
  templates/
    spec-template.md
    plan-template.md
    tasks-template.md
  scripts/
```

Plain files, committed to your repo, editable by hand. There is no extension-owned database, so a spec driven from your terminal and a spec driven from the viewer land in exactly the same place.
