"""Write one key back into `.specify/companion.yml` without disturbing the rest.

The reader in `companion_config.py` parses a constrained subset; this writes a
single `commands.<command>.nodes` list back into the same file as TEXT. It is
deliberately not a YAML emitter: a project's configuration is a file people read
and review, and round-tripping it through a parser would reformat comments,
blank lines and quoting that someone chose on purpose.

So the edit is surgical — replace the existing `nodes:` value for that command,
or insert one — and everything outside those lines comes through byte-identical.

Stdlib only.
"""
from __future__ import annotations

import os
import re

INDENT = "  "

#: A `key:` that opens a block, capturing its indent.
_KEY = re.compile(r"^(\s*)([A-Za-z0-9_.\"'-]+):\s*(.*)$")


class ConfigWriteError(Exception):
    """The file could not be edited without guessing at what someone meant."""


def _indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _is_blank(line: str) -> bool:
    return not line.strip() or line.lstrip().startswith("#")


def _open_block(lines: list, at: int) -> None:
    """Turn `key: {}` or `key: []` into `key:` so entries can be added under it.

    An empty inline collection is a value. Appending indented keys after one
    produces a file the reader stops at — which is what a freshly created
    workflow did the first time anything was added to it.
    """
    match = _KEY.match(lines[at])
    if match and match.group(3).strip() in ("{}", "[]"):
        lines[at] = f"{match.group(1)}{match.group(2)}:"


def _find_key(lines: list, key: str, start: int, end: int, indent: int):
    """The index of `key:` at exactly `indent` within [start, end), or None."""
    for i in range(start, end):
        if _is_blank(lines[i]):
            continue
        match = _KEY.match(lines[i])
        if match and len(match.group(1)) == indent and match.group(2).strip("\"'") == key:
            return i
    return None


def _block_end(lines: list, start: int, indent: int, limit: int) -> int:
    """Where the block opened at `start` stops — the first line back at `indent` or less."""
    for i in range(start + 1, limit):
        if _is_blank(lines[i]):
            continue
        if _indent_of(lines[i]) <= indent:
            return i
    return limit


def _render_nodes(nodes: list, indent: str) -> list:
    """A `nodes:` block sequence. One node per line, which is what a diff wants."""
    return [f"{indent}nodes:"] + [f"{indent}{INDENT}- {node}" for node in nodes]


