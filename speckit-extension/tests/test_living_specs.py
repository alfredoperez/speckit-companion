#!/usr/bin/env python3
"""Tests for the Living Specs capability resolver + config reader (#361).

Stdlib `unittest` only (runs under pytest too). Covers the LS·1 contract:
the typed livingSpecs reader, match/exclude membership, most-specific-first
ordering, --all union/de-dup, orphan detection with tier exemption, the
colocated-no-path error, and the opt-in guarantee (enabled:false -> inert).
"""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
import companion_config as cc  # noqa: E402

# resolve-spec-paths.py has a hyphen, so import it by file path.
_spec = importlib.util.spec_from_file_location(
    "resolve_spec_paths", SCRIPTS / "resolve-spec-paths.py"
)
rsp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rsp)

# register-capability.py (LS·5 adoption) — hyphenated, imported by file path.
_reg_spec = importlib.util.spec_from_file_location(
    "register_capability", SCRIPTS / "register-capability.py"
)
regcap = importlib.util.module_from_spec(_reg_spec)
_reg_spec.loader.exec_module(regcap)

# drift.py (LS·6) — imported by file path (no hyphen, but kept consistent).
_drift_spec = importlib.util.spec_from_file_location("drift", SCRIPTS / "drift.py")
drift = importlib.util.module_from_spec(_drift_spec)
_drift_spec.loader.exec_module(drift)

# check-coverage.py (LS·8 coverage tier) — hyphenated, imported by file path.
_cov_spec = importlib.util.spec_from_file_location(
    "check_coverage", SCRIPTS / "check-coverage.py"
)
coverage = importlib.util.module_from_spec(_cov_spec)
_cov_spec.loader.exec_module(coverage)


def make_repo(yaml_text: str, files=(), spec_files=()) -> Path:
    """Bake a throwaway repo with a companion.yml and optional planted files."""
    root = Path(tempfile.mkdtemp())
    (root / ".specify").mkdir(parents=True)
    (root / ".specify" / "companion.yml").write_text(yaml_text, encoding="utf-8")
    for f in files:
        p = root / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("// code\n", encoding="utf-8")
    for f in spec_files:
        p = root / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("# spec\n", encoding="utf-8")
    return root


CHECKOUT_YAML = """\
livingSpecs:
  enabled: true
  capabilities:
    - name: checkout
      match: ["src/checkout/**"]
      exclude: ["src/checkout/**/*.test.ts"]
    - name: checkout-cart
      match: ["src/checkout/cart/**"]
"""


