#!/usr/bin/env python3
"""Render (and optionally file) the spec-kit community-catalog submission issue.

Catalog updates are filed as an Extension Submission ISSUE on github/spec-kit,
never as a PR against `extensions/catalog.community.json` — that PR gets closed
(github/spec-kit#3937).

GitHub serializes an issue form as `### <label>` / blank / value. We hand-build
that markdown, so a heading that drifts from the upstream template would break
the maintainers' validation. Everything structural is therefore read from the
LIVE template at run time; nothing about headings, option text, or fence
languages is hardcoded. If the template can't be fetched we abort rather than
fall back to a remembered shape — that fallback is the exact failure this
script exists to prevent.

Stdlib only (PyYAML is not installed, and the repo's own loader chokes on the
template's `|` block scalars).

Exit codes: 0 ok · 2 preflight failed · 3 template drift needing a human.
"""

from __future__ import annotations

import argparse
import copy
import difflib
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = "github/spec-kit"
TEMPLATE_PATH = ".github/ISSUE_TEMPLATE/extension_submission.yml"
CATALOG_URL = "https://raw.githubusercontent.com/github/spec-kit/main/extensions/catalog.community.json"
EXT_ID = "companion"
OWNER_REPO = "alfredoperez/speckit-companion"

# Catalog-only fields with no home in extension.yml. Always carried through
# from the live entry; never invented, never recomputed.
CATALOG_ONLY = ("verified", "downloads", "stars", "created_at")

# Also catalog-only, but deliberately overridable: a reclassification is a real
# editorial decision, so it must be passed explicitly rather than defaulted to
# whatever happens to be live.
CATALOG_CLASSIFY = ("category", "effect")

# The catalog description is a separate surface from the manifest's: the
# manifest is gated under 100 chars, the catalog allows 200, and upstream has
# carried a longer one since the first listing. So it defaults to the LIVE
# catalog copy and is only changed when passed explicitly — never silently
# overwritten with the manifest's shorter line.
CATALOG_DESC_MAX = 200


# --------------------------------------------------------------------------
# minimal YAML reader — only what an issue-form template uses
# --------------------------------------------------------------------------

def _strip_scalar(v: str) -> str:
    v = v.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def _flow_seq(v: str) -> list:
    inner = v.strip()[1:-1]
    return [_strip_scalar(x) for x in inner.split(",") if x.strip()]


def parse_yaml(text: str):
    """Parse the subset an issue form needs: block maps/seqs, quoted and bare
    scalars, flow sequences, and block scalars (consumed by indentation)."""
    lines = text.splitlines()
    pos = 0

    def indent_of(line: str) -> int:
        return len(line) - len(line.lstrip(" "))

    def skip_block_scalar(base_indent: int):
        nonlocal pos
        while pos < len(lines):
            ln = lines[pos]
            if not ln.strip():
                pos += 1
                continue
            if indent_of(ln) <= base_indent:
                return
            pos += 1

    def parse_node(base_indent: int):
        nonlocal pos
        # decide map vs seq by the first meaningful line at this indent
        while pos < len(lines) and (not lines[pos].strip() or lines[pos].lstrip().startswith("#")):
            pos += 1
        if pos >= len(lines):
            return None
        if lines[pos].lstrip().startswith("- "):
            return parse_seq(base_indent)
        return parse_map(base_indent)

    def parse_seq(base_indent: int):
        nonlocal pos
        out = []
        while pos < len(lines):
            ln = lines[pos]
            if not ln.strip() or ln.lstrip().startswith("#"):
                pos += 1
                continue
            ind = indent_of(ln)
            if ind < base_indent or not ln.lstrip().startswith("- "):
                return out
            rest = ln.lstrip()[2:]
            item_indent = ind + 2
            if ":" in rest and not rest.strip().startswith("{"):
                # inline first key of a mapping item
                lines[pos] = " " * item_indent + rest
                out.append(parse_map(item_indent))
            else:
                out.append(_strip_scalar(rest))
                pos += 1
        return out

    def parse_map(base_indent: int):
        nonlocal pos
        out = {}
        while pos < len(lines):
            ln = lines[pos]
            if not ln.strip() or ln.lstrip().startswith("#"):
                pos += 1
                continue
            ind = indent_of(ln)
            if ind < base_indent:
                return out
            if ln.lstrip().startswith("- "):
                return out
            m = re.match(r"^\s*([^:#]+):\s*(.*)$", ln)
            if not m:
                pos += 1
                continue
            key, val = m.group(1).strip(), m.group(2)
            pos += 1
            v = val.strip()
            if v.startswith("|") or v.startswith(">"):
                skip_block_scalar(ind)
                out[key] = ""          # body text is never used, only structure
            elif v.startswith("[") and v.endswith("]"):
                out[key] = _flow_seq(v)
            elif v == "":
                out[key] = parse_node(ind + 1)
            else:
                out[key] = _strip_scalar(v)
        return out

    return parse_node(0)


