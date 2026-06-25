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


class ColocatedErrorTests(unittest.TestCase):
    def test_colocated_without_spec_path_errors(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: broken\n      match: [\"src/broken/**\"]\n      spec: \"\"\n"
        )
        root = make_repo(yaml, files=["src/broken/x.ts"])
        rc = rsp.main(["--root", str(root), "--changed", "src/broken/x.ts"])
        self.assertEqual(rc, 2)


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


if __name__ == "__main__":
    unittest.main()