def set_nodes(text: str, command: str, nodes: list) -> str:
    """Return `text` with `commands.<command>.nodes` set to `nodes`.

    Creates the `commands:` and `<command>:` blocks when they are absent. An
    existing `nodes:` is replaced whether it was written as a block sequence or
    inline. Everything else in the file is untouched.
    """
    if not nodes:
        raise ConfigWriteError("refusing to write an empty node list — that is not a pipeline")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        block = ["commands:", f"{INDENT}{command}:"] + _render_nodes(nodes, INDENT * 2)
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    # The indent a command entry sits at — taken from the file, not assumed, so
    # a configuration written with four spaces stays written with four.
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )

    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        block = [f"{' ' * cmd_indent}{command}:"] + _render_nodes(nodes, ' ' * (cmd_indent * 2))
        out = lines[:commands_end] + block + lines[commands_end:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    command_end = _block_end(lines, command_at, cmd_indent, commands_end)
    key_indent = next(
        (_indent_of(lines[i]) for i in range(command_at + 1, command_end)
         if not _is_blank(lines[i])),
        cmd_indent * 2,
    )

    nodes_at = _find_key(lines, "nodes", command_at + 1, command_end, key_indent)
    block = _render_nodes(nodes, " " * key_indent)
    if nodes_at is None:
        out = lines[:command_at + 1] + block + lines[command_at + 1:]
    else:
        nodes_end = _block_end(lines, nodes_at, key_indent, command_end)
        out = lines[:nodes_at] + block + lines[nodes_end:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


def write_nodes(path: str, command: str, nodes: list) -> str:
    """Apply `set_nodes` to the file at `path`, creating it if absent."""
    text = ""
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    updated = set_nodes(text, command, nodes)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(updated)
    return updated


def read_config(path: str) -> str:
    """The configuration as it stands, or `""` when there is none yet."""
    if not os.path.isfile(path):
        return ""
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def save_config(path: str, text: str) -> None:
    """Publish a configuration — computed in full, then written in one move.

    `open(path, "w")` truncates the instant it is called, so a site shaped
    `with open(path, "w") as fh: fh.write(f(existing))` leaves the file at zero
    bytes whenever `f` raises. Six of these existed, and the reachable one was
    ordinary: a stale hook index from a panel drawn before someone edited the
    file by hand printed "there is no hook 6" and took every order, phase and
    hook the project had written with it.

    So the text is complete before this is called, and the write goes through a
    temp file and a rename — a crash mid-write cannot leave a half-file either.
    """
    import companion_config as cc

    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)
    if not os.path.exists(path):
        # `atomic_write_text` preserves the mode of a file that exists; there is
        # nothing to preserve yet, and it handles the create case itself.
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        return
    cc.atomic_write_text(path, text)


def _quote(value: str) -> str:
    """A quoted scalar this project's reader gives back unchanged.

    The constrained subset strips a matching pair of quotes and does not
    unescape, so `\\"` would read back literally. There is therefore no escape to
    reach for: pick the quote the value does not contain, and refuse a value that
    contains both rather than write one that reads back wrong.
    """
    text = str(value)
    if "\n" in text:
        raise ConfigWriteError("a hook's text has to be one line here — edit companion.yml for more")
    if '"' not in text:
        return f'"{text}"'
    if "'" not in text:
        return f"'{text}'"
    raise ConfigWriteError(
        "this text mixes both quote characters, which this file's format cannot "
        "hold on one line — edit companion.yml directly"
    )


def _hook_line(hook: dict) -> str:
    """One hook as an inline flow map — one line, which is what a diff wants."""
    pairs = [f"type: {hook['type']}"]
    for key in ("ref", "run", "text"):
        if hook.get(key):
            pairs.append(f"{key}: {_quote(hook[key])}")
    return "{ " + ", ".join(pairs) + " }"


def add_hook(text: str, command: str, when: str, anchor: str, hook: dict) -> str:
    """Return `text` with one hook appended under `commands.<command>.hooks.<when>.<anchor>`.

    Appended, never replaced: hooks at one anchor run in declared order, so a
    second one is a second line rather than an overwrite. Every level of nesting
    that is missing gets created; everything present is left as it was.
    """
    if when not in ("before", "after"):
        raise ConfigWriteError(f"a hook runs before or after, not '{when}'")
    if hook.get("type") not in ("command", "prompt", "node", "skill"):
        raise ConfigWriteError(f"unknown hook type '{hook.get('type')}'")
    if hook["type"] in ("node", "skill") and not str(hook.get("ref", "")).strip():
        raise ConfigWriteError(f"a {hook['type']} hook needs a ref")
    if hook["type"] == "prompt" and not str(hook.get("text", "")).strip():
        raise ConfigWriteError("a prompt hook needs its text")
    if hook["type"] == "command" and not str(hook.get("run", "")).strip():
        raise ConfigWriteError("a command hook needs something to run")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text
    line = _hook_line(hook)

    def emit(indent: int, *keys: str) -> list:
        """The missing nesting, each level one deeper, ending with the hook."""
        out = []
        for depth, key in enumerate(keys):
            out.append(f"{' ' * (indent + depth * len(INDENT))}{key}:")
        return out + [f"{' ' * (indent + len(keys) * len(INDENT))}- {line}"]

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        block = ["commands:"] + emit(len(INDENT), command, "hooks", when, anchor)
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )
    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        block = emit(cmd_indent, command, "hooks", when, anchor)
        out = lines[:commands_end] + block + lines[commands_end:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    # Walk hooks -> when -> anchor, creating the first level that is absent.
    at, end, indent = command_at, _block_end(lines, command_at, cmd_indent, commands_end), cmd_indent
    for depth, key in enumerate(("hooks", when, anchor)):
        step = next(
            (_indent_of(lines[i]) for i in range(at + 1, end) if not _is_blank(lines[i])),
            indent + len(INDENT),
        )
        found = _find_key(lines, key, at + 1, end, step)
        if found is None:
            block = emit(step, *("hooks", when, anchor)[depth:])
            out = lines[:at + 1] + block + lines[at + 1:]
            return "\n".join(out) + ("\n" if trailing_newline else "")
        at, indent = found, step
        end = _block_end(lines, found, step, end)

    # The anchor exists: append after its last entry, keeping declared order.
    last = max((i for i in range(at + 1, end) if not _is_blank(lines[i])), default=at)
    item_indent = _indent_of(lines[last]) if last > at else indent + len(INDENT)
    out = lines[:last + 1] + [f"{' ' * item_indent}- {line}"] + lines[last + 1:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


#: What `_hook_items` reports when the anchor is not there: no entries, and no
#: anchor to point at.
_NO_ANCHOR = ([], 0, None, 0)


def _hook_items(lines: list, command: str, when: str, anchor: str):
    """Line numbers of the hook entries at one anchor, in declared order.

    Returns `(indices, item_indent, anchor_at, anchor_indent)` — the entries, the
    indent they sit at, and WHERE the anchor key itself is.

    That last pair matters. An anchor name is not unique in the file: `handoff`
    is a node in every step, so `specify` and `plan` both have a `handoff:` under
    their own hooks. Removing the last hook under one of them used to look the
    anchor up again from the top of the file, delete the first `handoff:` it
    found — another step's, with its hooks inside it — and leave the emptied one
    behind. Reporting the line this walk already reached is the whole fix.
    """
    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        return _NO_ANCHOR
    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])), len(INDENT))

    at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if at is None:
        return _NO_ANCHOR
    end = _block_end(lines, at, cmd_indent, commands_end)
    indent = cmd_indent

    for key in ("hooks", when, anchor):
        step = next(
            (_indent_of(lines[i]) for i in range(at + 1, end) if not _is_blank(lines[i])),
            indent + len(INDENT))
        found = _find_key(lines, key, at + 1, end, step)
        if found is None:
            return _NO_ANCHOR
        at, indent = found, step
        end = _block_end(lines, found, step, end)

    item_indent = next(
        (_indent_of(lines[i]) for i in range(at + 1, end) if not _is_blank(lines[i])),
        indent + len(INDENT))
    return [
        i for i in range(at + 1, end)
        if not _is_blank(lines[i])
        and _indent_of(lines[i]) == item_indent
        and lines[i].lstrip().startswith("- ")
    ], item_indent, at, indent