# --------------------------------------------------------------------------
# fetching
# --------------------------------------------------------------------------

def _get(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


def _gh(args: list[str]) -> str:
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def fetch_template(local: str | None):
    if local:
        return parse_yaml(Path(local).read_text()), "local override (NOT a live fetch)"
    try:
        raw = _get(f"https://raw.githubusercontent.com/{REPO}/main/{TEMPLATE_PATH}")
    except Exception:
        raw = None
    if not raw:
        # raw CDN can lag or rate-limit anonymously; the API path is authenticated
        import base64
        blob = json.loads(_gh(["api", f"repos/{REPO}/contents/{TEMPLATE_PATH}"]))
        raw = base64.b64decode(blob["content"]).decode("utf-8")
    sha = json.loads(_gh(["api", f"repos/{REPO}/contents/{TEMPLATE_PATH}", "--jq", "{sha:.sha}"]))["sha"]
    return parse_yaml(raw), sha


def fetch_catalog_entry():
    data = json.loads(_get(CATALOG_URL))
    exts = data.get("extensions", data)
    return exts.get(EXT_ID)


def load_manifest(root: Path):
    return parse_yaml((root / "speckit-extension" / "extension.yml").read_text())


# --------------------------------------------------------------------------
# value derivation
# --------------------------------------------------------------------------

def derive_values(manifest: dict, catalog: dict, version: str, prose: dict,
                  classify: dict | None = None) -> dict:
    e = manifest["extension"]
    req = manifest.get("requires") or {}
    tools = req.get("tools") or []
    tool_lines = "\n".join(
        f"- `{t.get('name')}` ({'required' if str(t.get('required')).lower() == 'true' else 'optional'})"
        for t in tools
    )
    download = (
        f"https://github.com/{OWNER_REPO}/releases/download/"
        f"speckit-ext-v{version}/companion-{version}.zip"
    )
    assert "companion-latest" not in download, "download_url must be version-pinned"

    desc = (classify or {}).get("description") or catalog.get("description") or e["description"]
    if len(desc) >= CATALOG_DESC_MAX:
        raise SystemExit(f"[abort] catalog description is {len(desc)} chars, limit {CATALOG_DESC_MAX}")
    entry = build_catalog_entry(manifest, catalog, version, download, classify, desc)

    return {
        "extension-id": e["id"],
        "extension-name": e["name"],
        "version": version,
        "description": desc,
        "author": e["author"],
        "repository": e["repository"],
        "download-url": download,
        "license": e["license"],
        "homepage": e["homepage"],
        "documentation": catalog["documentation"],
        "changelog": catalog["changelog"],
        "speckit-version": req.get("speckit_version", ""),
        "required-tools": tool_lines,
        "commands-count": str(len(manifest["provides"]["commands"])),
        "hooks-count": str(len(manifest.get("hooks") or [])),
        "tags": ", ".join(manifest["tags"]),
        "features": prose["features"],
        "example-usage": prose["example"],
        "testing-details": prose["testing"],
        "catalog-entry": json.dumps({EXT_ID: entry}, indent=2, ensure_ascii=False),
        "additional-context": prose["context"],
    }


def build_catalog_entry(manifest: dict, catalog: dict, version: str, download: str,
                        classify: dict | None = None, desc: str | None = None) -> dict:
    """Deep-copy the LIVE entry and apply deltas. Never rebuild: the live entry
    carries category/effect/verified/downloads/stars/created_at, which exist
    nowhere in extension.yml — dropping them reads as a destructive edit."""
    e = manifest["extension"]
    entry = copy.deepcopy(catalog)
    entry["name"] = e["name"]
    entry["description"] = desc or catalog.get("description") or e["description"]
    entry["author"] = e["author"]
    entry["version"] = version
    entry["download_url"] = download
    entry["repository"] = e["repository"]
    entry["homepage"] = e["homepage"]
    entry["license"] = e["license"]
    entry["requires"] = {
        "speckit_version": (manifest.get("requires") or {}).get("speckit_version"),
        "tools": [
            {"name": t.get("name"), "required": str(t.get("required")).lower() == "true"}
            for t in ((manifest.get("requires") or {}).get("tools") or [])
        ],
    }
    entry["provides"] = {
        "commands": len(manifest["provides"]["commands"]),
        "hooks": len(manifest.get("hooks") or []),
    }
    entry["tags"] = list(manifest["tags"])
    entry["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
    for k in CATALOG_ONLY:
        if k in catalog:
            entry[k] = catalog[k]          # carried through verbatim
    for k in CATALOG_CLASSIFY:
        override = (classify or {}).get(k)
        entry[k] = override if override else catalog.get(k)
    return entry


# --------------------------------------------------------------------------
# checkbox attestations
# --------------------------------------------------------------------------

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().replace("`", "")).strip(" .")


# option -> "auto" (proved by a preflight check) or "attest" (human says so)
ASSERTIONS = {
    "testing": {
        "extension installs successfully via download url": "auto",
        "all commands execute without errors": "attest",
        "documentation is complete and accurate": "attest",
        "no security vulnerabilities identified": "attest",
        "tested on at least one real project": "attest",
    },
    "requirements": {
        "valid extension.yml manifest included": "auto",
        "readme.md with installation and usage instructions": "auto",
        "license file included": "auto",
        "github release created with version tag": "auto",
        "all command files exist and are properly formatted": "auto",
        "extension id follows naming conventions (lowercase-with-hyphens)": "auto",
    },
}


def decide_check(field_id: str, label: str, auto_ok: bool, attested: bool, drift: list) -> bool:
    table = ASSERTIONS.get(field_id, {})
    key = norm(label)
    mode = table.get(key)
    if mode is None:
        close = difflib.get_close_matches(key, list(table), n=1)
        drift.append(
            f"unrecognized checkbox option in {field_id!r}: {label!r}"
            + (f" (closest known: {close[0]!r})" if close else "")
        )
        return False
    return auto_ok if mode == "auto" else attested


# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------

def render_body(template: dict, values: dict, auto_ok: bool, attested: bool):
    drift: list[str] = []
    unknown_required: list[str] = []
    out: list[str] = []

    for block in template.get("body") or []:
        btype = block.get("type")
        if btype == "markdown":
            continue
        attrs = block.get("attributes") or {}
        fid = block.get("id")
        label = attrs.get("label") or ""
        required = str(((block.get("validations") or {}).get("required"))).lower() == "true"

        if fid not in values and btype not in ("checkboxes",):
            if required:
                unknown_required.append(f"{fid} ({label!r}, type={btype})")
                continue
            drift.append(f"unknown optional field {fid!r} ({label!r}) — rendered as no response")

        out += [f"### {label}", ""]

        if btype == "checkboxes":
            for opt in attrs.get("options") or []:
                olabel = opt.get("label", "")
                mark = "- [x] " if decide_check(fid, olabel, auto_ok, attested, drift) else "- [ ] "
                out.append(mark + olabel)
        else:
            v = values.get(fid)
            render = attrs.get("render")
            if v is None or v == "":
                out.append("_No response_")
            elif render:
                out += [f"```{render}", v.rstrip("\n"), "```"]
            else:
                out.append(v.rstrip("\n"))
        out.append("")

    body = "\n".join(out).rstrip("\n") + "\n"
    return body, drift, unknown_required


def render_title(template: dict, version: str) -> str:
    prefix = template.get("title") or "[Extension]: Add "
    return f"{prefix}SpecKit Companion v{version} (catalog update)"


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--root", default=".")
    ap.add_argument("--features-file")
    ap.add_argument("--example-file")
    ap.add_argument("--testing-details-file")
    ap.add_argument("--context-file")
    ap.add_argument("--attest", choices=["yes", "no"], default="no")
    ap.add_argument("--auto-checks-passed", choices=["yes", "no"], default="no")
    ap.add_argument("--description", help="override the catalog description (default: keep live value)")
    ap.add_argument("--category", help="override the catalog category (default: keep live value)")
    ap.add_argument("--effect", help="override the catalog effect (default: keep live value)")
    ap.add_argument("--template-file")
    ap.add_argument("--out-body")
    ap.add_argument("--out-title")
    ap.add_argument("--out-report")
    ap.add_argument("--print-labels", action="store_true",
                    help="print the live template's field labels and exit")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    template, tsha = fetch_template(args.template_file)

    if args.print_labels:
        for b in template.get("body") or []:
            if b.get("type") == "markdown":
                continue
            print(f"{b.get('id')}\t{b.get('type')}\t{(b.get('attributes') or {}).get('label')}")
        return 0

    catalog = fetch_catalog_entry()
    if catalog is None:
        print("[abort] no `companion` entry in the live catalog — this would be a "
              "FIRST LISTING, not an update. Confirm before proceeding.", file=sys.stderr)
        return 2

    manifest = load_manifest(root)
    version = args.version

    if manifest["extension"]["version"] != version:
        print(f"[abort] extension.yml is {manifest['extension']['version']!r}, "
              f"asked to submit {version!r}", file=sys.stderr)
        return 2

    def read(p, default=""):
        return Path(p).read_text() if p else default

    prose = {
        "features": read(args.features_file),
        "example": read(args.example_file),
        "testing": read(args.testing_details_file),
        "context": read(args.context_file),
    }

    classify = {"category": args.category, "effect": args.effect,
                "description": args.description}
    values = derive_values(manifest, catalog, version, prose, classify)
    body, drift, unknown_required = render_body(
        template, values,
        auto_ok=args.auto_checks_passed == "yes",
        attested=args.attest == "yes",
    )
    title = render_title(template, version)

    if unknown_required:
        print("[abort] the live template has required fields this script cannot fill:",
              file=sys.stderr)
        for u in unknown_required:
            print(f"  - {u}", file=sys.stderr)
        print("Add a filler to derive_values() before submitting.", file=sys.stderr)
        return 3

    report = {
        "template_sha": tsha,
        "catalog_now": {k: catalog.get(k) for k in
                        ("version", "download_url", "tags", "category", "effect",
                         "provides", "description")},
        "proposed": json.loads(values["catalog-entry"])[EXT_ID],
        "drift": drift,
        "attested": args.attest == "yes",
        "auto_checks_passed": args.auto_checks_passed == "yes",
    }

    if args.out_body:
        Path(args.out_body).write_text(body)
    if args.out_title:
        Path(args.out_title).write_text(title)
    if args.out_report:
        Path(args.out_report).write_text(json.dumps(report, indent=2, ensure_ascii=False))
    if not args.out_body:
        print(title)
        print()
        print(body)

    if drift:
        print("\n[template drift]", file=sys.stderr)
        for d in drift:
            print(f"  - {d}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
