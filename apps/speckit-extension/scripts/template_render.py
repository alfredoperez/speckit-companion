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
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec_context import BUILT_TEMPLATES_REL, STEP_TEMPLATES, core_template_text  # noqa: E402

#: A markdown section header: `## Name`, optionally with trailing decoration
#: (`*(mandatory)*`), which is part of the heading line but not of its name.
SECTION_RE = re.compile(r"^(#{2,3})\s+(.+?)\s*$", re.MULTILINE)

#: A fragment's leading `---` header, which describes it to the panel.
_FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.S)

#: The fragments Companion ships. A project's own `.specify/companion/fragments/`
#: is searched first, so writing one of these names replaces it rather than
#: colliding with it.
SHIPPED_FRAGMENTS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fragments")

DEFAULT_TEMPLATE_BY_COMMAND = STEP_TEMPLATES


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


BUILT_REL = BUILT_TEMPLATES_REL
#: Older builds' copies: still a spec-kit extension layer until a build removes them.
LEGACY_BUILT_REL = os.path.join(".specify", "extensions", "companion", "templates")
RESOLVER_REL = os.path.join(".specify", "scripts", "bash", "resolve-template.sh")


def _read(path: str):
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return fh.read()


core_template = core_template_text


def base_template(project_root: str, name: str):
    """The template spec-kit's own resolver picks for `name`; raises when it fails."""
    script = os.path.join(project_root, RESOLVER_REL)
    core = core_template(project_root, name)
    if not os.path.isfile(script):
        return core
    stem = name[:-3] if name.endswith(".md") else name
    env = dict(os.environ, SPECIFY_INIT_DIR=project_root)
    try:
        run = subprocess.run(["bash", script, stem], cwd=project_root, env=env,
                             capture_output=True, text=True, timeout=30)
    except OSError:
        return core
    except subprocess.SubprocessError as err:
        raise TemplateError(f"spec-kit could not resolve {stem}: {err}") from err
    if run.returncode != 0 and core is None:
        return None
    if run.returncode != 0:
        detail = (run.stderr or "").strip().splitlines()
        raise TemplateError(
            f"spec-kit could not resolve {stem}: {detail[-1] if detail else 'no reason given'}")
    if run.stdout == _read(os.path.join(project_root, LEGACY_BUILT_REL, name)):
        return core
    return run.stdout


def render_shape_note(name: str, changed: list, whole: bool = False) -> str:
    """The note spliced into a body when a project reshaped this step's document.

    Companion's authoring nodes carry their document's shape in their own
    instructions rather than loading a template — that is where the leaner spec
    comes from. So resolving a template wrote a correct file that nothing read:
    a project could point a section at a fragment, watch the build report it
    resolved, and get the shipped shape anyway. Every fragment, and the whole
    Classic preset, was decoration.

    The note is what closes that. It is absent unless a project changed a
    section or spec-kit's stack hands back a team template, so a project that
    changed nothing gets a byte-identical body and the shipped default keeps its
    own shape.
    """
    path = os.path.join(BUILT_REL, name)
    if whole:
        return (
            f"**This project shapes what this step writes with its own template.** "
            f"Read `{path}` and follow its sections and their order in place of the "
            f"shape described below. Every other instruction in this step still applies."
        )
    if not changed:
        return ""
    sections = ", ".join(f"**{s}**" for s in changed)
    return (
        f"**This project has reshaped what this step writes.** Read "
        f"`{path}` and follow it for {sections} — "
        f"its wording there replaces the shape described below for "
        f"{'that section' if len(changed) == 1 else 'those sections'}. Every "
        f"other instruction in this step still applies."
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


def resolve(command: str, config: dict, project_root: str, fragments_dir: str) -> tuple:
    """(name, text, changed sections, whole); whole means a team template the step follows entirely."""
    settings = template_config(config, command)
    if not settings:
        name = DEFAULT_TEMPLATE_BY_COMMAND.get(command)
        try:
            winner = base_template(project_root, name) if name else None
        except TemplateError:
            winner = None
        if winner is None or winner == core_template(project_root, name):
            return None, None, [], False
        return name, winner, [], True

    name = settings.get("file") or DEFAULT_TEMPLATE_BY_COMMAND.get(command)
    if not name:
        raise TemplateError(f"{command}: no template to resolve — name one with `file:`")

    text = base_template(project_root, name)
    if text is None:
        raise TemplateError(f"{command}: no template at {name}")
    team = text != core_template(project_root, name)

    changed = []
    for section, fragment_name in (settings.get("sections") or {}).items():
        fragment = find_fragment(fragment_name, fragments_dir)
        if not fragment:
            raise TemplateError(
                f"{command}: section '{section}' names fragment '{fragment_name}', "
                f"which is neither in {os.path.basename(fragments_dir)}/ nor shipped"
            )
        with open(fragment, encoding="utf-8") as fh:
            replacement = _strip_frontmatter(fh.read())
        text = replace_section(text, section, replacement)
        changed.append(section)

    return name, text, changed, team


def find_fragment(name: str, fragments_dir: str):
    """The file for a fragment name — the project's copy first, then the shipped one.

    Same precedence as a node: a project that writes `outcomes.md` of its own
    replaces the shipped fragment of that name rather than colliding with it.

    A name, not a path. Joined unchecked, `../../../../etc/hosts` resolved
    outside the project and was spliced into the rendered template.
    """
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", name or ""):
        return None
    own = os.path.join(fragments_dir, f"{name}.md")
    if os.path.isfile(own):
        return own
    shipped = os.path.join(SHIPPED_FRAGMENTS, f"{name}.md")
    return shipped if os.path.isfile(shipped) else None


def shipped_fragments() -> list:
    """Every fragment Companion ships, as `{name, section, for, summary}`.

    What the panel offers for a template section. The frontmatter says which
    section a fragment is written for, so a picker can show only the ones that
    belong to the row someone is editing.
    """
    if not os.path.isdir(SHIPPED_FRAGMENTS):
        return []
    out = []
    for filename in sorted(os.listdir(SHIPPED_FRAGMENTS)):
        if not filename.endswith(".md") or filename.startswith("_"):
            continue
        with open(os.path.join(SHIPPED_FRAGMENTS, filename), encoding="utf-8") as fh:
            meta = _frontmatter(fh.read())
        out.append({
            "name": filename[:-3],
            "section": meta.get("section", ""),
            "for": meta.get("for", ""),
            "summary": meta.get("summary", ""),
        })
    return out


def _frontmatter(text: str) -> dict:
    """A fragment's `key: value` header, or `{}` when it has none."""
    match = _FRONTMATTER.match(text)
    if not match:
        return {}
    out = {}
    for line in match.group(1).splitlines():
        if ":" in line and not line.strip().startswith("#"):
            key, value = line.split(":", 1)
            out[key.strip()] = value.strip().strip("\"'")
    return out


def _strip_frontmatter(text: str) -> str:
    """The fragment's body. Its header describes it to the panel, not to the reader."""
    return _FRONTMATTER.sub("", text, count=1).lstrip("\n")