def replace_hook(text: str, command: str, when: str, anchor: str,
                 index: int, hook) -> str:
    """Replace or remove the hook at `index` under one anchor.

    `hook` is a new hook dict, or `None` to remove it. A hook could only ever be
    added: written wrong, the only fix was to open the file.
    """
    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text
    items, item_indent, _at, _indent = _hook_items(lines, command, when, anchor)
    if index < 0 or index >= len(items):
        raise ConfigWriteError(
            f"{command}: there is no hook {index + 1} {when} {anchor}")

    at = items[index]
    # An entry may run onto continuation lines; take them with it.
    stop = at + 1
    while stop < len(lines) and not _is_blank(lines[stop]) \
            and _indent_of(lines[stop]) > item_indent:
        stop += 1

    if hook is None:
        out = lines[:at] + lines[stop:]
        # An anchor with nothing left under it is a key pointing at nothing. The
        # walk reports which `anchor:` is this command's, so the tidy-up removes
        # that one rather than the first of that name anywhere in the file.
        remaining, _ind, key, key_indent = _hook_items(out, command, when, anchor)
        if not remaining and key is not None:
            out = out[:key] + out[_block_end(out, key, key_indent, len(out)):]
    else:
        out = lines[:at] + [f"{' ' * item_indent}- {_hook_line(hook)}"] + lines[stop:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


def set_workflow(text: str, name: str) -> str:
    """Return `text` with a top-level `workflow: <name>` set, replacing any existing one.

    Switching workflows is one key, at the top of the file, because that is what
    a person reviewing the diff needs to see: which way of working this project
    is on. The rest of `companion.yml` is left exactly as it is.
    """
    if not name.strip():
        raise ConfigWriteError("a workflow needs a name")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text
    line = f"workflow: {_quote(name.strip())}"

    at = _find_key(lines, "workflow", 0, len(lines), 0)
    if at is not None:
        out = lines[:at] + [line] + lines[_block_end(lines, at, 0, len(lines)):]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    # New: above `commands:` if there is one, so the selection reads first.
    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        body = ([line] + ([""] + lines if lines else []))
    else:
        body = lines[:commands_at] + [line, ""] + lines[commands_at:]
    return "\n".join(body) + ("\n" if trailing_newline else "")


#: Where the shipped starting configurations live, next to this script's package.
PRESETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workflows", "presets")

#: What `--seed-from` uses to mean "a shipped preset" rather than a project file.
PRESET_PREFIX = "preset:"

#: A preset's own description keys. They document the preset in its own file and
#: are not configuration, so a seeded copy does not carry them.
_PRESET_META = ("preset:", "summary:")


def _preset_source(name: str) -> str:
    """A shipped preset's configuration, without the keys that only describe it."""
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name or ""):
        raise ConfigWriteError(f"'{name}' cannot be a preset name")
    path = os.path.join(PRESETS_DIR, f"{name}.yml")
    if not os.path.isfile(path):
        raise ConfigWriteError(f"there is no preset called '{name}'")
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    kept = [l for l in lines if not l.startswith(_PRESET_META)]
    return "\n".join(kept).strip() + "\n"


#: A step's directory of nodes, under the project's own nodes root.
PROJECT_NODES_REL = os.path.join(".specify", "companion", "nodes")

#: The four steps a Companion run goes through. A new one can be placed after
#: any of them, or after none — which means "launch it when you want it".
RUN_ORDER = ("specify", "plan", "tasks", "implement")


