#!/usr/bin/env python3
"""Carry a built command body out to the copies each agent actually reads.

A build writes `.specify/extensions/companion/commands/<cmd>.md`. That is the
extension's copy, and nothing dispatches it. What an assistant loads is the
EMISSION the installer wrote into that agent's own directory —
`.claude/skills/speckit-companion-specify/SKILL.md`,
`.github/prompts/speckit.companion.specify.prompt.md`, and so on — rendered once
when `specify extension add` ran and never again.

So a project could reorder its nodes, attach a hook, swap a block, click Build,
watch the panel report "built 5 commands", and have the assistant keep running
the pipeline as it was installed. The build was real and reached nothing.

**The render is a frontmatter swap.** Verified across every emission this
repository has: the agent's frontmatter differs, the body is the command body
byte for byte. So syncing is not re-implementing the installer for seven agent
formats — it is replacing the body under a header we leave exactly alone.

Two rules keep that safe:

  A file is only rewritten when its current body carries the node/part markers
  an assembled body has. `.github/prompts/*.prompt.md` is a three-line pointer
  at the agent file with no body at all, and splicing one in would corrupt it.

  Whatever the installer put between the frontmatter and the body — a blank
  line, `<!-- Extension: companion -->` banners — is preserved. It is the
  installer's, not ours, and only the body below it is stale.

Writes follow symlinks on purpose: a dev install points several agent
directories at one rendered file, and rewriting through the link updates all of
them the way the installer does.

Stdlib only.
"""
from __future__ import annotations

import os
import re

#: How a command name becomes an entry in each agent's install directory.
#: `dir` areas hold one directory per command; `file` areas hold one file.
#: `check-command-emissions.py` imports this — the inventory gate and the sync
#: have to look in the same places or one of them silently stops covering an
#: agent, which is the drift that gate exists to catch.
KNOWN_AREAS = {
    ".claude/skills": ("dir", ""),
    ".agents/skills": ("dir", ""),
    ".cursor/skills": ("dir", ""),
    ".github/prompts": ("file", ".prompt.md"),
    ".github/agents": ("file", ".agent.md"),
    ".qwen/commands": ("file", ".md"),
    ".gemini/commands": ("file", ".toml"),
}

#: The prefix a command carries as a dotted name, and as a directory name.
PREFIX = "speckit.companion."
DASHED_PREFIX = "speckit-companion-"

#: What an assembled body always carries and a stub never does. The build writes
#: these markers into every command it assembles, so their presence is the
#: difference between "this file is a command body" and "this file is a pointer".
_MARKERS = ("<!-- speckit-companion:node ", "<!-- speckit-companion:part ")


class EmissionError(Exception):
    """An emission that could not be read or written."""


def entry_for(command: str, area: str) -> str:
    """The on-disk entry `command` takes in `area`, relative to that area."""
    style, suffix = KNOWN_AREAS[area]
    if style == "dir":
        return os.path.join(f"{DASHED_PREFIX}{command}", "SKILL.md")
    return f"{PREFIX}{command}{suffix}"


def emission_paths(project_root: str, command: str) -> list:
    """Every file an agent would read for `command`, that exists on disk.

    An area with none of our entries is an agent this project does not use, not
    a failure — a project installs for the assistants it has.
    """
    found = []
    for area in sorted(KNOWN_AREAS):
        path = os.path.join(project_root, area, entry_for(command, area))
        if os.path.isfile(path):
            found.append(path)
    return found


def _split_frontmatter(text: str) -> tuple:
    """Return (header, body). `header` includes the closing `---` and its newline.

    A file with no frontmatter is all body, which is what the caller wants: it
    then fails the marker test and is left alone.
    """
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[:end + 5], text[end + 5:]


def _split_banner(body: str) -> tuple:
    """Return (banner, rest) — the installer's own lines above the command body.

    `.github/agents` emissions carry `<!-- Extension: companion -->` under the
    frontmatter. Those are the installer's and say where the command came from;
    dropping them on every build would quietly strip provenance the uninstall
    path and a reader both use.
    """
    lines = body.splitlines(keepends=True)
    at = 0
    while at < len(lines):
        stripped = lines[at].strip()
        if not stripped or (stripped.startswith("<!--") and stripped.endswith("-->")):
            at += 1
            continue
        break
    # Only a run that actually contains a comment is a banner. A body that simply
    # opens with a blank line — which every assembled body does — is not one.
    if not any(l.strip().startswith("<!--") for l in lines[:at]):
        return "", body
    return "".join(lines[:at]), "".join(lines[at:])


