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

# Companion-standard preset commands (host-editor profile bodies).
PRESET_CMDS = ["specify", "clarify", "plan", "tasks", "analyze", "implement", "constitution"]
# Namespaced /speckit.companion.* bodies the parts mechanism covers.
NAMESPACED_CMDS = ["specify", "plan", "tasks", "implement", "classify", "mark-complete"]

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
    return open(part_path(name), encoding="utf-8").read().rstrip("\n")


def canonical(text: str) -> str:
    """Strip fence/marker comment lines so golden compares content, not convention."""
    return _MARKER_LINE.sub("", text)