class ConfigReaderTests(unittest.TestCase):
    def test_enabled_defaults_false_when_absent(self) -> None:
        cfg, _ = cc.load_config("/nonexistent/companion.yml")
        living = cc.load_living_specs(cfg)
        self.assertFalse(living["enabled"])
        self.assertEqual(living["capabilities"], [])

    def test_centralized_spec_defaults_to_capabilities_path(self) -> None:
        living = cc.load_living_specs(cc.load_yaml(CHECKOUT_YAML))
        cap = next(c for c in living["capabilities"] if c["name"] == "checkout")
        self.assertEqual(cap["spec"], "capabilities/checkout/spec.md")

    def test_explicit_spec_is_kept_as_colocated_path(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: billing\n      match: [\"src/billing/**\"]\n"
            "      spec: src/billing/billing.spec.md\n"
        )
        living = cc.load_living_specs(cc.load_yaml(yaml))
        self.assertEqual(living["capabilities"][0]["spec"], "src/billing/billing.spec.md")

    def test_scalar_match_is_coerced_to_list(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: auth\n      match: src/auth/login.ts\n"
        )
        living = cc.load_living_specs(cc.load_yaml(yaml))
        self.assertEqual(living["capabilities"][0]["match"], ["src/auth/login.ts"])

    def test_exempt_defaults_when_absent(self) -> None:
        living = cc.load_living_specs(cc.load_yaml(CHECKOUT_YAML))
        self.assertEqual(living["exempt"], cc.DEFAULT_EXEMPT_GLOBS)

    def test_exempt_override_is_read(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  exempt: [\"**/*.gen.ts\"]\n"
            "  capabilities:\n    - name: auth\n      match: [\"src/auth/**\"]\n"
        )
        living = cc.load_living_specs(cc.load_yaml(yaml))
        self.assertEqual(living["exempt"], ["**/*.gen.ts"])


class MembershipTests(unittest.TestCase):
    def test_match_globs_define_membership(self) -> None:
        living = cc.load_living_specs(cc.load_yaml(CHECKOUT_YAML))
        cap = living["capabilities"][0]
        self.assertTrue(rsp.matches(cap, "src/checkout/cart/x.ts"))
        self.assertFalse(rsp.matches(cap, "src/auth/login.ts"))

    def test_exclude_removes_a_matched_file(self) -> None:
        living = cc.load_living_specs(cc.load_yaml(CHECKOUT_YAML))
        cap = next(c for c in living["capabilities"] if c["name"] == "checkout")
        self.assertTrue(rsp.matches(cap, "src/checkout/cart.ts"))
        self.assertFalse(rsp.matches(cap, "src/checkout/cart.test.ts"))

    def test_single_star_does_not_cross_directories(self) -> None:
        cap = {"name": "top", "match": ["src/*.ts"]}
        self.assertTrue(rsp.matches(cap, "src/index.ts"))
        self.assertFalse(rsp.matches(cap, "src/checkout/nested.ts"))

    def test_trailing_double_star_matches_bare_directory(self) -> None:
        self.assertTrue(rsp._glob_matches("src/checkout/**", "src/checkout"))
        self.assertTrue(rsp._glob_matches("src/checkout/**", "src/checkout/cart/x.ts"))

    def test_backslash_changed_path_is_normalized(self) -> None:
        cap = {"name": "checkout", "match": ["src/checkout/**"]}
        self.assertTrue(rsp.matches(cap, "src\\checkout\\cart\\x.ts"))


class ChangedOrderingTests(unittest.TestCase):
    def test_most_specific_first(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        living = rsp.load_living(str(root))
        matched = rsp.match_changed(["src/checkout/cart/x.ts"], living, str(root))
        self.assertEqual([m["name"] for m in matched], ["checkout-cart", "checkout"])

    def test_file_in_only_outer_capability(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        living = rsp.load_living(str(root))
        matched = rsp.match_changed(["src/checkout/index.ts"], living, str(root))
        self.assertEqual([m["name"] for m in matched], ["checkout"])

    def test_unmatched_file_returns_empty(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.match_changed(["README.md"], living, str(root)), [])


class AllAndOrphanTests(unittest.TestCase):
    def test_all_unions_config_and_on_disk_and_flags_orphan(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["notes/random.spec.md"])
        living = rsp.load_living(str(root))
        allres = rsp.discover_all(living, str(root))
        names = {e["name"] for e in allres}
        self.assertIn("checkout", names)
        self.assertIn("checkout-cart", names)
        orphans = rsp.find_orphans(living, str(root))
        self.assertIn("notes/random.spec.md", orphans)

    def test_dedup_by_resolved_spec_path(self) -> None:
        # An on-disk file that IS a configured capability's spec path is not re-listed.
        root = make_repo(CHECKOUT_YAML, spec_files=["capabilities/checkout/spec.md"])
        living = rsp.load_living(str(root))
        allres = rsp.discover_all(living, str(root))
        checkout_entries = [e for e in allres if e["spec"] == "capabilities/checkout/spec.md"]
        self.assertEqual(len(checkout_entries), 1)
        self.assertNotIn("capabilities/checkout/spec.md", rsp.find_orphans(living, str(root)))

    def test_reserved_tier_files_are_never_orphans(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/checkout/spec.arch.md",
                        "capabilities/checkout/spec.coverage.md"],
        )
        living = rsp.load_living(str(root))
        orphans = rsp.find_orphans(living, str(root))
        self.assertEqual(orphans, [])

    def test_feature_specs_dir_is_excluded_from_orphans(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["specs/001-foo/notes.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_sibling_spec_in_owned_capability_dir_is_not_orphan(self) -> None:
        # A differently-named *.spec.md under a configured capability's spec
        # directory belongs to that capability — not a stray orphan.
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/checkout/legacy.spec.md"],
        )
        living = rsp.load_living(str(root))
        orphans = rsp.find_orphans(living, str(root))
        self.assertNotIn("capabilities/checkout/legacy.spec.md", orphans)
        self.assertEqual(orphans, [])
        # discover_all must not synthesize a phantom capability for the sibling.
        allres = rsp.discover_all(living, str(root))
        self.assertNotIn("capabilities/checkout/legacy.spec.md",
                         {e["spec"] for e in allres})

    def test_unrelated_named_spec_outside_owned_dir_stays_orphan(self) -> None:
        # A spec that is neither claimed nor under any capability dir is an orphan.
        root = make_repo(CHECKOUT_YAML, spec_files=["docs/wandering.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)),
                         ["docs/wandering.spec.md"])


class ColocatedErrorTests(unittest.TestCase):
    def test_colocated_without_spec_path_errors(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: broken\n      match: [\"src/broken/**\"]\n      spec: \"\"\n"
        )
        root = make_repo(yaml, files=["src/broken/x.ts"])
        rc = rsp.main(["--root", str(root), "--changed", "src/broken/x.ts"])
        self.assertEqual(rc, 2)

    def test_colocated_without_spec_path_errors_in_orphans_mode(self) -> None:
        # --orphans must surface the same config error as --changed/--all (it
        # used to skip empty-spec capabilities and exit 0).
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: broken\n      match: [\"src/broken/**\"]\n      spec: \"\"\n"
        )
        root = make_repo(yaml, files=["src/broken/x.ts"])
        self.assertEqual(rsp.main(["--root", str(root), "--orphans"]), 2)


class OptInTests(unittest.TestCase):
    DISABLED = CHECKOUT_YAML.replace("enabled: true", "enabled: false")

    def test_disabled_changed_is_empty(self) -> None:
        root = make_repo(self.DISABLED)
        living = rsp.load_living(str(root))
        self.assertFalse(living["enabled"])
        # The opt-in gate lives in main(): a disabled config emits an empty match
        # list without ever consulting the capabilities.
        rc = rsp.main(["--root", str(root), "--changed", "src/checkout/cart/x.ts", "--json"])
        self.assertEqual(rc, 0)

    def test_disabled_main_returns_empty_exit_zero(self) -> None:
        root = make_repo(self.DISABLED)
        rc = rsp.main(["--root", str(root), "--changed", "src/checkout/cart/x.ts"])
        self.assertEqual(rc, 0)

    def test_no_config_is_inert(self) -> None:
        root = Path(tempfile.mkdtemp())
        rc = rsp.main(["--root", str(root), "--all"])
        self.assertEqual(rc, 0)


class OutputFormatTests(unittest.TestCase):
    """--json emits the JSON object; the default is a concise human list."""

    def _run(self, argv) -> tuple[int, str]:
        import contextlib
        import io
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = rsp.main(argv)
        return rc, buf.getvalue()

    def test_changed_default_is_human_name_list(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        rc, out = self._run(["--root", str(root), "--changed", "src/checkout/cart/x.ts"])
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "[checkout-cart, checkout]")

    def test_changed_json_emits_object(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        rc, out = self._run(["--root", str(root), "--changed", "src/checkout/cart/x.ts", "--json"])
        self.assertEqual(rc, 0)
        import json
        obj = json.loads(out)
        self.assertEqual([m["name"] for m in obj["matched"]], ["checkout-cart", "checkout"])

    def test_orphans_default_is_human_path_list(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["notes/random.spec.md"])
        rc, out = self._run(["--root", str(root), "--orphans"])
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "[notes/random.spec.md]")

    def test_all_default_has_capabilities_and_orphans_lines(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["notes/random.spec.md"])
        rc, out = self._run(["--root", str(root), "--all"])
        self.assertEqual(rc, 0)
        lines = out.strip().splitlines()
        self.assertTrue(lines[0].startswith("capabilities: ["))
        self.assertEqual(lines[1], "orphans: [notes/random.spec.md]")

    def test_human_render_does_not_emit_json_braces(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        _, out = self._run(["--root", str(root), "--all"])
        self.assertNotIn("{", out)


# LS·2 — the recording write path: write-context.py records the loaded capability
# names onto livingSpecs.loaded so plan can reuse them. Import the hyphenated
# script by file path the same way the resolver is imported above.
import json as _json  # noqa: E402

_wc_spec = importlib.util.spec_from_file_location(
    "write_context", SCRIPTS / "write-context.py"
)
wc = importlib.util.module_from_spec(_wc_spec)
_wc_spec.loader.exec_module(wc)


def make_ctx_dir(initial: dict | None = None) -> Path:
    """A throwaway feature dir with a minimal valid .spec-context.json."""
    root = Path(tempfile.mkdtemp())
    base = {
        "workflow": "speckit",
        "specName": "demo",
        "branch": "b",
        "currentStep": "specify",
        "status": "specified",
        "history": [],
    }
    if initial:
        base.update(initial)
    (root / ".spec-context.json").write_text(_json.dumps(base), encoding="utf-8")
    return root


class RecordLoadedLivingSpecsTests(unittest.TestCase):
    def _read(self, d: Path) -> dict:
        return _json.loads((d / ".spec-context.json").read_text(encoding="utf-8"))

    def test_records_names_in_order(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_loaded(d, ["checkout-cart", "checkout"])
        self.assertEqual(self._read(d)["livingSpecs"]["loaded"], ["checkout-cart", "checkout"])

    def test_dedups_across_calls_preserving_first_seen_order(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_loaded(d, ["checkout-cart", "checkout"])
        wc.set_living_specs_loaded(d, ["checkout", "todos"])
        self.assertEqual(
            self._read(d)["livingSpecs"]["loaded"],
            ["checkout-cart", "checkout", "todos"],
        )

    def test_normalizes_pre_existing_duplicates(self) -> None:
        # A record that already carries duplicates (older version / manual edit)
        # is normalized on the next write, not just guarded against new dupes.
        d = make_ctx_dir({"livingSpecs": {"loaded": ["checkout", "checkout", "todos"]}})
        wc.set_living_specs_loaded(d, ["checkout"])
        self.assertEqual(self._read(d)["livingSpecs"]["loaded"], ["checkout", "todos"])

    def test_merges_without_dropping_other_fields(self) -> None:
        d = make_ctx_dir({"size": "normal", "history": [{"step": "specify", "kind": "start"}]})
        wc.set_living_specs_loaded(d, ["checkout"])
        ctx = self._read(d)
        self.assertEqual(ctx["size"], "normal")
        self.assertEqual(ctx["status"], "specified")
        self.assertEqual(len(ctx["history"]), 1)
        self.assertEqual(ctx["livingSpecs"]["loaded"], ["checkout"])

    def test_no_names_is_a_noop_no_field_written(self) -> None:
        d = make_ctx_dir()
        result = wc.set_living_specs_loaded(d, [])
        self.assertIsNone(result)
        self.assertNotIn("livingSpecs", self._read(d))

    def test_blank_names_are_filtered(self) -> None:
        d = make_ctx_dir()
        result = wc.set_living_specs_loaded(d, ["  ", ""])
        self.assertIsNone(result)
        self.assertNotIn("livingSpecs", self._read(d))

    def test_living_specs_is_not_a_protected_lifecycle_key(self) -> None:
        # The field setter refuses lifecycle keys; livingSpecs must NOT be one,
        # so the additive metadata can be written while status/history stay locked.
        self.assertNotIn("livingSpecs", wc.PROTECTED_SET_KEYS)
        for k in ("history", "status", "currentStep", "transitions"):
            self.assertIn(k, wc.PROTECTED_SET_KEYS)


# LS·3 — the write path (archive-as-merge): write-context.py --fold-living-spec
# parses the feature spec's requirement deltas and folds them into the resolved
# capability's living spec on mark-complete. Covers ADDED/MODIFIED/REMOVED/RENAMED,
# write-most-specific, the <!-- capability --> marker, no-delta no-op, idempotency,
# and opt-out. Exercises the REAL functions, never re-deriving the logic inline.

import os as _os  # noqa: E402
import subprocess as _sp  # noqa: E402


def _git_repo(yaml_text: str, caps: dict, code_files=()) -> Path:
    """Bake a real git repo with a companion.yml, capability specs, and code, with
    a feature branch carrying a change so the fold's git merge-base diff yields files.
    `caps` maps a capabilities/<name>/spec.md relative path to its body."""
    root = Path(tempfile.mkdtemp())
    (root / ".specify").mkdir(parents=True)
    (root / ".specify" / "companion.yml").write_text(yaml_text, encoding="utf-8")
    for rel, body in caps.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
    for f in code_files:
        p = root / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("// code\n", encoding="utf-8")
    env = {**_os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
    _sp.run(["git", "init", "-q"], cwd=root, check=True, env=env)
    _sp.run(["git", "add", "-A"], cwd=root, check=True, env=env)
    _sp.run(["git", "commit", "-qm", "base"], cwd=root, check=True, env=env)
    _sp.run(["git", "checkout", "-q", "-b", "feat"], cwd=root, check=True, env=env)
    for f in (code_files or ["src/x.ts"]):
        (root / f).write_text("// changed\n", encoding="utf-8")
    _sp.run(["git", "add", "-A"], cwd=root, check=True, env=env)
    _sp.run(["git", "commit", "-qm", "change"], cwd=root, check=True, env=env)
    return root


def _write_feature(root: Path, slug: str, spec_body: str) -> Path:
    fdir = root / "specs" / slug
    fdir.mkdir(parents=True, exist_ok=True)
    (fdir / "spec.md").write_text(spec_body, encoding="utf-8")
    (fdir / ".spec-context.json").write_text(_json.dumps({
        "workflow": "speckit", "specName": slug, "branch": "feat",
        "currentStep": "implement", "status": "implemented", "history": [],
    }), encoding="utf-8")
    return fdir


TODOS_LIVING = (
    "# Todos capability\n\n"
    "### Users can add a todo\n\n"
    "#### Scenario: add\n- WHEN a user submits text\n- THEN a todo appears\n"
)

ENABLED_TODOS_YAML = (
    "livingSpecs:\n  enabled: true\n  capabilities:\n"
    "    - name: todos\n      match: [\"src/todos/**\"]\n"
)


class DeltaParserTests(unittest.TestCase):
    def test_parses_added_modified_removed_renamed(self) -> None:
        spec = (
            "# Feat\n\n"
            "## ADDED Requirements\n\n### New thing\n\n#### Scenario: s\n- a\n\n"
            "## MODIFIED Requirements\n\n### Old thing\n\n#### Scenario: s2\n- b\n\n"
            "## REMOVED Requirements\n\n### Dead thing\n\n"
            "## RENAMED Requirements\n\n### From name -> To name\n\n"
            "## Other section\n\nprose\n"
        )
        d = wc.parse_spec_deltas(spec)
        self.assertEqual([h for h, _ in d["added"]], ["New thing"])
        self.assertEqual([h for h, _ in d["modified"]], ["Old thing"])
        self.assertEqual([h for h, _ in d["removed"]], ["Dead thing"])
        self.assertEqual(d["renamed"], [("From name", "To name")])

    def test_no_delta_block_is_empty(self) -> None:
        d = wc.parse_spec_deltas("# Feat\n\nJust prose, no blocks.\n")
        self.assertFalse(wc._has_deltas(d))

    def test_capability_marker_is_captured(self) -> None:
        spec = (
            "## ADDED Requirements\n<!-- capability: billing -->\n\n"
            "### Pay\n\n#### Scenario: s\n- a\n"
        )
        d = wc.parse_spec_deltas(spec)
        self.assertEqual(d["markers"].get("added"), "billing")


class ApplyDeltasTests(unittest.TestCase):
    def test_added_appends_idempotently(self) -> None:
        d = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        once = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("### Due dates", once)
        twice = wc.apply_deltas(once, d)
        self.assertEqual(once, twice)  # idempotent

    def test_modified_replaces_body(self) -> None:
        d = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n### Users can add a todo\n\n"
            "#### Scenario: add\n- WHEN submitted\n- THEN it persists\n")
        out = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("THEN it persists", out)
        self.assertNotIn("THEN a todo appears", out)

    def test_removed_deletes_requirement(self) -> None:
        d = wc.parse_spec_deltas(
            "## REMOVED Requirements\n\n### Users can add a todo\n")
        out = wc.apply_deltas(TODOS_LIVING, d)
        self.assertNotIn("### Users can add a todo", out)

    def test_renamed_renames_heading_keeps_body(self) -> None:
        d = wc.parse_spec_deltas(
            "## RENAMED Requirements\n\n### Users can add a todo -> Users can create a todo\n")
        out = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("### Users can create a todo", out)
        self.assertNotIn("### Users can add a todo", out)
        self.assertIn("THEN a todo appears", out)  # body preserved


class FoldLivingSpecTests(unittest.TestCase):
    def _living(self, root: Path, rel="capabilities/todos/spec.md") -> str:
        return (root / rel).read_text(encoding="utf-8")

    def _ctx(self, fdir: Path) -> dict:
        return _json.loads((fdir / ".spec-context.json").read_text(encoding="utf-8"))

    def test_added_folds_and_records_synced(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        result = wc.fold_living_spec(fdir, "ai")
        self.assertIsNotNone(result)
        self.assertIn("### Due dates", self._living(root))
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])

    def test_no_delta_block_is_byte_identical_noop(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nNo deltas here.\n")
        before = self._living(root)
        self.assertIsNone(wc.fold_living_spec(fdir, "ai"))
        self.assertEqual(self._living(root), before)  # byte-identical
        self.assertNotIn("livingSpecs", self._ctx(fdir))

    def test_idempotent_refold(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        wc.fold_living_spec(fdir, "ai")
        after_first = self._living(root)
        wc.fold_living_spec(fdir, "ai")
        self.assertEqual(self._living(root), after_first)  # second fold = no change

    def test_opt_out_disabled_leaves_living_untouched(self) -> None:
        disabled = ENABLED_TODOS_YAML.replace("enabled: true", "enabled: false")
        root = _git_repo(disabled, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        before = self._living(root)
        self.assertIsNone(wc.fold_living_spec(fdir, "ai"))
        self.assertEqual(self._living(root), before)
        self.assertNotIn("livingSpecs", self._ctx(fdir))

    def test_writes_most_specific_capability_only(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: todos\n      match: [\"src/todos/**\"]\n"
            "    - name: todos-items\n      match: [\"src/todos/items/**\"]\n"
        )
        caps = {
            "capabilities/todos/spec.md": "# Todos\n",
            "capabilities/todos-items/spec.md": "# Todos items\n",
        }
        root = _git_repo(yaml, caps, code_files=["src/todos/items/item.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Item due date\n\n#### Scenario: s\n- a\n")
        wc.fold_living_spec(fdir, "ai")
        self.assertIn("### Item due date", self._living(root, "capabilities/todos-items/spec.md"))
        # The parent (less-specific) capability is NOT written.
        self.assertNotIn("### Item due date", self._living(root, "capabilities/todos/spec.md"))
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos-items"])

    def test_capability_marker_redirects_target(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: todos\n      match: [\"src/todos/**\"]\n"
            "    - name: billing\n      match: [\"src/billing/**\"]\n"
        )
        caps = {
            "capabilities/todos/spec.md": "# Todos\n",
            "capabilities/billing/spec.md": "# Billing\n",
        }
        # The code change touches todos, but the marker routes the block to billing too.
        root = _git_repo(yaml, caps, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n<!-- capability: billing -->\n\n"
            "### Invoice export\n\n#### Scenario: s\n- a\n")
        wc.fold_living_spec(fdir, "ai")
        synced = set(self._ctx(fdir)["livingSpecs"]["synced"])
        self.assertIn("billing", synced)
        self.assertIn("### Invoice export", self._living(root, "capabilities/billing/spec.md"))

    def test_synced_is_not_a_protected_lifecycle_key(self) -> None:
        self.assertNotIn("livingSpecs", wc.PROTECTED_SET_KEYS)

    def test_missing_living_spec_is_created_with_header(self) -> None:
        # A capability whose spec.md doesn't exist yet is born well-formed from
        # its first ADDED fold: a title header + a ## Requirements section, NOT a
        # headerless fragment.
        root = _git_repo(ENABLED_TODOS_YAML, {}, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        result = wc.fold_living_spec(fdir, "ai")
        self.assertIsNotNone(result)
        created = self._living(root)
        self.assertIn("# Todos — Living Spec", created)
        self.assertIn("## Requirements", created)
        self.assertIn("### Due dates", created)
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])

    def test_subsequent_fold_appends_without_re_adding_header(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {}, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        wc.fold_living_spec(fdir, "ai")
        # A second feature adds another requirement to the now-existing spec.
        fdir2 = _write_feature(root, "002-feat",
            "# Feat2\n\n## ADDED Requirements\n\n### Reminders\n\n#### Scenario: s\n- b\n")
        wc.fold_living_spec(fdir2, "ai")
        body = self._living(root)
        self.assertEqual(body.count("# Todos — Living Spec"), 1)
        self.assertEqual(body.count("## Requirements"), 1)
        self.assertIn("### Due dates", body)
        self.assertIn("### Reminders", body)


class FoldBranchFallbackTests(unittest.TestCase):
    """#1: the branch fallback in the living-specs recorders derives from the
    FEATURE-DIR's repo (via _repo_root_for), not the process cwd, so a write into
    another/sandbox repo records that repo's branch."""

    def _ctx(self, fdir: Path) -> dict:
        return _json.loads((fdir / ".spec-context.json").read_text(encoding="utf-8"))

    def test_synced_branch_fallback_uses_feature_dir_repo(self) -> None:
        # A sandbox git repo on a distinctive branch, with a feature dir whose
        # .spec-context.json carries NO branch — the recorder must fill it from the
        # sandbox's branch, not whatever branch the test process's cwd is on.
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        # _git_repo leaves the sandbox on the "feat" branch.
        fdir = root / "specs" / "001-feat"
        fdir.mkdir(parents=True, exist_ok=True)
        (fdir / ".spec-context.json").write_text(_json.dumps({
            "workflow": "speckit", "specName": "001-feat",
            "currentStep": "implement", "status": "implemented", "history": [],
        }), encoding="utf-8")
        wc.set_living_specs_synced(fdir, ["todos"])
        self.assertEqual(self._ctx(fdir)["branch"], "feat")

    def test_loaded_branch_fallback_uses_feature_dir_repo(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = root / "specs" / "001-feat"
        fdir.mkdir(parents=True, exist_ok=True)
        (fdir / ".spec-context.json").write_text(_json.dumps({
            "workflow": "speckit", "specName": "001-feat",
            "currentStep": "specify", "status": "specified", "history": [],
        }), encoding="utf-8")
        wc.set_living_specs_loaded(fdir, ["todos"])
        self.assertEqual(self._ctx(fdir)["branch"], "feat")


class RecordSyncedTests(unittest.TestCase):
    def _read(self, d: Path) -> dict:
        return _json.loads((d / ".spec-context.json").read_text(encoding="utf-8"))

    def test_records_and_dedups(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_synced(d, ["todos"])
        wc.set_living_specs_synced(d, ["todos", "billing"])
        self.assertEqual(self._read(d)["livingSpecs"]["synced"], ["todos", "billing"])

    def test_no_names_is_noop(self) -> None:
        d = make_ctx_dir()
        self.assertIsNone(wc.set_living_specs_synced(d, []))
        self.assertNotIn("livingSpecs", self._read(d))

    def test_synced_does_not_clobber_loaded(self) -> None:
        d = make_ctx_dir({"livingSpecs": {"loaded": ["todos"]}})
        wc.set_living_specs_synced(d, ["todos"])
        ctx = self._read(d)
        self.assertEqual(ctx["livingSpecs"]["loaded"], ["todos"])
        self.assertEqual(ctx["livingSpecs"]["synced"], ["todos"])


class RegisterCapabilityTests(unittest.TestCase):
    """LS·5 registry-append helper: idempotent, incremental, non-destructive."""

    def _config(self, root: Path) -> str:
        return (root / ".specify" / "companion.yml").read_text(encoding="utf-8")

    def test_absent_config_creates_minimal_block(self) -> None:
        root = Path(tempfile.mkdtemp())  # no .specify/companion.yml
        result = regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertEqual(result["action"], "created")
        living = rsp.load_living(str(root))
        self.assertTrue(living["enabled"])
        self.assertEqual([c["name"] for c in living["capabilities"]], ["billing"])

    def test_append_preserves_existing_capabilities(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        names = [c["name"] for c in rsp.load_living(str(root))["capabilities"]]
        self.assertEqual(names, ["checkout", "checkout-cart", "billing"])

    def test_append_is_idempotent_by_name(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        before = self._config(root)
        result = regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertEqual(result["action"], "already-registered")
        self.assertEqual(self._config(root), before)  # byte-identical

    def test_already_registered_reports_on_disk_values_not_requested(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        regcap.register(str(root), "billing", ["src/billing/**"], [], "custom/billing.spec.md")
        # Re-register with DIFFERENT requested values; result must reflect what's
        # actually on disk, not the new request.
        result = regcap.register(str(root), "billing", ["src/other/**"], [], None)
        self.assertEqual(result["action"], "already-registered")
        self.assertEqual(result["spec"], "custom/billing.spec.md")
        self.assertEqual(result["match"], ["src/billing/**"])

    def test_rejects_unsupported_characters(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        before = self._config(root)
        with self.assertRaises(ValueError):
            regcap.register(str(root), "billing", ['src/"weird"/**'], [], None)
        self.assertEqual(self._config(root), before)  # file untouched

    def test_inter_block_comment_and_sibling_block_survive_splice(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: checkout\n      match: [\"src/checkout/**\"]\n"
            "\n# downstream hooks (keep me)\nhooks:\n  after_specify: noop\n"
        )
        root = make_repo(yaml)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        after = self._config(root)
        self.assertIn("# downstream hooks (keep me)", after)
        self.assertIn("hooks:", after)
        self.assertIn("after_specify: noop", after)
        self.assertIn("billing", after)

    def test_appended_capability_is_resolved(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        living = rsp.load_living(str(root))
        matched = rsp.match_changed(["src/billing/charge.ts"], living, str(root))
        self.assertEqual([m["name"] for m in matched], ["billing"])

    def test_malformed_config_is_refused_not_overwritten(self) -> None:
        root = Path(tempfile.mkdtemp())
        (root / ".specify").mkdir(parents=True)
        bad = "- just\n- a list\n"  # top-level seq — not a mapping
        (root / ".specify" / "companion.yml").write_text(bad, encoding="utf-8")
        with self.assertRaises(ValueError):
            regcap.register(str(root), "x", ["src/x/**"], [], None)
        self.assertEqual(self._config(root), bad)  # untouched

    def test_exclude_and_custom_spec_round_trip(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        regcap.register(str(root), "todos", ["src/todos/**"],
                        ["src/todos/**/*.test.ts"], "docs/todos.spec.md")
        cap = next(c for c in rsp.load_living(str(root))["capabilities"] if c["name"] == "todos")
        self.assertEqual(cap["exclude"], ["src/todos/**/*.test.ts"])
        self.assertEqual(cap["spec"], "docs/todos.spec.md")

    def test_cli_requires_match(self) -> None:
        self.assertEqual(regcap.main(["--name", "x", "--root", tempfile.mkdtemp()]), 2)

    def test_sibling_config_blocks_are_preserved(self) -> None:
        # A companion.yml carrying other top-level blocks (recipes, hooks) keeps
        # every one of them when a capability is appended — the writer splices the
        # livingSpecs block in place instead of re-emitting the whole file.
        yaml = (
            "# project recipes\n"
            "commands:\n  speckit.plan:\n    nodes: [\"a\", \"b\"]\n"
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: checkout\n      match: [\"src/checkout/**\"]\n"
            "hooks:\n  after_specify:\n    - run: foo\n"
        )
        root = make_repo(yaml)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        out = self._config(root)
        self.assertIn("commands:", out)
        self.assertIn("nodes:", out)
        self.assertIn("hooks:", out)
        self.assertIn("after_specify:", out)
        # And the appended capability still resolves through the real reader.
        names = [c["name"] for c in rsp.load_living(str(root))["capabilities"]]
        self.assertEqual(names, ["checkout", "billing"])
        cfg, warnings = cc.load_config(str(root / ".specify" / "companion.yml"))
        self.assertEqual(warnings, [])

    def test_appends_livingspecs_block_to_config_without_one(self) -> None:
        # A companion.yml that has recipes but no livingSpecs block: the block is
        # appended (other config kept) and born ENABLED so the capability resolves.
        yaml = "commands:\n  speckit.plan:\n    nodes: [\"a\"]\n"
        root = make_repo(yaml)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertIn("commands:", self._config(root))
        living = rsp.load_living(str(root))
        self.assertTrue(living["enabled"])
        self.assertEqual([c["name"] for c in living["capabilities"]], ["billing"])
        matched = rsp.match_changed(["src/billing/charge.ts"], living, str(root))
        self.assertEqual([m["name"] for m in matched], ["billing"])

    def test_existing_disabled_block_stays_disabled_on_append(self) -> None:
        # An opt-out (enabled:false) livingSpecs block is not silently re-enabled
        # by an append — the user's flag is preserved.
        yaml = CHECKOUT_YAML.replace("enabled: true", "enabled: false")
        root = make_repo(yaml)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertFalse(rsp.load_living(str(root))["enabled"])


import subprocess  # noqa: E402


def _git(root: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-C", str(root), "-c", "user.email=t@t", "-c", "user.name=t", *args],
        check=True, capture_output=True, text=True,
    )


def _commit_all(root: Path, msg: str) -> None:
    _git(root, "add", "-A")
    _git(root, "commit", "-q", "-m", msg)


def _bake_drift_repo(yaml_text: str) -> Path:
    root = Path(tempfile.mkdtemp())
    (root / ".specify").mkdir(parents=True)
    (root / ".specify" / "companion.yml").write_text(yaml_text, encoding="utf-8")
    _git(root, "init", "-q", "-b", "main", ".")
    return root


def _write(root: Path, rel: str, body: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


class DriftTests(unittest.TestCase):
    """Drift detection runs the REAL drift.py against a real git sandbox."""

    YAML = (
        "livingSpecs:\n  enabled: true\n  capabilities:\n"
        "    - name: todos\n      match: [\"src/todos/**\"]\n"
        "    - name: about\n      match: [\"src/about/**\"]\n"
    )

    def _run(self, root: Path) -> dict:
        living = drift.rsp.load_living(str(root))
        return drift.compute_drift(str(root), living)

    def test_disabled_renders_nothing(self) -> None:
        # Opt-in: a disabled feature produces NO human output (not even a banner).
        disabled = self.YAML.replace("enabled: true", "enabled: false")
        root = _bake_drift_repo(disabled)
        result = self._run(root)
        self.assertFalse(result["enabled"])
        self.assertEqual(drift.render_human(result), "")

    def test_unspeced_change_after_committed_spec(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "capabilities/about/spec.md", "# About\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _write(root, "src/about/page.ts", "// about\n")
        _commit_all(root, "baseline")
        _write(root, "src/todos/list.ts", "// todos\n// changed outside\n")
        _commit_all(root, "change todos")

        result = self._run(root)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        about = next(c for c in result["capabilities"] if c["name"] == "about")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "unspeced")],
        )
        self.assertTrue(about["inSync"])  # about unchanged since its spec

    def test_tracked_change_from_spec_context(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")
        _write(root, "src/todos/list.ts", "// changed via pipeline\n")
        _write(
            root, "specs/001-x/.spec-context.json",
            '{"files_modified": ["src/todos/list.ts"], "status": "implemented"}\n',
        )
        _commit_all(root, "pipeline change")

        result = self._run(root)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "tracked")],
        )

    def test_old_pre_spec_context_change_is_unspeced_not_tracked(self) -> None:
        # A file recorded in a .spec-context.json committed BEFORE the capability
        # spec, then changed off-pipeline AFTER the spec, must read `unspeced` —
        # the old context predates the spec commit, so it can't make it `tracked`.
        root = _bake_drift_repo(self.YAML)
        _write(
            root, "specs/000-old/.spec-context.json",
            '{"files_modified": ["src/todos/list.ts"], "status": "implemented"}\n',
        )
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "old pipeline context")
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _commit_all(root, "adopt todos")  # spec commit comes AFTER the context
        _write(root, "src/todos/list.ts", "// todos\n// changed off-pipeline\n")
        _commit_all(root, "off-pipeline edit")

        result = self._run(root)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "unspeced")],
        )

    def test_context_recorded_since_spec_commit_is_tracked(self) -> None:
        # A .spec-context.json recorded in a commit AFTER the spec commit makes
        # its files `tracked` — a recent pipeline sync not yet folded back.
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "adopt todos")
        _write(root, "src/todos/list.ts", "// changed via pipeline\n")
        _write(
            root, "specs/002-recent/.spec-context.json",
            '{"files_modified": ["src/todos/list.ts"], "status": "implemented"}\n',
        )
        _commit_all(root, "recent pipeline sync")  # context AFTER the spec commit

        result = self._run(root)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "tracked")],
        )

    def test_git_unavailable_skip_reason_differs_from_untracked_spec(self) -> None:
        # When --root is not a git repo, the skip reason names git unavailability,
        # NOT "spec.md not yet committed" (which means an uncommitted spec).
        root = Path(tempfile.mkdtemp())
        (root / ".specify").mkdir(parents=True)
        (root / ".specify" / "companion.yml").write_text(self.YAML, encoding="utf-8")
        _write(root, "capabilities/todos/spec.md", "# Todos\n")  # no git init

        result = self._run(root)
        todos_skip = next(s for s in result["skipped"] if s["name"] == "todos")
        self.assertIn("git", todos_skip["reason"].lower())
        self.assertNotEqual(todos_skip["reason"], "spec.md not yet committed")
        self.assertEqual(result["capabilities"], [])

    def test_exempt_file_is_filtered_out(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")
        _write(root, "src/todos/list.test.ts", "// test\n")  # exempt *.test.*
        _commit_all(root, "add test")

        result = self._run(root)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        self.assertTrue(todos["inSync"])
        self.assertIn("All capabilities in sync", drift.render_human(result))

    def test_uncommitted_spec_is_skipped_not_drift(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "src/todos/list.ts", "// todos\n")  # no spec committed
        _commit_all(root, "code only")

        result = self._run(root)
        skipped_names = [s["name"] for s in result["skipped"]]
        self.assertIn("todos", skipped_names)
        self.assertEqual(result["capabilities"], [])

    def test_in_sync_reports_single_all_clear(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: todos\n      match: [\"src/todos/**\"]\n"
        )
        root = _bake_drift_repo(yaml)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")

        result = self._run(root)
        self.assertEqual(drift.render_human(result), "✓ All capabilities in sync.")

    def test_disabled_is_inert_and_exits_zero(self) -> None:
        root = _bake_drift_repo(self.YAML.replace("enabled: true", "enabled: false"))
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")
        _write(root, "src/todos/list.ts", "// changed\n")
        _commit_all(root, "change")

        living = drift.rsp.load_living(str(root))
        result = drift.compute_drift(str(root), living)
        self.assertFalse(result["enabled"])
        self.assertEqual(result["capabilities"], [])
        self.assertEqual(drift.main(["--root", str(root)]), 0)

    def test_colocated_spec_tier_siblings_are_not_drift(self) -> None:
        # A colocated capability's `match` globs claim its own area, so an edit to
        # its spec.md / reserved-tier sibling (.arch.md / .coverage.md) must NOT be
        # reported as drifted CODE — the spec documents ARE the spec.
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: billing\n      match: [\"src/billing/**\"]\n"
            "      spec: src/billing/billing.spec.md\n"
        )
        root = _bake_drift_repo(yaml)
        _write(root, "src/billing/billing.spec.md", "# billing\n")
        _write(root, "src/billing/billing.arch.md", "# arch\n")
        _write(root, "src/billing/charge.ts", "// code\n")
        _commit_all(root, "baseline")
        _write(root, "src/billing/billing.arch.md", "# arch\n# v2\n")
        _write(root, "src/billing/charge.ts", "// code\n// edited\n")
        _commit_all(root, "edits")

        result = self._run(root)
        billing = next(c for c in result["capabilities"] if c["name"] == "billing")
        self.assertEqual(
            [d["file"] for d in billing["drifted"]],
            ["src/billing/charge.ts"],  # arch sibling + the spec itself excluded
        )

    def test_always_exits_zero_even_with_drift(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")
        _write(root, "src/todos/list.ts", "// drift\n")
        _commit_all(root, "drift")
        self.assertEqual(drift.main(["--root", str(root)]), 0)


class TierPathTests(unittest.TestCase):
    """LS·8 — the resolver derives the reserved-tier sibling paths."""

    def test_tier_paths_derive_from_spec(self) -> None:
        tiers = rsp.tier_paths("capabilities/billing/spec.md")
        self.assertEqual(tiers["arch"]["path"], "capabilities/billing/spec.arch.md")
        self.assertEqual(
            tiers["coverage"]["path"], "capabilities/billing/spec.coverage.md"
        )
        # no root → no existence probe
        self.assertNotIn("exists", tiers["arch"])

    def test_tier_paths_colocated_spec(self) -> None:
        tiers = rsp.tier_paths("src/billing/billing.spec.md")
        self.assertEqual(tiers["arch"]["path"], "src/billing/billing.arch.md")
        self.assertEqual(
            tiers["coverage"]["path"], "src/billing/billing.coverage.md"
        )

    def test_tier_paths_flag_existence_against_root(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/checkout/spec.arch.md"],
        )
        tiers = rsp.tier_paths("capabilities/checkout/spec.md", str(root))
        self.assertTrue(tiers["arch"]["exists"])
        self.assertFalse(tiers["coverage"]["exists"])

    def test_reserved_tiers_derive_from_tier_suffixes(self) -> None:
        # RESERVED_TIERS (orphan/drift exemption) and TIER_SUFFIXES (tier_paths)
        # must stay in lockstep — the suffix literals live in one place.
        self.assertEqual(set(rsp.RESERVED_TIERS), set(rsp.TIER_SUFFIXES.values()))
        for entry in rsp.tier_paths("capabilities/x/spec.md").values():
            self.assertTrue(any(entry["path"].endswith(t) for t in rsp.RESERVED_TIERS))

    def test_entry_carries_tiers_in_json(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/checkout/spec.arch.md"],
        )
        living = rsp.load_living(str(root))
        entry = next(e for e in rsp.discover_all(living, str(root))
                     if e["name"] == "checkout")
        self.assertIn("tiers", entry)
        self.assertTrue(entry["tiers"]["arch"]["exists"])
        self.assertEqual(
            entry["tiers"]["arch"]["path"], "capabilities/checkout/spec.arch.md"
        )


BILLING_YAML = """\
livingSpecs:
  enabled: true
  capabilities:
    - name: billing
      match: ["src/billing/**"]
"""

BILLING_SPEC = """\
# Billing
## Requirements
- **FR-001** Charge a card.
- **FR-002** Refund a charge.
- **FR-003** Email a receipt.
"""

BILLING_COVERAGE = """\
# Billing coverage
- FR-001 → src/billing/charge.test.ts
- FR-002 → tests/billing/refund_test.py
"""


def _bake_coverage_repo(yaml=BILLING_YAML, spec=BILLING_SPEC, cov=BILLING_COVERAGE):
    root = make_repo(yaml)
    _write(root, "capabilities/billing/spec.md", spec)
    if cov is not None:
        _write(root, "capabilities/billing/spec.coverage.md", cov)
    return root


class CoverageParseTests(unittest.TestCase):
    """LS·8 — requirement extraction + coverage-map parsing (pure functions)."""

    def test_requirements_from_bullets_and_headings(self) -> None:
        reqs = coverage.spec_requirements(BILLING_SPEC)
        self.assertEqual(reqs, ["FR-1", "FR-2", "FR-3"])

    def test_requirement_id_normalized_strips_padding(self) -> None:
        self.assertEqual(coverage._norm_id("FR001"), "FR-1")
        self.assertEqual(coverage._norm_id("fr-007"), "FR-7")
        self.assertEqual(coverage._norm_id("NFR4"), "NFR-4")

    def test_prose_mention_is_not_a_requirement(self) -> None:
        # An FR id inside a sentence (not a bullet/heading) must not register.
        text = "# Spec\nThis honors FR-001 from the parent.\n- **FR-002** Real.\n"
        self.assertEqual(coverage.spec_requirements(text), ["FR-2"])

    def test_coverage_map_links_ids_to_tests(self) -> None:
        cmap = coverage.coverage_map(BILLING_COVERAGE)
        self.assertEqual(cmap["FR-1"], ["src/billing/charge.test.ts"])
        self.assertEqual(cmap["FR-2"], ["tests/billing/refund_test.py"])
        self.assertNotIn("FR-3", cmap)

    def test_coverage_line_without_a_test_is_not_coverage(self) -> None:
        cmap = coverage.coverage_map("- FR-001 — still TODO\n")
        self.assertEqual(cmap.get("FR-1", []), [])

    def test_fr_token_inside_a_test_path_is_not_a_requirement_id(self) -> None:
        # `fr-2` buried in the test PATH must not register FR-2 as covered — only
        # the requirement id authored outside the test reference counts (LS·3).
        cmap = coverage.coverage_map("| FR-001 | src/feature-fr-2/charge.test.ts |\n")
        self.assertIn("FR-1", cmap)
        self.assertEqual(cmap["FR-1"], ["src/feature-fr-2/charge.test.ts"])
        self.assertNotIn("FR-2", cmap)


class CoverageReportTests(unittest.TestCase):
    """LS·8 — the read-only, never-failing coverage report."""

    def test_maps_requirement_to_its_test_and_flags_uncovered(self) -> None:
        root = _bake_coverage_repo()
        result = coverage.run(str(root), None)
        cap = result["capabilities"][0]
        by_id = {r["id"]: r for r in cap["requirements"]}
        self.assertTrue(by_id["FR-1"]["covered"])
        self.assertEqual(by_id["FR-1"]["tests"], ["src/billing/charge.test.ts"])
        self.assertFalse(by_id["FR-3"]["covered"])
        self.assertEqual((cap["covered"], cap["total"]), (2, 3))

    def test_capability_with_no_coverage_file_reports_all_uncovered(self) -> None:
        root = _bake_coverage_repo(cov=None)
        cap = coverage.run(str(root), None)["capabilities"][0]
        self.assertFalse(cap["hasCoverage"])
        self.assertEqual(cap["covered"], 0)
        self.assertTrue(all(not r["covered"] for r in cap["requirements"]))

    def test_restrict_to_one_capability(self) -> None:
        root = _bake_coverage_repo()
        only = coverage.run(str(root), "billing")["capabilities"]
        self.assertEqual([c["name"] for c in only], ["billing"])

    def test_disabled_renders_nothing(self) -> None:
        # Opt-in: a disabled feature produces NO human output (mirrors drift).
        root = _bake_coverage_repo(yaml=BILLING_YAML.replace("enabled: true", "enabled: false"))
        result = coverage.run(str(root), None)
        self.assertFalse(result["enabled"])
        self.assertEqual(coverage.render_human(result), "")

    def test_orphan_specs_are_not_in_the_coverage_report(self) -> None:
        # Only CONFIGURED capabilities are reported; a stray *.spec.md is ignored.
        root = _bake_coverage_repo()
        _write(root, "notes/random.spec.md", "# Random\n## Requirements\n### FR-9 Stray\n")
        names = [c["name"] for c in coverage.run(str(root), None)["capabilities"]]
        self.assertEqual(names, ["billing"])
        self.assertEqual(coverage.run(str(root), "nope")["capabilities"], [])

    def test_disabled_reports_nothing(self) -> None:
        root = make_repo("livingSpecs:\n  enabled: false\n")
        result = coverage.run(str(root), None)
        self.assertFalse(result["enabled"])
        self.assertEqual(result["capabilities"], [])

    def test_always_exits_zero(self) -> None:
        root = _bake_coverage_repo()
        self.assertEqual(coverage.main(["--root", str(root)]), 0)
        self.assertEqual(coverage.main(["--root", str(root), "--json"]), 0)
        # opt-out path also exits 0
        off = make_repo("livingSpecs:\n  enabled: false\n")
        self.assertEqual(coverage.main(["--root", str(off)]), 0)


if __name__ == "__main__":
    unittest.main()