def _is_command_body(body: str) -> bool:
    return any(marker in body for marker in _MARKERS)


#: Emission formats this can rewrite. Everything here is frontmatter plus a
#: markdown body, so splicing a built body in is a whole-file replacement of the
#: part below the frontmatter.
#:
#: TOML is deliberately absent. A Gemini command wraps the same instructions in
#: `prompt = """…"""`, and the markers ride inside that string — so the body test
#: passes, and writing a bare markdown body over it produced a file with no
#: `description` and no `prompt` key: invalid TOML that Gemini cannot dispatch,
#: on every build of a project with Gemini installed. Splicing into the string
#: is real work; until it is done this reports the file rather than breaking it.
_REWRITABLE = (".md", ".prompt.md", ".agent.md")


def _rewritable(path: str) -> bool:
    return path.endswith(_REWRITABLE)


def sync_command(project_root: str, command: str, built_body: str) -> list:
    """Rewrite every emission of `command` to carry `built_body`. Returns the paths.

    The built body's own frontmatter is dropped: the emission already has the
    frontmatter its agent needs, written by the installer in that agent's format,
    and that is the one piece of an emission this must not touch.
    """
    _, new_body = _split_frontmatter(built_body)
    written = []
    for path in emission_paths(project_root, command):
        if not _rewritable(path):
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                current = fh.read()
        except OSError as err:
            raise EmissionError(f"{path}: {err}") from err

        header, body = _split_frontmatter(current)
        if not _is_command_body(body):
            # A pointer file, or something that is not an assembled body. Leaving
            # it alone is the only safe move; splicing a body into a three-line
            # stub produces a file the agent cannot read.
            continue
        banner, _rest = _split_banner(body)
        updated = header + banner + new_body
        if updated == current:
            continue
        try:
            # `w` follows a symlink to its target, which is what a dev install
            # wants: several agent directories point at one rendered file.
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(updated)
        except OSError as err:
            raise EmissionError(f"{path}: {err}") from err
        written.append(path)
    return written


