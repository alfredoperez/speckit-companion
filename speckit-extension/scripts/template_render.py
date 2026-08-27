#!/usr/bin/env python3
"""Resolving a project's templates: which one a step uses, and what replaces a section of it.

The specimen customisation in the design is a project that wants its specs
shaped around outcomes instead of user stories. That variation already exists
inside the product — as a hardcoded branch reachable only when the classifier
decides a change is small — and there has been no way for a project to ask for
it. This is the mechanism that makes it an ordinary thing to configure.

A section is addressed by its heading, because that is what a template already
has: `spec-template.md` is a sequence of `## Heading` blocks and every reader,
human or model, already navigates it that way. No new marker syntax to learn,
and a template a project has edited by hand keeps working.

Three ways a step relates to a template, per the design:
  whole      — produce the document from the template as it is
  section    — replace one named section, leaving the rest of the template alone
  own files  — write something the template does not describe (needs nothing here)

Stock templates are never edited in place. A build writes a resolved copy into
the project's built output, so an upgrade that changes the stock template does
not silently discard what the project asked for.

Stdlib only.
"""
from __future__ import annotations

import os
import re

#: A markdown section header: `## Name`, optionally with trailing decoration
#: (`*(mandatory)*`), which is part of the heading line but not of its name.
SECTION_RE = re.compile(r"^(#{2,3})\s+(.+?)\s*$", re.MULTILINE)

DEFAULT_TEMPLATE_BY_COMMAND = {
    "specify": "spec-template.md",
    "plan": "plan-template.md",
    "tasks": "tasks-template.md",
}


class TemplateError(Exception):
    """A template resolution that cannot complete."""


def section_names(text: str) -> list:
    """Every section heading in a template, in document order.

    Decoration is stripped from the name so a project addresses
    `User Scenarios & Testing` rather than repeating `*(mandatory)*`.
    """
    return [_clean(m.group(2)) for m in SECTION_RE.finditer(text)]


def _clean(heading: str) -> str:
    return re.sub(r"\s*\*\([^)]*\)\*\s*$", "", heading).strip()


def replace_section(text: str, name: str, replacement: str) -> str:
    """Swap the body of the section called `name`, keeping its heading line.

    The heading stays because it is what the rest of the document — and the
    assistant reading it — uses to find the section. Only the content beneath it
    changes, up to the next heading of the same or higher level.

    Raises when the section is not there: a replacement aimed at a heading that
    does not exist is a configuration that silently does nothing, which is the
    failure this whole area keeps closing.
    """
    matches = list(SECTION_RE.finditer(text))
    for i, match in enumerate(matches):
        if _clean(match.group(2)) != name:
            continue
        level = len(match.group(1))
        body_start = match.end()
        body_end = len(text)
        for later in matches[i + 1:]:
            if len(later.group(1)) <= level:
                body_end = later.start()
                break
        body = "\n\n" + replacement.strip("\n") + "\n\n"
        return text[:body_start] + body + text[body_end:]

    available = ", ".join(section_names(text)) or "none"
    raise TemplateError(
        f"no section called '{name}' in this template — it has: {available}"
    )


def template_config(config: dict, command: str) -> dict:
    """The template settings that apply to a command, inner-most wins.

    A `templates:` block at the top level applies to every command; the same key
    under `commands.<name>` overrides it. That is the step → node inheritance the
    design asks for, at the two levels that exist today.
    """
    base = dict((config.get("templates") or {}).get(command) or {})
    override = (config.get("commands") or {}).get(command) or {}
    base.update(override.get("template") or {})
    return base


def resolve(command: str, config: dict, templates_dir: str, fragments_dir: str) -> tuple:
    """Return (template_name, resolved_text, changed_sections) for one command.

    Returns `(None, None, [])` when the project asked for nothing — the command
    keeps using the stock template and the build writes no copy.
    """
    settings = template_config(config, command)
    if not settings:
        return None, None, []

    name = settings.get("file") or DEFAULT_TEMPLATE_BY_COMMAND.get(command)
    if not name:
        raise TemplateError(f"{command}: no template to resolve — name one with `file:`")

    source = os.path.join(templates_dir, name)
    if not os.path.isfile(source):
        raise TemplateError(f"{command}: no template at {name}")
    with open(source, encoding="utf-8") as fh:
        text = fh.read()

    changed = []
    for section, fragment_name in (settings.get("sections") or {}).items():
        fragment = os.path.join(fragments_dir, f"{fragment_name}.md")
        if not os.path.isfile(fragment):
            raise TemplateError(
                f"{command}: section '{section}' names fragment '{fragment_name}', "
                f"which is not in {os.path.basename(fragments_dir)}/"
            )
        with open(fragment, encoding="utf-8") as fh:
            replacement = fh.read()
        text = replace_section(text, section, replacement)
        changed.append(section)

    return name, text, changed