def new_step(project_root: str, name: str, label: str = "", after: str = "",
             writes: str = "") -> str:
    """Create `.specify/companion/nodes/<name>/` as a runnable step, and return it.

    A step IS a directory of nodes — that is how the shipped four are found — so
    adding one is writing that directory rather than teaching the build about a
    new kind of thing. It is seeded runnable: a frame, an `_order.yml`, and one
    authoring node to edit. An empty directory would build into a command that
    tells the assistant nothing.
    """
    if not re.fullmatch(r"[a-z][a-z0-9-]*", name or ""):
        raise ConfigWriteError(
            f"'{name}' cannot be a step name — it becomes a command "
            f"(/speckit.companion.{name}), so use lowercase letters, digits and dashes")
    if name in RUN_ORDER or name in ("auto", "_frame"):
        raise ConfigWriteError(f"'{name}' is already a step — pick another name")
    if after and after not in RUN_ORDER:
        raise ConfigWriteError(
            f"a step can run after {', '.join(RUN_ORDER)} — not '{after}'")

    directory = os.path.join(project_root, PROJECT_NODES_REL, name)
    if os.path.isdir(directory):
        raise ConfigWriteError(f"a step called '{name}' already exists")

    title = label.strip() or name.replace("-", " ").capitalize()
    node_id = f"{name}-work"
    os.makedirs(directory)

    with open(os.path.join(directory, "_frame.md"), "w", encoding="utf-8") as fh:
        fh.write(f'---\ndescription: "{title}"\n---\n\n'
                 f"## User Input\n\n```text\n$ARGUMENTS\n```\n\n"
                 f"## Outline\n\n{title} — say here, in one or two sentences, what a "
                 f"run of this step is for.\n")

    with open(os.path.join(directory, f"{node_id}.md"), "w", encoding="utf-8") as fh:
        fh.write(f"---\nid: {node_id}\nname: {title}\nkind: author\n"
                 f"command: {name}\n"
                 + (f"writes: {writes}\n" if writes.strip() else "")
                 + "---\n1. Replace this with what the assistant should actually do.\n")

    with open(os.path.join(directory, "_order.yml"), "w", encoding="utf-8") as fh:
        fh.write(f"# {name} — a step this project added. Edit it from the pipeline\n"
                 f"# panel like any other, or by hand here.\n")
        if after:
            fh.write(f"\n# Where it runs. Remove this line to launch it by hand instead.\n"
                     f"after: {after}\n")
        fh.write(f"\norder:\n  - {node_id}\n"
                 f"\nphases:\n  - name: {name}\n    nodes: [{node_id}]\n")
    return directory


def new_workflow(project_root: str, name: str, seed_from: str = "") -> str:
    """Create `.specify/companion/workflows/<name>.yml` and return its path.

    Seeded from the configuration currently in force when one is named, so
    "like what we run now, but…" does not start from a blank file. A
    `preset:<name>` seed starts from one of the configurations Companion ships
    instead — the same file, copied in, and editable from there like any other.
    """
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name or ""):
        raise ConfigWriteError(
            f"'{name}' cannot be a workflow name — it becomes a filename, so use "
            f"lowercase letters, digits and dashes")

    directory = os.path.join(project_root, ".specify", "companion", "workflows")
    path = os.path.join(directory, f"{name}.yml")
    if os.path.exists(path):
        raise ConfigWriteError(f"a workflow called '{name}' already exists")

    source = ""
    origin_note = ""
    if seed_from.startswith(PRESET_PREFIX):
        preset = seed_from[len(PRESET_PREFIX):]
        source = _preset_source(preset)
        origin_note = f"# Started from the {preset} preset — change anything in it.\n"
    elif seed_from:
        origin = (os.path.join(directory, f"{seed_from}.yml") if seed_from != "shipped"
                  else None)
        if origin is None:
            source = ""
        elif os.path.isfile(origin):
            with open(origin, encoding="utf-8") as fh:
                source = fh.read()
        else:
            base = os.path.join(project_root, ".specify", "companion.yml")
            if os.path.isfile(base):
                with open(base, encoding="utf-8") as fh:
                    # The selection itself does not travel into the copy.
                    source = "\n".join(
                        l for l in fh.read().splitlines()
                        if not l.startswith("workflow:")
                    ).strip() + "\n"

    os.makedirs(directory, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"# {name} — a way of working for this project.\n"
                 f"# Switch to it from the pipeline panel, or set `workflow: {name}`\n"
                 f"# in .specify/companion.yml.\n")
        fh.write(origin_note)
        fh.write("\n")
        fh.write(source or "")
    return path


def _render_phases(phases: list, indent: str) -> list:
    """A `phases:` block. One node per line, so a regroup reads as a diff."""
    out = [f"{indent}phases:"]
    for phase in phases:
        out.append(f"{indent}{INDENT}- name: {_quote(phase['name'])}")
        out.append(f"{indent}{INDENT}  nodes:")
        for node in phase["nodes"]:
            out.append(f"{indent}{INDENT}    - {node}")
    return out


def rename_anchor(text: str, command: str, old: str, new: str) -> str:
    """Point this command's hooks at an anchor's new name.

    Both kinds of anchor get renamed by an ordinary edit: a phase when it is
    renamed, and a NODE when it is swapped for one of its variants. Either way
    the hooks are left pointing at something that no longer exists — the build
    warns and skips them — so the edit quietly detaches work someone attached.
    """
    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        return text
    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])), len(INDENT))
    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        return text
    command_end = _block_end(lines, command_at, cmd_indent, commands_end)

    hooks_indent = next(
        (_indent_of(lines[i]) for i in range(command_at + 1, command_end)
         if not _is_blank(lines[i])), cmd_indent * 2)
    hooks_at = _find_key(lines, "hooks", command_at + 1, command_end, hooks_indent)
    if hooks_at is None:
        return text
    hooks_end = _block_end(lines, hooks_at, hooks_indent, command_end)

    for when in ("before", "after"):
        when_indent = hooks_indent + len(INDENT)
        when_at = _find_key(lines, when, hooks_at + 1, hooks_end, when_indent)
        if when_at is None:
            continue
        when_end = _block_end(lines, when_at, when_indent, hooks_end)
        anchor_indent = when_indent + len(INDENT)
        at = _find_key(lines, old, when_at + 1, when_end, anchor_indent)
        if at is not None:
            lines[at] = f"{' ' * anchor_indent}{_quote(new)}:"
    return "\n".join(lines) + ("\n" if trailing_newline else "")