def _sibling(project_root: str, area: str, exclude: str):
    """Another command's emission in this area — a real example of its format.

    Used to give a project's own step an emission. The alternative is rendering
    seven agent formats from a spec nobody wrote down, and one of them is TOML;
    copying a file the installer actually produced is not a guess.
    """
    directory = os.path.join(project_root, area)
    if not os.path.isdir(directory):
        return None
    style, _suffix = KNOWN_AREAS[area]
    for name in sorted(os.listdir(directory)):
        if name in (f"{DASHED_PREFIX}{exclude}", f"{PREFIX}{exclude}"):
            continue
        if style == "dir":
            if not name.startswith(DASHED_PREFIX):
                continue
            path = os.path.join(directory, name, "SKILL.md")
        else:
            if not name.startswith(PREFIX):
                continue
            path = os.path.join(directory, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue
        header, body = _split_frontmatter(text)
        if header and _is_command_body(body):
            return header, name
    return None


#: A frontmatter entry: its indent, key, separator and value. Both `:` and `=`,
#: because one of the agent formats is TOML.
_ENTRY = re.compile(r"^(\s*)([\w.-]+)(\s*[:=]\s*)(.*)$")

#: The keys that carry the command's identity rather than its content.
_IDENTITY = ("name", "agent")


def _renamed_header(header: str, sibling: str, command: str, description: str) -> str:
    """A sibling's frontmatter with its identity swapped for this command's.

    Line by line rather than by pattern, because a `description:` can WRAP: the
    installer writes a long one across two lines, and replacing only the line the
    key is on leaves the tail of the old description dangling under the new one,
    which is what a naive substitution produced.

    A continuation is a line more indented than its key that is not itself an
    entry — that distinction is what keeps a nested `metadata:` block intact.
    """
    dashed_from, dashed_to = f"{DASHED_PREFIX}{sibling}", f"{DASHED_PREFIX}{command}"
    dotted_from, dotted_to = f"{PREFIX}{sibling}", f"{PREFIX}{command}"

    out, lines, i = [], header.splitlines(), 0
    while i < len(lines):
        match = _ENTRY.match(lines[i])
        if not match:
            out.append(lines[i])
            i += 1
            continue

        pad, key, sep, value = match.groups()
        if key == "description":
            quote = value[:1] if value[:1] in "\"'" else ""
            out.append(f"{pad}{key}{sep}{quote}{description}{quote}")
        elif key in _IDENTITY:
            out.append(f"{pad}{key}{sep}"
                       + value.replace(dashed_from, dashed_to).replace(dotted_from, dotted_to))
        else:
            out.append(lines[i])
        i += 1
        # Drop what wrapped off the end of the value we just replaced.
        while i < len(lines):
            tail = lines[i]
            if not tail.strip() or len(tail) - len(tail.lstrip()) <= len(pad):
                break
            if _ENTRY.match(tail):
                break
            if key in ("description",) + _IDENTITY:
                i += 1
                continue
            out.append(tail)
            i += 1

    text = "\n".join(out) + ("\n" if header.endswith("\n") else "")
    # Anything else carrying the old identity — a `source:` pointing at the
    # command file, say — follows the same swap.
    return text.replace(dashed_from, dashed_to).replace(dotted_from, dotted_to)


def create_command(project_root: str, command: str, built_body: str,
                   description: str = "") -> list:
    """Give a command with no emission one, modelled on a sibling in each area.

    A step a project added will never be in `extension.yml`, which is the
    extension's own file and what the installer reads — so reinstalling can never
    register it, and the command was built into a file nothing could dispatch.
    The build writes the emission itself, in the format that area already uses.
    """
    _, new_body = _split_frontmatter(built_body)
    written = []
    for area in sorted(KNOWN_AREAS):
        if not os.path.isdir(os.path.join(project_root, area)):
            continue
        found = _sibling(project_root, area, command)
        if not found:
            continue
        header, sibling_entry = found
        sibling = (sibling_entry[len(DASHED_PREFIX):] if sibling_entry.startswith(DASHED_PREFIX)
                   else sibling_entry[len(PREFIX):].split(".")[0])
        path = os.path.join(project_root, area, entry_for(command, area))
        if os.path.exists(path):
            continue
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(_renamed_header(header, sibling, command,
                                         description or f"This project's {command} step")
                         + new_body)
        except OSError as err:
            raise EmissionError(f"{path}: {err}") from err
        written.append(path)
    return written


def sync(project_root: str, bodies: dict, descriptions: dict = None) -> tuple:
    """Sync every built body out to its emissions, creating the ones that are missing.

    Returns `(written, created, unreached, stale)` — emissions updated, emissions
    made for a command that had none, commands still reachable by nothing, and
    emissions in a format this cannot rewrite yet.

    A step this project added is the case that needs creating: it will never be
    in `extension.yml`, which is the extension's own file and what the installer
    reads, so reinstalling could never register it and the built command sat in a
    file nothing could dispatch. `unreached` is what is left after trying — a
    project with no agent command directory to put one in.
    """
    descriptions = descriptions or {}
    written, created, unreached, stale = [], [], [], []
    for command, body in sorted(bodies.items()):
        paths = emission_paths(project_root, command)
        if paths:
            written.extend(sync_command(project_root, command, body))
            stale.extend(path for path in paths if not _rewritable(path))
            continue
        made = create_command(project_root, command, body, descriptions.get(command, ""))
        created.extend(made)
        if not made:
            unreached.append(command)
    return written, created, unreached, stale


def describe(written: list, created: list, unreached: list, project_root: str,
             stale: list = None) -> list:
    """The lines a build prints about what it carried out to the agents."""
    out = []
    if written:
        areas = sorted({_area_of(path, project_root) for path in written})
        out.append(f"[build] refreshed {len(written)} agent command "
                   f"{'file' if len(written) == 1 else 'files'} in {', '.join(areas)}")
    if created:
        areas = sorted({_area_of(path, project_root) for path in created})
        out.append(f"[build] gave {len(created)} new agent command "
                   f"{'file' if len(created) == 1 else 'files'} to {', '.join(areas)}")
    if unreached:
        # Nothing to model an emission on, which means no agent is installed
        # here. Naming it beats a count that suggests the pipeline all moved.
        out.append(
            f"[build] nothing can dispatch {', '.join(unreached)} — this project "
            "has no agent command directory to put it in")
    for path in sorted(stale or []):
        # Named one by one on purpose. This file keeps the pipeline it had
        # before the edit, and a count would let somebody read "built 5
        # commands" as "every agent has the new one".
        out.append(f"[build] left {os.path.relpath(path, project_root)} alone — this "
                   "format is not one the build can rewrite yet, so it still "
                   "carries the pipeline it had")
    return out


def _area_of(path: str, project_root: str) -> str:
    """Which known area a written emission belongs to."""
    rel = os.path.relpath(path, project_root)
    for area in KNOWN_AREAS:
        if rel.startswith(area + os.sep):
            return area
    return os.path.dirname(rel)
