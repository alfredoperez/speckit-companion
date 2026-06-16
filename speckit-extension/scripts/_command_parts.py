"""Shared helpers for the command-parts build + parity tooling.

Single source of: which command bodies are tracked, how a part fence looks, and
how a body is canonicalized for golden comparison. Stdlib only.
"""
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

# Marker-comment lines stripped before golden comparison (legacy timing + the
# generalized part fences). Content survives; only the convention scaffolding
# is normalized away, so a marker rename is not counted as a content change.
_MARKER_LINE = re.compile(
    r"^[ \t]*<!-- /?speckit-companion:(?:part [\w-]+|timing) -->[ \t]*\n?",
    re.MULTILINE,
)


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


def canonical(text: str) -> str:
    """Strip fence/marker comment lines so golden compares content, not convention."""
    return _MARKER_LINE.sub("", text)


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


def read_node(command: str, node_id: str) -> tuple:
    """Return (meta_dict, body) for a node file, or raise if missing."""
    path = os.path.join(nodes_command_dir(command), f"{node_id}.md")
    if not os.path.isfile(path):
        raise SystemExit(f"[nodes] missing node file: {command}/{node_id}.md")
    with open(path, encoding="utf-8") as fh:
        fm, body = split_frontmatter(fh.read())
    return parse_node_meta(fm), body