def _find_section(lines: list, heading: str, start: int, end: int, indent: int):
    """The index of a `"## heading": fragment` entry, or None.

    Section keys are not identifiers — they are markdown headings, with spaces,
    ampersands and parentheses in them. `_find_key`'s pattern is deliberately
    narrow and will not match one, so the entry has to be found by splitting on
    the last colon and unquoting what is to its left.
    """
    for i in range(start, end):
        if _is_blank(lines[i]) or _indent_of(lines[i]) != indent:
            continue
        key, sep, _value = lines[i].strip().rpartition(":")
        if sep and key.strip().strip("\"'") == heading:
            return i
    return None


def _command_block(lines: list, command: str):
    """`(command_at, command_end, key_indent)` for one command, or None if absent.

    The three numbers every nested writer here needs, worked out the same way:
    indents come from the file rather than being assumed, so a configuration
    written with four spaces stays written with four.
    """
    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        return None
    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )
    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        return None
    _open_block(lines, command_at)
    command_end = _block_end(lines, command_at, cmd_indent, commands_end)
    key_indent = next(
        (_indent_of(lines[i]) for i in range(command_at + 1, command_end)
         if not _is_blank(lines[i])),
        cmd_indent * 2,
    )
    return command_at, command_end, key_indent


def set_template_section(text: str, command: str, heading: str, fragment) -> str:
    """Point one template section at a fragment, or back at what ships.

    `fragment=None` removes the entry, which is how a section is restored — an
    absent key means the stock template's own words, so there is nothing to
    write for "as shipped".

    The heading is the address: `spec-template.md` is a sequence of `##` blocks
    and every reader already navigates it that way, so no new marker syntax has
    to be learned and a hand-edited template keeps working.
    """
    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text
    entry = f"{{ {_quote(heading)}: {fragment} }}" if fragment else None

    found = _command_block(lines, command)
    if found is None:
        if not fragment:
            return text
        block = ["commands:", f"{INDENT}{command}:", f"{INDENT * 2}template:",
                 f"{INDENT * 3}sections:",
                 f"{INDENT * 4}{_quote(heading)}: {fragment}"]
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    command_at, command_end, key_indent = found
    pad = " " * key_indent
    template_at = _find_key(lines, "template", command_at + 1, command_end, key_indent)
    if template_at is None:
        if not fragment:
            return text
        block = [f"{pad}template:", f"{pad}{INDENT}sections:",
                 f"{pad}{INDENT * 2}{_quote(heading)}: {fragment}"]
        out = lines[:command_at + 1] + block + lines[command_at + 1:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    _open_block(lines, template_at)
    template_end = _block_end(lines, template_at, key_indent, command_end)
    inner = key_indent + len(INDENT)
    sections_at = _find_key(lines, "sections", template_at + 1, template_end, inner)
    if sections_at is None:
        if not fragment:
            return text
        block = [f"{pad}{INDENT}sections:",
                 f"{pad}{INDENT * 2}{_quote(heading)}: {fragment}"]
        out = lines[:template_at + 1] + block + lines[template_at + 1:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    _open_block(lines, sections_at)
    sections_end = _block_end(lines, sections_at, inner, template_end)
    entry_indent = inner + len(INDENT)
    at = _find_section(lines, heading, sections_at + 1, sections_end, entry_indent)
    written = f"{' ' * entry_indent}{_quote(heading)}: {fragment}"
    if at is None:
        if not fragment:
            return text
        out = lines[:sections_at + 1] + [written] + lines[sections_at + 1:]
    elif fragment:
        out = lines[:at] + [written] + lines[at + 1:]
    else:
        out = lines[:at] + lines[at + 1:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


def set_phases(text: str, command: str, phases: list, renamed: tuple = None) -> str:
    """Return `text` with `commands.<command>.phases` set.

    Writing the whole grouping rather than a patch: a phase list is small, and a
    partial one would leave the reader guessing which nodes are where.
    """
    if not phases:
        raise ConfigWriteError("a step needs at least one phase")
    if renamed:
        text = rename_anchor(text, command, renamed[0], renamed[1])
    names = [p["name"] for p in phases]
    if len(set(names)) != len(names):
        raise ConfigWriteError("two phases cannot share a name")
    placed = [n for p in phases for n in p["nodes"]]
    if len(set(placed)) != len(placed):
        raise ConfigWriteError("a node cannot be in two phases")

    lines = text.splitlines()
    trailing_newline = text.endswith("\n") or not text

    commands_at = _find_key(lines, "commands", 0, len(lines), 0)
    if commands_at is None:
        block = ["commands:", f"{INDENT}{command}:"] + _render_phases(phases, INDENT * 2)
        body = lines + ([""] if lines and lines[-1].strip() else []) + block
        return "\n".join(body) + ("\n" if trailing_newline else "")

    _open_block(lines, commands_at)
    commands_end = _block_end(lines, commands_at, 0, len(lines))
    cmd_indent = next(
        (_indent_of(lines[i]) for i in range(commands_at + 1, commands_end)
         if not _is_blank(lines[i])),
        len(INDENT),
    )
    command_at = _find_key(lines, command, commands_at + 1, commands_end, cmd_indent)
    if command_at is None:
        block = ([f"{' ' * cmd_indent}{command}:"]
                 + _render_phases(phases, ' ' * (cmd_indent * 2)))
        out = lines[:commands_end] + block + lines[commands_end:]
        return "\n".join(out) + ("\n" if trailing_newline else "")

    command_end = _block_end(lines, command_at, cmd_indent, commands_end)
    key_indent = next(
        (_indent_of(lines[i]) for i in range(command_at + 1, command_end)
         if not _is_blank(lines[i])),
        cmd_indent * 2,
    )
    block = _render_phases(phases, " " * key_indent)
    phases_at = _find_key(lines, "phases", command_at + 1, command_end, key_indent)
    if phases_at is None:
        out = lines[:command_at + 1] + block + lines[command_at + 1:]
    else:
        phases_end = _block_end(lines, phases_at, key_indent, command_end)
        out = lines[:phases_at] + block + lines[phases_end:]
    return "\n".join(out) + ("\n" if trailing_newline else "")


#: Set by the CLI so `check_phases` knows which nodes the step is running.
_order_in_force = {}


def use_order(command: str, order: list) -> None:
    _order_in_force[command] = list(order)


def order_in_force(command: str) -> list:
    """The order this step runs, so a phase check knows what needs placing."""
    if command in _order_in_force:
        return _order_in_force[command]
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")
    return assemble.default_order(command)


def resolved_order(project_root: str, command: str) -> list:
    """The nodes this step runs today, read the way a build reads them.

    Falls back to the shipped order for a project that has declared none, and on
    any read failure — a validation that cannot tell what is running should let
    the write through and leave the build to refuse it, rather than block an
    edit because the file it was about to fix could not be parsed.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")
    default = assemble.default_order(command)
    try:
        import companion_config as cc

        config, _warnings = cc.load_config(config_path(project_root))
        return cc.resolve_order(config, command, default) or default
    except Exception:  # noqa: BLE001 — see the docstring
        return default


def check_template_section(project_root: str, command: str, heading: str,
                           fragment: str) -> None:
    """Refuse a section or a fragment that does not exist, before writing it.

    Both failures are otherwise silent until the next build: a misspelled
    heading replaces nothing and reports success, and a missing fragment stops
    the build long after the click that caused it.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    tr = importlib.import_module("template_render")

    name = tr.DEFAULT_TEMPLATE_BY_COMMAND.get(command)
    if not name:
        raise ConfigWriteError(f"{command} has no template to reshape")
    source = os.path.join(project_root, ".specify", "templates", name)
    if os.path.isfile(source):
        with open(source, encoding="utf-8") as fh:
            headings = [m.group(2).strip() for m in tr.SECTION_RE.finditer(fh.read())]
        cleaned = {tr._clean(h) for h in headings}
        if tr._clean(heading) not in cleaned:
            raise ConfigWriteError(
                f"{name} has no section '{heading}' — it has: {', '.join(headings[:8])}")
    if fragment:
        fragments_dir = os.path.join(
            project_root, ".specify", "companion", "fragments")
        if not tr.find_fragment(fragment, fragments_dir):
            known = ", ".join(f["name"] for f in tr.shipped_fragments()) or "none"
            raise ConfigWriteError(
                f"no fragment called '{fragment}' — shipped ones are: {known}")


def use_phases_in_force(project_root: str, command: str, pending: list = None) -> None:
    """Point the phase checks at the grouping that will be in force, not the shipped one.

    `unexpressible_order` asks whether an order can be expressed as contiguous
    phases — a question only the grouping in force can answer. Left pointing at
    the shipped phases, adding an optional node is refused for "moving across a
    phase boundary" when it simply has no shipped phase to belong to.

    `pending` is the grouping this same write is about to save, so the pair of
    writes the panel makes (phases, then order) validates against each other
    rather than against what was there before.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")
    if pending:
        assemble.use_project_phases({command: pending})
        return
    try:
        import companion_config as cc

        config, _warnings = cc.load_config(config_path(project_root))
        declared = cc.resolve_phases(config, command)
        if declared:
            assemble.use_project_phases({command: declared})
    except Exception:  # noqa: BLE001 — a validation that cannot read the file
        pass                                  # lets the write through; the build refuses.


def check_phases(command: str, phases: list) -> None:
    """Refuse a grouping the pipeline could not build, before it reaches the file."""
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")

    import _command_parts as cp

    default = assemble.default_order(command)
    placed = [n for p in phases for n in p["nodes"]]
    unknown = [
        n for n in placed
        # An exists check, not the replaced flag: a shipped optional node —
        # an add-on or a variant — is neither in the default order nor a
        # project copy, and it is exactly what this write is naming.
        if n not in default and not os.path.isfile(cp.node_source(command, n)[0])
    ]
    if unknown:
        raise ConfigWriteError(f"{command}: no such node: {', '.join(unknown)}")
    # Every node the step RUNS needs a phase. A shipped node the recipe dropped
    # does not — otherwise replacing a step wholesale would demand a phase for
    # each of the nodes it just replaced.
    running = set(placed)
    missing = [n for n in default if n not in running and n in set(order_in_force(command))]
    if missing:
        raise ConfigWriteError(
            f"{command}: every node needs a phase — {', '.join(missing)} has none")
    for phase in phases:
        if not str(phase.get("name", "")).strip():
            raise ConfigWriteError(f"{command}: a phase needs a name")
        # A phase with nothing in it renders nothing and cannot be read back.
        # Emptying one means removing it, so refuse rather than write it.
        if not phase.get("nodes"):
            raise ConfigWriteError(
                f"{command}: phase '{phase.get('name')}' has no nodes — "
                f"remove the phase instead of leaving it empty")

    # The flattened grouping is the order, so it has to satisfy `reads:`.
    check_order(command, placed)


def check_order(command: str, nodes: list) -> None:
    """Refuse an order the pipeline cannot honour, before it reaches the file.

    A configuration that is written and then refused at every build is worse
    than one that was never written: the panel would show the new order and the
    assistant would keep reading the old body.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    assemble = importlib.import_module("assemble-nodes")
    import companion_config as cc

    import _command_parts as cp

    default = assemble.default_order(command)
    unknown = [
        n for n in nodes
        # An exists check, not the replaced flag: a shipped optional node —
        # an add-on or a variant — is neither in the default order nor a
        # project copy, and it is exactly what this write is naming.
        if n not in default and not os.path.isfile(cp.node_source(command, n)[0])
    ]
    if unknown:
        raise ConfigWriteError(f"{command}: no such node: {', '.join(unknown)}")
    if sorted(nodes) != sorted(set(nodes)):
        raise ConfigWriteError(f"{command}: the same node is listed twice")

    stray = assemble.unexpressible_order(command, nodes)
    if stray:
        raise ConfigWriteError(
            f"{command}: '{stray}' would move across a phase boundary. A phase is one "
            f"contiguous run of the command, so a node can only be reordered within its own."
        )
    try:
        cc.validate_reads(assemble.node_reads_map(command, nodes),
                          assemble.stands_in_for(command))
    except cc.ConfigError as err:
        raise ConfigWriteError(f"{command}: {err}") from err

    rank = {node_id: i for i, node_id in enumerate(nodes)}
    for node_id in nodes:
        meta, _body = __import__("_command_parts").read_node(command, node_id)
        for dep in meta.get("reads") or []:
            if dep in rank and rank[dep] > rank[node_id]:
                raise ConfigWriteError(
                    f"{command}: '{node_id}' reads '{dep}', so it cannot run before it."
                )
        # `reads` expresses "after that one". Some nodes mean "after all of
        # them" — a handoff dispatches the next step, so anything it runs
        # ahead of happens after this step has already moved on. Spelling that
        # as a read of whichever node happens to precede it today would be a
        # weaker claim that stops being true the moment the middle is
        # reordered.
        if meta.get("last") and rank[node_id] != len(nodes) - 1:
            after = nodes[rank[node_id] + 1]
            raise ConfigWriteError(
                f"{command}: '{node_id}' has to run last — it hands off to the next "
                f"step, so '{after}' would run after this step had already moved on."
            )


def config_path(project_root: str) -> str:
    """The file an edit belongs in.

    A project on a named workflow has its configuration in that workflow's file,
    not in `companion.yml` — `companion.yml` only says which one is active.
    Writing edits there anyway put every hook, phase and reorder in a file the
    build does not read: reported as applied, doing nothing.

    `shipped` is Companion unchanged and has no file, so an edit has nowhere to
    go and says so instead of landing somewhere silent.
    """
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    build = importlib.import_module("build-pipeline")

    active = build.active_workflow(project_root)
    if not active:
        return os.path.join(project_root, ".specify", "companion.yml")
    if active == build.SHIPPED_WORKFLOW:
        raise ConfigWriteError(
            "this project is on \"As it ships\", which is Companion unchanged and "
            "cannot be edited — switch to a workflow, or create one, first")
    return os.path.join(project_root, build.WORKFLOWS_REL, f"{active}.yml")


def main() -> int:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--command", help="the step to edit (not needed for a workflow)")
    ap.add_argument("--nodes", help="comma-separated node ids, in order")
    ap.add_argument("--hook", help="hook type: command | prompt | node | skill")
    ap.add_argument("--when", choices=("before", "after"))
    ap.add_argument("--anchor", help="the node or phase the hook attaches to")
    ap.add_argument("--ref", default="")
    ap.add_argument("--run", default="")
    ap.add_argument("--text", default="")
    ap.add_argument("--phases", help="JSON list of {name, nodes} to set for --command")
    ap.add_argument("--template-section",
                    help="a `## heading` in the step's template to point at a fragment")
    ap.add_argument("--fragment", default=None,
                    help="the fragment to put there; empty restores the shipped section")
    ap.add_argument("--renamed", nargs=2, metavar=("FROM", "TO"),
                    help="a phase this write renames, so its hooks follow it")
    ap.add_argument("--edit-index", type=int,
                    help="replace the hook at this index under --when/--anchor")
    ap.add_argument("--remove-index", type=int,
                    help="remove the hook at this index under --when/--anchor")
    ap.add_argument("--workflow", help="switch to this workflow")
    ap.add_argument("--new-workflow", help="create this workflow and switch to it")
    ap.add_argument("--seed-from", default="",
                    help="workflow to copy when creating one, or preset:<name>")
    ap.add_argument("--new-step", help="create this step, seeded runnable")
    ap.add_argument("--label", default="", help="how a new step reads")
    ap.add_argument("--after", default="",
                    help="the step a new step runs behind; omit to launch it by hand")
    ap.add_argument("--writes", default="",
                    help="the file a new step produces; omit for a step that writes none")
    args = ap.parse_args()

    project = os.path.abspath(args.project)

    # The build and the graph both read a project's own nodes; the write path
    # has to see the same ones, or it refuses a grouping that names a node this
    # project wrote — which is every step handed to a document of its own.
    import _command_parts as cp

    cp.use_project_nodes(project)

    selection_path = os.path.join(project, ".specify", "companion.yml")
    try:
        # A step is files, not a key in the configuration — nothing in
        # companion.yml has to change for the build to find it.
        if args.new_step:
            made = new_step(project, args.new_step, args.label, args.after, args.writes)
            print(f"[config] created {os.path.relpath(made, project)}")
            return 0

        # The selection lives in companion.yml; everything else lives in
        # whichever file that selection points at.
        path = (selection_path if (args.workflow or args.new_workflow)
                else config_path(project))
        if args.new_workflow:
            created = new_workflow(project, args.new_workflow, args.seed_from)
            save_config(path, set_workflow(read_config(path), args.new_workflow))
            print(f"[config] created {os.path.relpath(created, project)} and switched to it")
            return 0

        if args.workflow:
            save_config(path, set_workflow(read_config(path), args.workflow))
            print(f"[config] now running '{args.workflow}'")
            return 0

        if args.remove_index is not None:
            if not (args.command and args.when and args.anchor):
                raise ConfigWriteError("removing a hook needs --command, --when and --anchor")
            save_config(path, replace_hook(
                read_config(path), args.command, args.when, args.anchor,
                args.remove_index, None))
            print(f"[config] removed a hook {args.when} {args.anchor}")
            return 0

        if args.hook:
            if not args.command:
                raise ConfigWriteError("a hook needs --command")
            if not args.when or not args.anchor:
                raise ConfigWriteError("a hook needs --when and --anchor")
            hook = {"type": args.hook, "ref": args.ref, "run": args.run, "text": args.text}
            existing = read_config(path)
            if args.edit_index is not None:
                updated = replace_hook(
                    existing, args.command, args.when, args.anchor, args.edit_index, hook)
            else:
                updated = add_hook(existing, args.command, args.when, args.anchor, hook)
            save_config(path, updated)
            print(f"[config] {args.command}: {args.hook} hook added {args.when} {args.anchor}")
            return 0

        if not args.command:
            raise ConfigWriteError(
                "nothing to write — pass --command, --workflow, --new-workflow or --new-step")

        if args.template_section is not None:
            if not args.command:
                raise ConfigWriteError("a template section needs --command")
            check_template_section(project, args.command, args.template_section,
                                   args.fragment)
            save_config(path, set_template_section(
                read_config(path), args.command, args.template_section,
                args.fragment or None))
            where = f"uses {args.fragment}" if args.fragment else "back to the shipped one"
            print(f"[config] {args.command}: '{args.template_section}' {where}")
            return 0

        if args.phases:
            import json

            phases = json.loads(args.phases)
            nodes = ([n.strip() for n in args.nodes.split(",") if n.strip()]
                     if args.nodes else None)

            # Together when both are given, because a swap is neither an add nor
            # a drop but both at once: the old node leaves the order and the new
            # one joins it, and whichever half is written first is refused by a
            # check reading the other half as it was. Validating the pair against
            # each other is the only order that exists for that.
            #
            # A phase is owed only to a node the step RUNS, and an order is only
            # expressible if its phases can hold it — so each check reads what
            # this write is about to make true, not what the file says now.
            use_order(args.command, nodes or resolved_order(project, args.command))
            use_phases_in_force(project, args.command, phases)
            check_phases(args.command, phases)
            if nodes is not None:
                check_order(args.command, nodes)

            renamed = tuple(args.renamed) if args.renamed else None
            updated = set_phases(read_config(path), args.command, phases, renamed)
            if nodes is not None:
                updated = set_nodes(updated, args.command, nodes)
            save_config(path, updated)
            what = "phases and order" if nodes is not None else "phases"
            print(f"[config] {args.command}: {what} saved to {os.path.relpath(path, project)}")
            return 0

        if not args.nodes:
            raise ConfigWriteError("nothing to write — pass --nodes or --hook")
        nodes = [n.strip() for n in args.nodes.split(",") if n.strip()]
        use_phases_in_force(project, args.command)
        check_order(args.command, nodes)
        write_nodes(path, args.command, nodes)
    except ConfigWriteError as err:
        print(f"[config] {err}")
        return 1
    print(f"[config] {args.command}: order saved to {os.path.relpath(path, project)}")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
