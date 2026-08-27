"""Shared helpers for the command-parts build + parity tooling.

Single source of: which command bodies are tracked, how a part fence looks, how a
body is canonicalized for golden comparison, and what `extension.yml` declares
under `provides.commands`. Stdlib only.
"""
from __future__ import annotations

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.dirname(HERE)  # speckit-extension/

PARTS_DIR = "presets/_parts"
GOLDEN_DIR = "tests/golden/commands"
NODES_DIR = "nodes"

# Companion-standard preset commands (host-editor profile bodies).
PRESET_CMDS = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "constitution"]
# Namespaced /speckit.companion.* bodies the parts mechanism covers.
NAMESPACED_CMDS = ["specify", "plan", "tasks", "implement", "classify", "mark-complete", "auto"]

GOLDEN_BODIES = (
    [f"presets/companion-standard/commands/speckit.{c}.md" for c in PRESET_CMDS]
    + [f"commands/speckit.companion.{c}.md" for c in NAMESPACED_CMDS]
)

# Part fence: <!-- speckit-companion:part NAME -->\n<content>\n<!-- /speckit-companion:part NAME -->
PART_FENCE = re.compile(
    r"<!-- speckit-companion:part ([\w-]+) -->\n(.*?)\n<!-- /speckit-companion:part \1 -->",
    re.DOTALL,
)
PART_OPEN = re.compile(r"<!-- speckit-companion:part ([\w-]+) -->")
PART_CLOSE = re.compile(r"<!-- /speckit-companion:part ([\w-]+) -->")

# Node boundary: <!-- speckit-companion:node ID -->\n<body>\n<!-- /speckit-companion:node ID -->
#
# A separate namespace segment from `part` on purpose. The part fences are
# filled by `fill_parts`, which raises on a name it does not recognise, so a
# node marker sharing that namespace would abort assembly.
#
# These exist so a hook or a replacement can name an exact point in an assembled
# command. Without them the only way to target a node's contribution was to match
# the prose around it.
NODE_OPEN = re.compile(r"<!-- speckit-companion:node ([\w-]+) -->")
NODE_CLOSE = re.compile(r"<!-- /speckit-companion:node ([\w-]+) -->")
# Phase boundary: the middle block. A phase groups the nodes of one step and is
# where a hook attaches — the design's "a phase is a hook boundary, not a
# dispatch boundary", so a step remains one dispatched command.
PHASE_OPEN = re.compile(r"<!-- speckit-companion:phase ([\w-]+) -->")
PHASE_CLOSE = re.compile(r"<!-- /speckit-companion:phase ([\w-]+) -->")
PHASE_FENCE = re.compile(
    r"<!-- speckit-companion:phase ([\w-]+) -->\n(.*?)\n<!-- /speckit-companion:phase \1 -->\n?",
    re.DOTALL,
)

NODE_FENCE = re.compile(
    r"<!-- speckit-companion:node ([\w-]+) -->\n(.*?)\n<!-- /speckit-companion:node \1 -->\n?",
    re.DOTALL,
)

# Marker-comment lines stripped before golden comparison (legacy timing + the
# generalized part fences). Content survives; only the convention scaffolding
# is normalized away, so a marker rename is not counted as a content change.
_MARKER_LINE = re.compile(
    r"^[ \t]*<!-- /?speckit-companion:(?:part [\w-]+|node [\w-]+|phase [\w-]+|timing) -->[ \t]*\n?",
    re.MULTILINE,
)

#: Node and phase boundaries alone — whole lines, newline included.
_NODE_MARKER_LINE = re.compile(
    r"^[ \t]*<!-- /?speckit-companion:(?:node|phase) [\w-]+ -->[ \t]*\n?",
    re.MULTILINE,
)


MANIFEST = "extension.yml"

