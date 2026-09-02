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


def sync_command(project_root: str, command: str, built_body: str) -> list:
    """Rewrite every emission of `command` to carry `built_body`. Returns the paths.

    The built body's own frontmatter is dropped: the emission already has the
    frontmatter its agent needs, written by the installer in that agent's format,
    and that is the one piece of an emission this must not touch.
    """
    _, new_body = _split_frontmatter(built_body)
    written = []
    for path in emission_paths(project_root, command):
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


def sync(project_root: str, bodies: dict) -> tuple:
    """Sync every built body out to its emissions.

    Returns `(written, unreached)` — the emission paths updated, and the commands
    that were built but have no emission anywhere. A command with no emission is
    one the assistant cannot dispatch: a step this project added, which the
    installer has never seen. The build says so rather than reporting a number
    that suggests the whole pipeline moved.
    """
    written, unreached = [], []
    for command, body in sorted(bodies.items()):
        paths = sync_command(project_root, command, body)
        written.extend(paths)
        if not emission_paths(project_root, command):
            unreached.append(command)
    return written, unreached


def describe(written: list, unreached: list, project_root: str) -> list:
    """The lines a build prints about what it carried out to the agents."""
    out = []
    if written:
        areas = sorted({_area_of(path, project_root) for path in written})
        out.append(f"[build] refreshed {len(written)} agent command "
                   f"{'file' if len(written) == 1 else 'files'} in {', '.join(areas)}")
    if unreached:
        out.append(
            "[build] not reachable by the assistant yet — no agent has a command "
            f"for {', '.join(unreached)}. Run `specify extension add <ext> --force` "
            "to register it.")
    return out


def _area_of(path: str, project_root: str) -> str:
    """Which known area a written emission belongs to."""
    rel = os.path.relpath(path, project_root)
    for area in KNOWN_AREAS:
        if rel.startswith(area + os.sep):
            return area
    return os.path.dirname(rel)