# The `provides.commands:` block, ending at the next top-level key (`hooks:`,
# `tags:`, …). Bounding it matters: `file:`/`name:` also appear under `hooks:`
# and in descriptions, and an unbounded scan would pull those in as commands.
_COMMANDS_BLOCK = re.compile(
    r"^provides:\s*$.*?^\s+commands:\s*$\n(.*?)(?=^\S|\Z)",
    re.MULTILINE | re.DOTALL,
)
_COMMAND_NAME = re.compile(r"^\s*-\s*name:\s*(\S+)\s*$", re.MULTILINE)
_COMMAND_FILE = re.compile(r"^\s*file:\s*(\S+)\s*$", re.MULTILINE)
_COMMAND_DESC = re.compile(r"^\s*description:\s*(.+)$", re.MULTILINE)
_BODY_DESC = re.compile(r"^description:\s*(.+)$", re.MULTILINE)


def declared_commands(path: str | None = None) -> list:
    """The (name, file) pairs `extension.yml` declares under `provides.commands`.

    The one manifest reader in this repo, so a second parser cannot drift from it.
    Every failure to resolve the manifest raises: a reader that returned a short or
    empty list would make every downstream gate vacuously pass.
    """
    path = path or os.path.join(EXT, MANIFEST)
    if not os.path.isfile(path):
        raise SystemExit(f"[parts] no manifest at {path}")
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    block = _COMMANDS_BLOCK.search(text)
    if not block:
        raise SystemExit(f"[parts] no provides.commands block in {MANIFEST}")
    body = block.group(1)
    starts = [(m.start(), m.group(1)) for m in _COMMAND_NAME.finditer(body)]
    if not starts:
        raise SystemExit(f"[parts] provides.commands in {MANIFEST} declares no commands")
    pairs = []
    for i, (pos, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(body)
        found = _COMMAND_FILE.search(body, pos, end)
        if not found:
            raise SystemExit(f"[parts] provides.commands entry {name} in {MANIFEST} has no file:")
        pairs.append((name, found.group(1)))
    return pairs


def declared_command_names() -> list:
    return [name for name, _ in declared_commands()]


def declared_descriptions(path: str | None = None) -> dict:
    """`{command name: description}` as the manifest states it."""
    path = path or os.path.join(EXT, MANIFEST)
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    block = _COMMANDS_BLOCK.search(text)
    if not block:
        raise SystemExit(f"[parts] no provides.commands block in {MANIFEST}")
    body = block.group(1)
    starts = [(m.start(), m.group(1)) for m in _COMMAND_NAME.finditer(body)]
    out = {}
    for i, (pos, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(body)
        found = _COMMAND_DESC.search(body, pos, end)
        if found:
            out[name] = found.group(1).strip().strip('"')
    return out


def body_description(rel: str) -> str | None:
    """The `description:` a command body states in its own frontmatter — what the
    agent's command list shows, against the manifest's, which the catalog shows."""
    found = _BODY_DESC.search(read(rel))
    return found.group(1).strip().strip('"') if found else None


def golden_path(rel: str) -> str:
    """Map a body's repo-relative path to its flattened golden snapshot name."""
    return os.path.join(EXT, GOLDEN_DIR, rel.replace("/", "__"))


def read(rel: str) -> str:
    return open(os.path.join(EXT, rel), encoding="utf-8").read()


def part_path(name: str) -> str:
    return os.path.join(EXT, PARTS_DIR, f"{name}.md")


def part_content(name: str) -> str:
    """A part's canonical inner text (trailing newline stripped to match a region)."""
    with open(part_path(name), encoding="utf-8") as fh:
        return fh.read().rstrip("\n")


#: Appended only when `debug: true` is set. Absent from an off render entirely —
#: not present and inactive — so the off render stays byte-identical to golden.
DEBUG_TIMING = "debug-timing"


def append_part(text: str, name: str) -> str:
    """Append a whole part as its own fenced region at the end of a body."""
    block = part_content(name)
    return (f"{text}\n<!-- speckit-companion:part {name} -->\n"
            f"{block}\n<!-- /speckit-companion:part {name} -->\n")


def strip_part(text: str, name: str) -> str:
    """Remove a whole appended part region, fence included.

    Appending without stripping first is what let debug blocks accumulate one per
    build and survive the switch being turned off.
    """
    open_tag = f"<!-- speckit-companion:part {name} -->"
    close_tag = f"<!-- /speckit-companion:part {name} -->"
    while open_tag in text and close_tag in text:
        start = text.index(open_tag)
        end = text.index(close_tag, start) + len(close_tag)
        text = text[:start].rstrip("\n") + "\n" + text[end:].lstrip("\n")
    return text


def apply_debug(text: str, name: str, on: bool) -> str:
    """Return `text` carrying exactly one `name` region, or none at all.

    Idempotent in both directions: building twice with debug on yields one block,
    and turning it off removes the block rather than leaving it baked in.
    """
    text = strip_part(text, name)
    return append_part(text, name) if on else text


def project_root(start: str = None) -> str | None:
    """The project directory that owns `.specify/`, walking up from `start`.

    Deriving it as the parent of the extension directory only held in the source
    repo. Installed, the extension lives at `<project>/.specify/extensions/companion`,
    so the parent is `<project>/.specify/extensions` and the config lookup landed on
    a path that never exists — meaning a user's `debug: true` was never read.
    """
    here = os.path.abspath(start or EXT)
    while True:
        if os.path.isdir(os.path.join(here, ".specify")):
            return here
        parent = os.path.dirname(here)
        if parent == here:
            return None
        here = parent


def debug_on(root: str = None) -> bool:
    """Is `debug: true` set in this project's companion.yml?

    Read at render time, which is why a change to the flag reaches the next
    rendered command and never one already in flight. Any failure to read the
    config means off, inheriting the config loader's own failure table.
    """
    try:
        import companion_config

        resolved = root or project_root()
        return bool(resolved) and companion_config.debug_from_root(resolved)
    except Exception:  # noqa: BLE001 — a config that cannot be read is not debug
        return False


def canonical(text: str) -> str:
    """Strip fence/marker comment lines so golden compares content, not convention."""
    return _MARKER_LINE.sub("", text)


def strip_node_markers(text: str) -> str:
    """Remove node boundary lines, leaving every node's body exactly as it was.

    This is what makes the boundaries provably additive: the golden bodies are
    kept marker-free, and assembly is checked against them through this function.
    A marker that shifted a line, swallowed a blank one, or reordered anything
    fails that comparison.

    Whole lines are removed, including the newline that ends them, and nothing
    else is normalised — no whitespace collapsing, which would let a real
    difference hide behind the tidying.
    """
    return _NODE_MARKER_LINE.sub("", text)


def fill_parts(text: str, rel: str) -> str:
    """Fill every part-fence region in text from its presets/_parts/NAME.md file.

    Deterministic and idempotent: a fence already holding its part's content is
    rewritten to the same bytes. Unbalanced fences or an unknown part name are a
    hard error (never a silent no-op). Shared by build-commands and assemble-nodes
    so both pass commands through the identical part-fence step.
    """
    opens = PART_OPEN.findall(text)
    closes = PART_CLOSE.findall(text)
    if opens != closes:
        raise SystemExit(f"[parts] unbalanced/unclosed part fence in {rel}: opens={opens} closes={closes}")
    for name in opens:
        if not os.path.isfile(part_path(name)):
            raise SystemExit(f"[parts] unknown part '{name}' referenced in {rel} (no {name}.md in _parts/)")

    def repl(m):
        name = m.group(1)
        return f"<!-- speckit-companion:part {name} -->\n{part_content(name)}\n<!-- /speckit-companion:part {name} -->"

    return PART_FENCE.sub(repl, text)


def nodes_command_dir(command: str) -> str:
    return os.path.join(EXT, NODES_DIR, command)


def decomposed_commands() -> list:
    """Namespaced commands assembled from node files (a nodes/<command>/ dir exists)."""
    base = os.path.join(EXT, NODES_DIR)
    if not os.path.isdir(base):
        return []
    return sorted(
        d for d in os.listdir(base)
        if os.path.isdir(os.path.join(base, d)) and not d.startswith("_")
    )


def split_frontmatter(text: str) -> tuple:
    """Return (frontmatter_text, body). Only the FIRST leading --- block is meta;
    everything after it is body verbatim (so a body may itself begin with ---)."""
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[4:end], text[end + 5:]


def _parse_scalar(val: str):
    val = val.strip()
    if val.startswith("[") and val.endswith("]"):
        inner = val[1:-1].strip()
        return [x.strip().strip('"\'') for x in inner.split(",") if x.strip()] if inner else []
    return val.strip('"\'')


def parse_node_meta(frontmatter: str) -> dict:
    """Minimal `key: value` / `key: [a, b]` reader for node frontmatter (stdlib only)."""
    out = {}
    for raw in frontmatter.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, val = line.split(":", 1)
        out[key.strip()] = _parse_scalar(val)
    return out


def parse_order(path: str) -> list:
    """Read an _order.yml `order:` list — supports inline `[a, b]` and a block list."""
    ids = []
    in_order = False
    with open(path, encoding="utf-8") as fh:
        raw_lines = fh.readlines()
    for raw in raw_lines:
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("order:"):
            rest = s[len("order:"):].strip()
            if rest.startswith("[") and rest.endswith("]"):
                inner = rest[1:-1].strip()
                if inner:
                    ids.extend(x.strip() for x in inner.split(","))
                return ids
            in_order = True
            continue
        if in_order and s.startswith("- "):
            ids.append(s[2:].strip())
        elif in_order and not s.startswith("- "):
            break
    return ids


def parse_phases(path: str) -> list:
    """Read an `_order.yml` `phases:` block — `[{name, nodes: [...]}, ...]`.

    Returns `[]` for a file that declares only a flat `order:`. Both shapes are
    supported: phases are the middle block the design asks for, and a command
    that has not been grouped into them still assembles exactly as before.
    """
    phases = []
    current = None
    in_phases = False
    in_nodes = False
    with open(path, encoding="utf-8") as fh:
        raw_lines = fh.readlines()
    for raw in raw_lines:
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("phases:"):
            in_phases = True
            continue
        if not in_phases:
            continue
        if s.startswith("- name:"):
            if current:
                phases.append(current)
            current = {"name": s[len("- name:"):].strip(), "nodes": []}
            in_nodes = False
            continue
        if current is None:
            continue
        if s.startswith("nodes:"):
            rest = s[len("nodes:"):].strip()
            if rest.startswith("[") and rest.endswith("]"):
                inner = rest[1:-1].strip()
                if inner:
                    current["nodes"].extend(x.strip() for x in inner.split(","))
                in_nodes = False
            else:
                in_nodes = True
            continue
        if in_nodes and s.startswith("- "):
            current["nodes"].append(s[2:].strip())
        elif not s.startswith("- "):
            in_nodes = False
    if current:
        phases.append(current)
    return phases


#: A project's own node files, which replace the shipped ones of the same id.
PROJECT_NODES_REL = os.path.join(".specify", "companion", "nodes")

#: Set by a build for one project; unset means shipped nodes only. Golden parity
#: never sets it, so a project's replacements can never move the shipped goldens.
_project_root = None


def use_project_nodes(root):
    """Point node reads at one project's replacements. `None` restores shipped-only."""
    global _project_root
    _project_root = root


def project_node_path(command: str, node_id: str):
    """Where this project's replacement for a node would live, or None if unset."""
    if not _project_root:
        return None
    return os.path.join(_project_root, PROJECT_NODES_REL, command, f"{node_id}.md")


def node_source(command: str, node_id: str) -> tuple:
    """Return (path, replaced) for a node — the project's copy when it has one."""
    own = project_node_path(command, node_id)
    if own and os.path.isfile(own):
        return own, True
    return os.path.join(nodes_command_dir(command), f"{node_id}.md"), False


def read_node(command: str, node_id: str) -> tuple:
    """Return (meta_dict, body) for a node file, or raise if missing."""
    path, _replaced = node_source(command, node_id)
    if not os.path.isfile(path):
        raise SystemExit(f"[nodes] missing node file: {command}/{node_id}.md")
    with open(path, encoding="utf-8") as fh:
        fm, body = split_frontmatter(fh.read())
    return parse_node_meta(fm), body
