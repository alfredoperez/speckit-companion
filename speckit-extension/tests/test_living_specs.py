#!/usr/bin/env python3
"""Tests for the Living Specs capability resolver + config reader (#361).

Stdlib `unittest` only (runs under pytest too). Covers the LS·1 contract:
the typed livingSpecs reader, match/exclude membership, most-specific-first
ordering, --all union/de-dup, orphan detection with tier exemption, the
colocated-no-path error, and the opt-in guarantee (enabled:false -> inert).
"""
from __future__ import annotations

import contextlib
import itertools
import importlib.util
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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

# relocate-capability.py (#460 central <-> colocated migration) — hyphenated.
_rel_spec = importlib.util.spec_from_file_location(
    "relocate_capability", SCRIPTS / "relocate-capability.py"
)
relocate = importlib.util.module_from_spec(_rel_spec)
_rel_spec.loader.exec_module(relocate)

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

    def test_explicit_empty_exempt_survives_a_rewrite(self) -> None:
        rendered = cc.render_registry(True, [], exempt=[])
        self.assertIn("exempt: []", rendered)
        self.assertEqual(cc.load_living_specs_block(cc.load_yaml(rendered))["exempt"], [])

    def test_omitted_exempt_still_means_use_the_defaults(self) -> None:
        rendered = cc.render_registry(True, [], exempt=None)
        self.assertNotIn("exempt:", rendered)
        self.assertEqual(
            cc.load_living_specs_block(cc.load_yaml(rendered))["exempt"],
            cc.DEFAULT_EXEMPT_GLOBS,
        )

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


def plant_nested_project(root: Path, rel_dir: str, yaml_text: str, spec_files=()) -> Path:
    """Plant a self-contained project (its own companion.yml) under `root`."""
    nested = root / rel_dir
    (nested / ".specify").mkdir(parents=True, exist_ok=True)
    (nested / ".specify" / "companion.yml").write_text(yaml_text, encoding="utf-8")
    for f in spec_files:
        p = nested / f
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("# spec\n", encoding="utf-8")
    return nested


NESTED_ENABLED_YAML = """\
livingSpecs:
  enabled: true
  capabilities:
    - name: todos-store
      match: ["src/store/**"]
      spec: src/store/todos.spec.md
"""

NESTED_OPTOUT_YAML = "livingSpecs:\n  enabled: false\n"


class ProjectBoundaryTests(unittest.TestCase):
    def test_nested_project_specs_are_not_orphans(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "examples/nested", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_nested_project_specs_are_not_promoted_to_capabilities(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "examples/nested", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        specs = {e["spec"] for e in rsp.discover_all(living, str(root))}
        self.assertNotIn("examples/nested/src/store/todos.spec.md", specs)

    def test_opted_out_nested_project_contributes_nothing(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "examples/optout", NESTED_OPTOUT_YAML,
                             spec_files=["notes/stray.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])
        names = {e["name"] for e in rsp.discover_all(living, str(root))}
        self.assertNotIn("notes", names)

    def test_unreadable_nested_config_still_stops_the_scan(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "examples/broken", "livingSpecs: [: not: yaml\n",
                             spec_files=["notes/stray.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_boundary_applies_at_any_depth(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "a/b/c/deep", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_root_config_is_not_a_boundary_against_itself(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["docs/wandering.spec.md"])
        plant_nested_project(root, "examples/nested", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)),
                         ["docs/wandering.spec.md"])

    def test_nested_project_inside_an_owned_capability_dir_still_stops(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["capabilities/checkout/spec.md"])
        plant_nested_project(root, "capabilities/checkout/sample", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        specs = {e["spec"] for e in rsp.discover_all(living, str(root))}
        self.assertNotIn("capabilities/checkout/sample/src/store/todos.spec.md", specs)

    def test_unreadable_boundary_probe_still_stops_the_scan(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        nested = plant_nested_project(root, "examples/locked", NESTED_ENABLED_YAML,
                                      spec_files=["notes/stray.spec.md"])
        living = rsp.load_living(str(root))
        blocked = str(nested / ".specify" / "companion.yml")
        real_isfile = os.path.isfile

        def probe(path):
            if os.path.abspath(path) == blocked:
                raise PermissionError(13, "Permission denied", path)
            return real_isfile(path)

        with mock.patch("os.path.isfile", side_effect=probe):
            orphans = rsp.find_orphans(living, str(root))
            specs = {e["spec"] for e in rsp.discover_all(living, str(root))}
        self.assertEqual(orphans, [])
        self.assertNotIn("examples/locked/notes/stray.spec.md", specs)


class DiscoveryConsistencyTests(unittest.TestCase):
    def test_capability_specs_and_orphans_never_overlap(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["capabilities/checkout/spec.md",
                                                    "docs/wandering.spec.md"])
        plant_nested_project(root, "examples/nested", NESTED_ENABLED_YAML,
                             spec_files=["src/store/todos.spec.md"])
        living = rsp.load_living(str(root))
        configured = {c["spec"] for c in living["capabilities"]}
        orphans = set(rsp.find_orphans(living, str(root)))
        self.assertEqual(configured & orphans, set())

    def test_discovered_names_are_unique(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["one/notes/stray.spec.md",
                                                    "two/notes/stray.spec.md"])
        living = rsp.load_living(str(root))
        names = [e["name"] for e in rsp.discover_all(living, str(root))]
        self.assertEqual(len(names), len(set(names)))

    def test_a_root_level_discovered_spec_is_named_without_its_suffix(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["billing.spec.md"])
        living = rsp.load_living(str(root))
        names = {e["name"] for e in rsp.discover_all(living, str(root))}
        self.assertIn("billing", names)

    def test_all_reuses_the_orphan_scan_rather_than_rescanning(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["docs/wandering.spec.md"])
        living = rsp.load_living(str(root))
        orphans = rsp.find_orphans(living, str(root))
        specs = {e["spec"] for e in rsp.discover_all(living, str(root), orphans)}
        self.assertEqual(set(orphans) - specs, set())

    def test_a_discovered_name_never_displaces_a_configured_capability(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["checkout/stray.spec.md"])
        living = rsp.load_living(str(root))
        allres = rsp.discover_all(living, str(root))
        checkout = [e for e in allres if e["name"] == "checkout"]
        self.assertEqual(len(checkout), 1)
        self.assertEqual(checkout[0]["spec"], "capabilities/checkout/spec.md")


class CentralSpecDiscoveryTests(unittest.TestCase):
    def test_unregistered_central_spec_is_an_orphan(self) -> None:
        root = make_repo(CHECKOUT_YAML,
                         spec_files=["capabilities/webview-shared/spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)),
                         ["capabilities/webview-shared/spec.md"])

    def test_registered_central_spec_is_not_an_orphan(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["capabilities/checkout/spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_central_and_colocated_orphans_are_reported_together(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/workflows/spec.md",
                        "docs/wandering.spec.md"],
        )
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_orphans(living, str(root)),
                         ["capabilities/workflows/spec.md", "docs/wandering.spec.md"])

    def test_colocated_discovery_is_unchanged_by_the_central_shape_test(self) -> None:
        root = make_repo(CHECKOUT_YAML,
                         spec_files=["docs/wandering.spec.md", "spec.md",
                                     "capabilities/deep/nested/spec.md"])
        living = rsp.load_living(str(root))
        # Only `<capability root>/<name>/spec.md` is the centralized layout.
        self.assertEqual(rsp.find_orphans(living, str(root)), ["docs/wandering.spec.md"])

    def test_discovered_central_spec_reports_its_centralized_location(self) -> None:
        root = make_repo(CHECKOUT_YAML,
                         spec_files=["capabilities/workflows/spec.md"])
        living = rsp.load_living(str(root))
        entry = next(e for e in rsp.discover_all(living, str(root))
                     if e["spec"] == "capabilities/workflows/spec.md")
        self.assertEqual(entry["location"], "centralized")
        self.assertEqual(entry["name"], "workflows")

    def test_nested_project_capability_dir_is_still_pruned(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "examples/nested", NESTED_ENABLED_YAML,
                             spec_files=["capabilities/todos-store/spec.md",
                                         "capabilities/todos-store/todos.spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_spec_files(str(root)), [])
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_a_nested_project_sitting_at_a_capability_path_is_still_pruned(self) -> None:
        # Centralized shape, but `sample` carries its own registry — another project.
        root = make_repo(CHECKOUT_YAML)
        plant_nested_project(root, "capabilities/sample", NESTED_ENABLED_YAML,
                             spec_files=["spec.md"])
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_spec_files(str(root)), [])
        self.assertEqual(rsp.find_orphans(living, str(root)), [])

    def test_orphans_and_all_agree_on_every_central_spec(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["capabilities/checkout/spec.md",
                        "capabilities/workflows/spec.md",
                        "capabilities/extension-services/spec.md",
                        "docs/wandering.spec.md"],
        )
        living = rsp.load_living(str(root))
        orphans = rsp.find_orphans(living, str(root))
        allres = rsp.discover_all(living, str(root), orphans)
        specs = {e["spec"] for e in allres}
        on_disk = {rsp._posix(f) for f in rsp.find_spec_files(str(root))}
        configured = {c["spec"] for c in living["capabilities"]}
        self.assertEqual(on_disk, {"capabilities/checkout/spec.md",
                                   "capabilities/workflows/spec.md",
                                   "capabilities/extension-services/spec.md",
                                   "docs/wandering.spec.md"})
        self.assertEqual(on_disk - specs, set())
        self.assertEqual(set(orphans) & configured, set())

    def test_vendored_dependencies_are_never_scanned(self) -> None:
        root = make_repo(
            CHECKOUT_YAML,
            spec_files=["node_modules/pkg/vendored.spec.md",
                        "node_modules/pkg/capabilities/a/spec.md",
                        "docs/wandering.spec.md"],
        )
        living = rsp.load_living(str(root))
        self.assertEqual(rsp.find_spec_files(str(root)), ["docs/wandering.spec.md"])
        self.assertEqual(rsp.find_orphans(living, str(root)), ["docs/wandering.spec.md"])


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


# The skip note: completion accounts for a loaded capability it did NOT
# change with an explicit {name, reason}, so "correctly nothing" is a record, not
# silence. Mirrors the loaded/synced writers: additive, de-duped, no lifecycle write.
class RecordSkippedLivingSpecsTests(unittest.TestCase):
    def _read(self, d: Path) -> dict:
        return _json.loads((d / ".spec-context.json").read_text(encoding="utf-8"))

    def test_records_name_and_reason(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_skipped(d, [{"name": "todos", "reason": "render-only"}])
        self.assertEqual(
            self._read(d)["livingSpecs"]["skipped"],
            [{"name": "todos", "reason": "render-only"}],
        )

    def test_dedups_on_name_first_reason_wins(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_skipped(d, [{"name": "todos", "reason": "first"}])
        wc.set_living_specs_skipped(d, [{"name": "todos", "reason": "second"}])
        self.assertEqual(
            self._read(d)["livingSpecs"]["skipped"],
            [{"name": "todos", "reason": "first"}],
        )

    def test_coexists_with_loaded_without_dropping_it(self) -> None:
        d = make_ctx_dir()
        wc.set_living_specs_loaded(d, ["todos", "checkout"])
        wc.set_living_specs_skipped(d, [{"name": "checkout", "reason": "unrelated"}])
        block = self._read(d)["livingSpecs"]
        self.assertEqual(block["loaded"], ["todos", "checkout"])
        self.assertEqual(block["skipped"], [{"name": "checkout", "reason": "unrelated"}])

    def test_no_entries_is_a_noop(self) -> None:
        d = make_ctx_dir()
        self.assertIsNone(wc.set_living_specs_skipped(d, []))
        self.assertNotIn("livingSpecs", self._read(d))

    def test_blank_name_is_filtered(self) -> None:
        d = make_ctx_dir()
        self.assertIsNone(wc.set_living_specs_skipped(d, [{"name": "  ", "reason": "x"}]))
        self.assertNotIn("livingSpecs", self._read(d))

    def test_blank_reason_is_dropped(self) -> None:
        # A skip must justify itself; a reasonless entry is not accountability.
        d = make_ctx_dir()
        self.assertIsNone(wc.set_living_specs_skipped(d, [{"name": "todos", "reason": "  "}]))
        self.assertNotIn("livingSpecs", self._read(d))

    def test_does_not_touch_lifecycle_keys(self) -> None:
        d = make_ctx_dir({"status": "implemented", "currentStep": "implement",
                          "history": [{"step": "specify", "kind": "start"}]})
        wc.set_living_specs_skipped(d, [{"name": "todos", "reason": "r"}])
        ctx = self._read(d)
        self.assertEqual(ctx["status"], "implemented")
        self.assertEqual(ctx["currentStep"], "implement")
        self.assertEqual(len(ctx["history"]), 1)


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

ENABLED_TWO_CAPS_YAML = (
    "livingSpecs:\n  enabled: true\n  capabilities:\n"
    "    - name: todos\n      match: [\"src/todos/**\"]\n"
    "    - name: about\n      match: [\"src/about/**\"]\n"
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

    def test_two_added_blocks_for_different_caps_keep_distinct_unit_caps(self) -> None:
        # Two `## ADDED Requirements` blocks marked for different capabilities must
        # not collapse to one marker — each requirement unit records its own
        # capability so the fold can route them apart.
        spec = (
            "# Feat\n\n"
            "## ADDED Requirements\n<!-- capability: alpha -->\n\n"
            "### Alpha thing\n\n#### Scenario: a\n- x\n\n"
            "## ADDED Requirements\n<!-- capability: beta -->\n\n"
            "### Beta thing\n\n#### Scenario: b\n- y\n"
        )
        d = wc.parse_spec_deltas(spec)
        self.assertEqual([h for h, _ in d["added"]], ["Alpha thing", "Beta thing"])
        self.assertEqual(d["unit_caps"]["added"], ["alpha", "beta"])

    def test_unmarked_block_records_none_unit_cap(self) -> None:
        d = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Plain thing\n\n#### Scenario: s\n- a\n")
        self.assertEqual(d["unit_caps"]["added"], [None])

    def test_unit_caps_align_across_all_verbs(self) -> None:
        spec = (
            "## MODIFIED Requirements\n<!-- capability: alpha -->\n\n### Edited\n\n- z\n\n"
            "## REMOVED Requirements\n<!-- capability: beta -->\n\n### Gone\n\n"
            "## RENAMED Requirements\n<!-- capability: gamma -->\n\n### From -> To\n"
        )
        d = wc.parse_spec_deltas(spec)
        self.assertEqual(d["unit_caps"]["modified"], ["alpha"])
        self.assertEqual(d["unit_caps"]["removed"], ["beta"])
        self.assertEqual(d["unit_caps"]["renamed"], ["gamma"])


class ApplyDeltasTests(unittest.TestCase):
    def test_added_appends_idempotently(self) -> None:
        d = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        once, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("### Due dates", once)
        self.assertEqual(applied["added"], 1)
        twice, reapplied = wc.apply_deltas(once, d)
        self.assertEqual(once, twice)  # idempotent
        self.assertEqual(reapplied["added"], 0)  # a re-fold adds nothing

    def test_modified_replaces_body(self) -> None:
        d = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n### Users can add a todo\n\n"
            "#### Scenario: add\n- WHEN submitted\n- THEN it persists\n")
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("THEN it persists", out)
        self.assertNotIn("THEN a todo appears", out)
        self.assertEqual(applied["modified"], 1)

    def test_removed_deletes_requirement(self) -> None:
        d = wc.parse_spec_deltas(
            "## REMOVED Requirements\n\n### Users can add a todo\n")
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertNotIn("### Users can add a todo", out)
        self.assertEqual(applied["removed"], 1)

    def test_renamed_renames_heading_keeps_body(self) -> None:
        d = wc.parse_spec_deltas(
            "## RENAMED Requirements\n\n### Users can add a todo -> Users can create a todo\n")
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertIn("### Users can create a todo", out)
        self.assertNotIn("### Users can add a todo", out)
        self.assertIn("THEN a todo appears", out)  # body preserved
        self.assertEqual(applied["renamed"], 1)

    # --- Applied, not attempted ---

    def test_unmatched_modified_is_promoted_to_added(self) -> None:
        # A MODIFIED with no existing heading to replace is a new requirement mis-labeled — promote it to ADDED (append), never drop it.
        d = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n"
            "### Ghost one\n\n#### Scenario: a\n- x\n\n"
            "### Ghost two\n\n#### Scenario: b\n- y\n\n"
            "### Ghost three\n\n#### Scenario: c\n- z\n")
        self.assertEqual(len(d["modified"]), 3)
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertNotEqual(out, TODOS_LIVING)
        self.assertIn("### Ghost one", out)
        self.assertIn("### Ghost three", out)
        self.assertEqual(applied["modified"], 0)
        self.assertEqual(applied["promoted"], 3)

    def test_promoted_modified_is_idempotent_on_re_fold(self) -> None:
        d = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n### Ghost one\n\n#### Scenario: a\n- x\n")
        once, _ = wc.apply_deltas(TODOS_LIVING, d)
        twice, applied = wc.apply_deltas(once, d)
        self.assertEqual(twice, once)               # re-fold changes nothing (heading now matches)
        self.assertEqual(applied["promoted"], 0)    # not re-added

    def test_promoted_modified_already_present_counts_as_present_not_unmatched(self) -> None:
        # One delta set ADDs a new requirement and also MODIFIEs the same new heading:
        # the MODIFIED can't match (heading is new), promotes, but the ADDED already
        # placed it — counted as promoted_present, never a false unmatched.
        d = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Fresh req\n\n#### Scenario: s\n- a\n\n"
            "## MODIFIED Requirements\n\n### Fresh req\n\n#### Scenario: s\n- a\n")
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertEqual(out.count("### Fresh req"), 1)   # present exactly once
        self.assertEqual(applied["added"], 1)
        self.assertEqual(applied["promoted_present"], 1)
        self.assertEqual(applied["promoted"], 0)

    def test_partial_match_counts_only_what_landed(self) -> None:
        d = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n"
            "### Users can add a todo\n\n#### Scenario: add\n- THEN it persists\n\n"
            "### Ghost\n\n#### Scenario: g\n- nothing\n")
        self.assertEqual(len(d["modified"]), 2)
        _, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertEqual(applied["modified"], 1)

    def test_unmatched_removed_and_renamed_are_not_counted(self) -> None:
        d = wc.parse_spec_deltas(
            "## REMOVED Requirements\n\n### Ghost\n\n"
            "## RENAMED Requirements\n\n### Ghost -> Phantom\n")
        out, applied = wc.apply_deltas(TODOS_LIVING, d)
        self.assertEqual(out, TODOS_LIVING)
        self.assertEqual(applied["removed"], 0)
        self.assertEqual(applied["renamed"], 0)

    def test_all_applied_counts_match_the_parsed_counts(self) -> None:
        d = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n\n"
            "## MODIFIED Requirements\n\n### Users can add a todo\n\n"
            "#### Scenario: add\n- THEN it persists\n")
        _, applied = wc.apply_deltas(TODOS_LIVING, d)
        for verb in ("added", "modified", "removed", "renamed"):
            self.assertEqual(applied[verb], len(d[verb]), verb)


# Re-folding the same deltas must be a no-op. The verbs run in a fixed pipeline
# order regardless of document order, so ADDED landing last used to let the
# earlier verbs act on the section it had just created.
VERBS = ("added", "modified", "removed", "renamed")
SHARED_HEADING = "Requirement: Alpha"
RENAMED_HEADING = "Requirement: Alpha Renamed"
EMPTY_LIVING = "# Alpha — Living Spec\n\n## Requirements\n"

# Distinct body text per verb is mandatory: with identical bodies the ADDED/MODIFIED
# break is invisible and the assertion passes against broken code.
VERB_BODY = {
    "added": "#### Scenario: added\n- THEN the body written by ADDED is present",
    "modified": "#### Scenario: modified\n- THEN the body written by MODIFIED is present",
}


def delta_block(verb: str, heading: str = SHARED_HEADING) -> str:
    """One delta block for `verb`, targeting `heading`, with a body unique to the verb."""
    if verb == "removed":
        return f"## REMOVED Requirements\n\n### {heading}\n"
    if verb == "renamed":
        return f"## RENAMED Requirements\n\n### {heading} -> {heading} Renamed\n"
    return f"## {verb.upper()} Requirements\n\n### {heading}\n\n{VERB_BODY[verb]}\n"


def delta_spec(verbs, heading: str = SHARED_HEADING) -> dict:
    return wc.parse_spec_deltas("\n".join(delta_block(v, heading) for v in verbs))


def count_headings(text: str) -> int:
    return sum(1 for line in text.splitlines() if line.startswith("### "))


class FoldIdempotencyMatrixTests(unittest.TestCase):
    """Applying any delta set to its own output must change nothing."""

    def assert_idempotent(self, deltas: dict, base: str = EMPTY_LIVING, label: str = "") -> str:
        once, _ = wc.apply_deltas(base, deltas)
        twice, _ = wc.apply_deltas(once, deltas)
        self.assertEqual(once, twice, f"re-applying changed the document ({label})")
        return once

    def test_every_single_verb_is_idempotent(self) -> None:
        for verb in VERBS:
            with self.subTest(verb=verb):
                self.assert_idempotent(delta_spec([verb]), label=verb)

    def test_every_ordered_same_heading_pair_is_idempotent(self) -> None:
        for first, second in itertools.permutations(VERBS, 2):
            with self.subTest(order=f"{first}->{second}"):
                self.assert_idempotent(delta_spec([first, second]), label=f"{first} then {second}")

    def test_every_ordered_same_heading_triple_is_idempotent(self) -> None:
        for combo in itertools.permutations(VERBS, 3):
            with self.subTest(order="->".join(combo)):
                self.assert_idempotent(delta_spec(combo), label=" then ".join(combo))

    def test_every_ordered_pair_on_disjoint_headings_is_idempotent(self) -> None:
        for first, second in itertools.permutations(VERBS, 2):
            with self.subTest(order=f"{first}->{second}"):
                text = delta_block(first, "Requirement: One") + "\n" + delta_block(second, "Requirement: Two")
                self.assert_idempotent(wc.parse_spec_deltas(text), label=f"{first}/{second} disjoint")

    def test_add_and_rename_never_grows_the_document(self) -> None:
        deltas = delta_spec(["added", "renamed"])
        text = EMPTY_LIVING
        counts = []
        for _ in range(5):
            text, _ = wc.apply_deltas(text, deltas)
            counts.append(count_headings(text))
        self.assertEqual(counts, [1, 1, 1, 1, 1], f"heading count grew across 5 applies: {counts}")

    def test_add_and_rename_lands_under_the_renamed_heading(self) -> None:
        out = self.assert_idempotent(delta_spec(["added", "renamed"]))
        self.assertIn(f"### {RENAMED_HEADING}", out)
        self.assertNotIn(f"### {SHARED_HEADING}\n", out)
        self.assertIn("the body written by ADDED is present", out)

    def test_add_and_modify_settles_on_the_modified_body(self) -> None:
        out = self.assert_idempotent(delta_spec(["added", "modified"]))
        self.assertEqual(count_headings(out), 1)
        self.assertIn("the body written by MODIFIED is present", out)
        self.assertNotIn("the body written by ADDED is present", out)

    def test_a_rename_chain_resolves_to_the_final_heading(self) -> None:
        text = (
            f"## ADDED Requirements\n\n### {SHARED_HEADING}\n\n{VERB_BODY['added']}\n\n"
            f"## RENAMED Requirements\n\n### {SHARED_HEADING} -> Stage Two\n"
            f"### Stage Two -> Stage Three\n"
        )
        out = self.assert_idempotent(wc.parse_spec_deltas(text), label="rename chain")
        self.assertIn("### Stage Three", out)
        self.assertEqual(count_headings(out), 1)

    def test_a_rename_cycle_terminates(self) -> None:
        text = (
            f"## ADDED Requirements\n\n### {SHARED_HEADING}\n\n{VERB_BODY['added']}\n\n"
            f"## RENAMED Requirements\n\n### {SHARED_HEADING} -> Other\n"
            f"### Other -> {SHARED_HEADING}\n"
        )
        self.assert_idempotent(wc.parse_spec_deltas(text), label="rename cycle")

    def test_folding_onto_an_already_duplicated_document_stops_making_it_worse(self) -> None:
        deltas = delta_spec(["added", "renamed"])
        corrupted = (
            EMPTY_LIVING
            + f"\n### {RENAMED_HEADING}\n\nold copy\n\n### {RENAMED_HEADING}\n\nolder copy\n"
        )
        before = count_headings(corrupted)
        after = self.assert_idempotent(deltas, base=corrupted, label="pre-corrupted")
        self.assertLessEqual(count_headings(after), before)

    def test_existing_add_then_reapply_behavior_on_a_populated_spec_is_unchanged(self) -> None:
        deltas = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        once, applied = wc.apply_deltas(TODOS_LIVING, deltas)
        self.assertEqual(applied["added"], 1)
        twice, reapplied = wc.apply_deltas(once, deltas)
        self.assertEqual(once, twice)
        self.assertEqual(reapplied["added"], 0)


class FoldVerbInterferenceTests(unittest.TestCase):
    """Verbs that target each other's headings, rather than one heading or disjoint ones.

    The matrix above varies the verbs but not how their targets overlap, so every
    case here re-applied cleanly under the matrix and still moved on a second fold."""

    def assert_settled(self, base: str, deltas: dict, label: str) -> str:
        once, _ = wc.apply_deltas(base, deltas)
        twice, _ = wc.apply_deltas(once, deltas)
        self.assertEqual(once, twice, f"re-applying changed the document ({label})")
        return once

    def test_a_rename_chain_declared_out_of_order_lands_in_one_fold(self) -> None:
        base = "# C — Living Spec\n\n## Requirements\n\n### One\n\nbody one\n"
        deltas = wc.parse_spec_deltas(
            "## RENAMED Requirements\n\n### Two -> Three\n### One -> Two\n")
        out = self.assert_settled(base, deltas, "reverse-order chain")
        self.assertIn("### Three", out)

    def test_a_rename_onto_an_occupied_heading_is_skipped(self) -> None:
        base = "# C — Living Spec\n\n## Requirements\n\n### One\n\nbody one\n\n### Two\n\nbody two\n"
        deltas = wc.parse_spec_deltas("## RENAMED Requirements\n\n### One -> Two\n")
        out = self.assert_settled(base, deltas, "rename onto occupied heading")
        self.assertEqual(count_headings(out), 2)
        self.assertIn("### One", out)

    def test_adding_and_removing_one_heading_does_not_shuffle_the_document(self) -> None:
        base = "# C — Living Spec\n\n## Requirements\n\n### One\n\nbody one\n"
        deltas = wc.parse_spec_deltas(
            "## ADDED Requirements\n\n### Two\n\nbody two\n\n### Three\n\nbody three\n\n"
            "## REMOVED Requirements\n\n### Two\n"
        )
        out = self.assert_settled(base, deltas, "add and remove the same heading")
        self.assertEqual(count_headings(out), 3)

    def test_removing_a_heading_the_same_set_renames_onto_is_skipped(self) -> None:
        base = "# C — Living Spec\n\n## Requirements\n\n### One\n\nbody one\n\n### Two\n\nbody two\n"
        deltas = wc.parse_spec_deltas(
            "## RENAMED Requirements\n\n### One -> Two\n\n"
            "## REMOVED Requirements\n\n### Two\n"
        )
        out = self.assert_settled(base, deltas, "remove a rename target")
        self.assertEqual(count_headings(out), 2)

    def test_modifying_a_requirement_keeps_the_blank_line_before_the_next_one(self) -> None:
        base = (
            "# C — Living Spec\n\n## Requirements\n\n"
            "### One\n\nold body\n\n### Two\n\nbody two\n"
        )
        deltas = wc.parse_spec_deltas(
            "## MODIFIED Requirements\n\n### One\n\nnew body\n")
        out = self.assert_settled(base, deltas, "modify before another requirement")
        self.assertIn("new body\n\n### Two", out)

    def test_a_heading_with_stray_whitespace_is_matched_not_re_added(self) -> None:
        base = "# C — Living Spec\n\n## Requirements\n"
        deltas = {
            "added": [("Spaced ", "### Spaced \n\nbody\n")],
            "modified": [], "removed": [], "renamed": [], "markers": {},
        }
        text = base
        for _ in range(4):
            text, _ = wc.apply_deltas(text, deltas)
        self.assertEqual(count_headings(text), 1)


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

    def _fold_log(self, fdir: Path) -> str:
        """The stderr receipt the fold emits."""
        buf = io.StringIO()
        with contextlib.redirect_stderr(buf):
            wc.fold_living_spec(fdir, "ai")
        return buf.getvalue()

    def test_fold_log_counts_applied_changes_not_parsed_ones(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n\n"
            "## MODIFIED Requirements\n\n"
            "### Ghost one\n\n#### Scenario: g\n- x\n\n"
            "### Ghost two\n\n#### Scenario: h\n- y\n")
        log = self._fold_log(fdir)
        self.assertIn("+1 added, ~0 modified", log)
        self.assertNotIn("~2 modified", log)
        self.assertIn("2 added (MODIFIED with no existing match)", log)
        self.assertNotIn("already up to date", log)

    def test_fold_log_is_unchanged_when_everything_applies(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        log = self._fold_log(fdir)
        self.assertIn("+1 added, ~0 modified, -0 removed, ↻0 renamed", log)
        self.assertNotIn("skipped", log)

    def test_redundant_promoted_modified_reports_up_to_date_not_a_skip(self) -> None:
        # A MODIFIED whose requirement is already in the living spec (a re-fold, or
        # a heading already present) is redundant — the receipt must say "up to date",
        # not warn "matched no requirement".
        already = TODOS_LIVING.rstrip() + "\n\n### Due dates\n\n#### Scenario: s\n- a\n"
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": already},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## MODIFIED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        log = self._fold_log(fdir)
        self.assertIn("already up to date", log)
        self.assertNotIn("matched no requirement", log)

    def test_fold_log_names_the_right_reason_for_a_skipped_addition(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Users can add a todo\n\n"
            "#### Scenario: dup\n- x\n\n"
            "## MODIFIED Requirements\n\n### Users can add a todo\n\n"
            "#### Scenario: add\n- THEN it persists\n")
        log = self._fold_log(fdir)
        self.assertIn("+0 added, ~1 modified", log)
        self.assertIn("1 addition(s) skipped: heading already present", log)
        self.assertNotIn("no matching requirement heading", log)

    def test_no_delta_block_is_byte_identical_noop(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nNo deltas here.\n")
        before = self._living(root)
        self.assertIsNone(wc.fold_living_spec(fdir, "ai"))
        self.assertEqual(self._living(root), before)  # byte-identical
        self.assertNotIn("livingSpecs", self._ctx(fdir))

    # #492: a feature that loaded capabilities but wrote no delta block is the
    # common pipeline case. It must produce an actionable signal — named
    # capabilities + how to sync — not a silent success and not a four-way
    # OR-string.
    def test_loaded_capabilities_but_no_delta_is_actionable_not_silent(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nOrdinary requirements, no delta block.\n")
        wc.set_living_specs_loaded(fdir, ["todos"])
        before = self._living(root)
        log = self._fold_log(fdir)
        self.assertIsNone(wc.fold_living_spec(fdir, "ai"))
        self.assertEqual(self._living(root), before)  # nothing written
        self.assertIn("todos", log)
        # a loaded-but-unaccounted capability is the loud backstop, not a
        # soft "nothing to fold yet." Name it and say the loop did not close.
        self.assertIn("unaccounted", log)
        self.assertIn("The loop did not close", log)
        self.assertIn("--living-spec-skip", log)
        # Not an OR-string of every possible reason.
        self.assertNotIn("feature off", log)
        self.assertNotIn("already up to date", log)

    # an explicit skip note turns "silently nothing" into "correctly
    # nothing" — the backstop must go quiet only when every loaded capability is
    # accounted for.
    def test_all_loaded_caps_skipped_is_correctly_nothing(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nRender-only refactor, no behavior change.\n")
        wc.set_living_specs_loaded(fdir, ["todos"])
        wc.set_living_specs_skipped(fdir, [{"name": "todos", "reason": "render-only refactor"}])
        before = self._living(root)
        log = self._fold_log(fdir)
        self.assertIsNone(wc.fold_living_spec(fdir, "ai"))
        self.assertEqual(self._living(root), before)  # byte-identical
        self.assertIn("correctly nothing", log)
        self.assertIn("accounted for", log)
        self.assertNotIn("The loop did not close", log)

    def test_refold_of_a_synced_spec_does_not_false_alarm(self) -> None:
        # A capability folded on the first run is accounted for by the persisted
        # livingSpecs.synced; an idempotent re-fold (which writes nothing new, so
        # its in-run synced list is empty) must NOT print "the loop did not close".
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        wc.set_living_specs_loaded(fdir, ["todos"])
        wc.fold_living_spec(fdir, "ai")                       # first fold — writes + records synced
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])
        after_first = self._living(root)
        log = self._fold_log(fdir)                            # re-fold
        wc.fold_living_spec(fdir, "ai")
        self.assertEqual(self._living(root), after_first)     # byte-identical
        self.assertNotIn("The loop did not close", log)
        self.assertNotIn("unaccounted", log)

    def test_partial_skip_still_flags_the_unaccounted_one(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nNo delta block.\n")
        wc.set_living_specs_loaded(fdir, ["todos", "checkout"])
        wc.set_living_specs_skipped(fdir, [{"name": "checkout", "reason": "unrelated"}])
        log = self._fold_log(fdir)
        # One loaded cap is skip-accounted, the other is not → still loud, names
        # only the unaccounted one.
        self.assertIn("1 unaccounted (todos)", log)
        self.assertIn("The loop did not close", log)

    # A single delta block must NOT silence the backstop for a sibling loaded
    # capability that was neither folded nor skipped — the multi-capability
    # partial-coverage hole. The accountability check runs in the delta path too.
    def test_one_delta_authored_still_flags_a_forgotten_sibling(self) -> None:
        root = _git_repo(
            ENABLED_TWO_CAPS_YAML,
            {"capabilities/todos/spec.md": TODOS_LIVING,
             "capabilities/about/spec.md": "# About\n\n### A\n\n#### Scenario: s\n- x\n"},
            code_files=["src/todos/list.ts", "src/about/page.ts"],
        )
        # A real delta for todos, but `about` was loaded and left with no delta
        # and no skip note.
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n<!-- capability: todos -->\n\n"
            "### Due dates\n\n#### Scenario: s\n- a\n")
        wc.set_living_specs_loaded(fdir, ["todos", "about"])
        log = self._fold_log(fdir)
        # todos folds...
        self.assertIn("### Due dates", self._living(root))
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])
        # ...but `about` is still flagged loudly, not silenced by the todos delta.
        self.assertIn("neither folded nor skipped (about)", log)
        self.assertIn("The loop did not close", log)

    def test_one_delta_with_the_sibling_skipped_stays_quiet(self) -> None:
        root = _git_repo(
            ENABLED_TWO_CAPS_YAML,
            {"capabilities/todos/spec.md": TODOS_LIVING,
             "capabilities/about/spec.md": "# About\n\n### A\n\n#### Scenario: s\n- x\n"},
            code_files=["src/todos/list.ts", "src/about/page.ts"],
        )
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n<!-- capability: todos -->\n\n"
            "### Due dates\n\n#### Scenario: s\n- a\n")
        wc.set_living_specs_loaded(fdir, ["todos", "about"])
        wc.set_living_specs_skipped(fdir, [{"name": "about", "reason": "unchanged"}])
        log = self._fold_log(fdir)
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])
        self.assertNotIn("The loop did not close", log)

    def test_no_delta_and_no_loaded_caps_names_that_reason(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat", "# Feat\n\nNo deltas.\n")
        log = self._fold_log(fdir)
        self.assertIn("no delta block and loaded no capabilities", log)
        self.assertNotIn("feature off", log)

    def test_disabled_names_the_off_reason_exactly(self) -> None:
        disabled = ENABLED_TODOS_YAML.replace("enabled: true", "enabled: false")
        root = _git_repo(disabled, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        log = self._fold_log(fdir)
        self.assertIn("living specs are off in this repo", log)
        self.assertNotIn("no delta block", log)

    def test_real_delta_block_folds_and_prints_no_noop_reason(self) -> None:
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        wc.set_living_specs_loaded(fdir, ["todos"])
        log = self._fold_log(fdir)
        # A real delta writes the capability spec and records the sync — no
        # "nothing to fold" no-op reason appears.
        self.assertIn("### Due dates", self._living(root))
        self.assertEqual(self._ctx(fdir)["livingSpecs"]["synced"], ["todos"])
        self.assertNotIn("nothing to fold", log)

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


TWO_CAP_YAML = (
    "livingSpecs:\n  enabled: true\n  capabilities:\n"
    "    - name: todos\n      match: [\"src/todos/**\"]\n"
    "    - name: billing\n      match: [\"src/billing/**\"]\n"
)


class PerCapabilityFoldRoutingTests(unittest.TestCase):
    """A feature that loaded+changed several capabilities folds each
    capability's own requirement into its own spec — no cross-contamination."""

    def _living(self, root: Path, rel: str) -> str:
        return (root / rel).read_text(encoding="utf-8")

    def _ctx(self, fdir: Path) -> dict:
        return _json.loads((fdir / ".spec-context.json").read_text(encoding="utf-8"))

    def test_two_marked_blocks_route_each_requirement_to_its_own_spec(self) -> None:
        caps = {"capabilities/todos/spec.md": "# Todos\n",
                "capabilities/billing/spec.md": "# Billing\n"}
        # The code change touches todos (default), and each block is marked.
        root = _git_repo(TWO_CAP_YAML, caps, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n"
            "## ADDED Requirements\n<!-- capability: todos -->\n\n"
            "### Todos gain due dates\n\n#### Scenario: s\n- a\n\n"
            "## ADDED Requirements\n<!-- capability: billing -->\n\n"
            "### Invoices can be exported\n\n#### Scenario: s\n- b\n")
        result = wc.fold_living_spec(fdir, "ai")
        self.assertIsNotNone(result)
        todos = self._living(root, "capabilities/todos/spec.md")
        billing = self._living(root, "capabilities/billing/spec.md")
        # Each spec gets ONLY its own requirement.
        self.assertIn("### Todos gain due dates", todos)
        self.assertNotIn("### Invoices can be exported", todos)
        self.assertIn("### Invoices can be exported", billing)
        self.assertNotIn("### Todos gain due dates", billing)
        self.assertEqual(set(self._ctx(fdir)["livingSpecs"]["synced"]), {"todos", "billing"})

    def test_unmarked_block_folds_into_the_matched_default_only(self) -> None:
        caps = {"capabilities/todos/spec.md": "# Todos\n",
                "capabilities/billing/spec.md": "# Billing\n"}
        root = _git_repo(TWO_CAP_YAML, caps, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n"
            "## ADDED Requirements\n\n"  # unmarked -> the changed-files default (todos)
            "### Todos gain due dates\n\n#### Scenario: s\n- a\n\n"
            "## ADDED Requirements\n<!-- capability: billing -->\n\n"
            "### Invoices can be exported\n\n#### Scenario: s\n- b\n")
        wc.fold_living_spec(fdir, "ai")
        todos = self._living(root, "capabilities/todos/spec.md")
        billing = self._living(root, "capabilities/billing/spec.md")
        self.assertIn("### Todos gain due dates", todos)
        self.assertNotIn("### Invoices can be exported", todos)
        self.assertIn("### Invoices can be exported", billing)
        self.assertNotIn("### Todos gain due dates", billing)

    def test_single_unmarked_block_still_folds_into_matched_capability(self) -> None:
        # Backward-compat: today's behavior — one plain delta block, no marker —
        # folds into the changed-files-matched capability and stays idempotent.
        root = _git_repo(ENABLED_TODOS_YAML, {"capabilities/todos/spec.md": TODOS_LIVING},
                         code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n\n### Due dates\n\n#### Scenario: s\n- a\n")
        wc.fold_living_spec(fdir, "ai")
        after_first = self._living(root, "capabilities/todos/spec.md")
        self.assertIn("### Due dates", after_first)
        wc.fold_living_spec(fdir, "ai")  # re-fold
        self.assertEqual(self._living(root, "capabilities/todos/spec.md"), after_first)

    def test_marked_block_writes_a_capability_the_change_did_not_touch(self) -> None:
        # Fold-fires-on-completion: a capability the AI authored a delta for
        # (via the marker) gets a real write even though the code change resolved
        # elsewhere — the old path folded one target and silently dropped the rest.
        caps = {"capabilities/todos/spec.md": "# Todos\n",
                "capabilities/billing/spec.md": "# Billing\n"}
        root = _git_repo(TWO_CAP_YAML, caps, code_files=["src/todos/list.ts"])
        fdir = _write_feature(root, "001-feat",
            "# Feat\n\n## ADDED Requirements\n<!-- capability: billing -->\n\n"
            "### Invoices can be exported\n\n#### Scenario: s\n- b\n")
        before = self._living(root, "capabilities/billing/spec.md")
        wc.fold_living_spec(fdir, "ai")
        self.assertNotEqual(self._living(root, "capabilities/billing/spec.md"), before)
        self.assertIn("billing", self._ctx(fdir)["livingSpecs"]["synced"])


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
        # The capabilities left for the registry; only the legacy block was removed.
        self.assertNotIn("livingSpecs", after)
        self.assertIn("billing", (root / "living-specs.yml").read_text(encoding="utf-8"))

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
        self.assertEqual(result["checked"], 1)
        self.assertIn(
            "✓ 1 of 2 capabilities in sync; 1 not checked — spec.md not yet committed",
            drift.render_human(result),
        )

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
        self.assertEqual(drift.render_human(result), "✓ All 1 checked capability in sync.")

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

    # --- The summary reports the run's OUTCOME, never its intent ---

    def _mixed_root(self) -> Path:
        """todos: spec committed + clean. about: spec never committed → skipped."""
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _write(root, "src/about/page.ts", "// about\n")
        _commit_all(root, "baseline")
        return root

    def test_all_skipped_makes_no_success_claim(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "src/todos/list.ts", "// todos\n")
        _write(root, "src/about/page.ts", "// about\n")
        _commit_all(root, "code only")  # neither capability spec committed

        result = self._run(root)
        text = drift.render_human(result)
        self.assertNotIn("All capabilities in sync", text)
        self.assertNotIn("in sync", text)
        self.assertNotIn("✓", text)
        self.assertIn("0 checked, 2 skipped (spec.md not yet committed)", text)
        self.assertTrue(text.splitlines()[-1].startswith("0 checked"))
        self.assertEqual(result["checked"], 0)
        self.assertEqual(len(result["skipped"]), 2)

    def test_all_skipped_mixed_reasons_omits_the_parenthetical(self) -> None:
        # One reason can't speak for the others, so the shared-reason note drops.
        root = _bake_drift_repo(self.YAML)
        _commit_all(root, "empty")
        result = self._run(root)
        result["skipped"] = [
            {"name": "todos", "reason": "spec.md not yet committed"},
            {"name": "about", "reason": "no resolvable spec path"},
        ]
        text = drift.render_human(result)
        self.assertIn("0 checked, 2 skipped", text)
        self.assertNotIn("skipped (", text)

    def test_enabled_but_nothing_configured_is_not_a_success(self) -> None:
        yaml = "livingSpecs:\n  enabled: true\n  capabilities: []\n"
        root = _bake_drift_repo(yaml)
        _commit_all(root, "empty")

        result = self._run(root)
        text = drift.render_human(result)
        self.assertNotIn("in sync", text)
        self.assertEqual(text, "No capabilities configured.")
        self.assertEqual(result["checked"], 0)
        self.assertEqual(result["skipped"], [])

    def test_disabled_stays_silent(self) -> None:
        root = _bake_drift_repo(self.YAML.replace("enabled: true", "enabled: false"))
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _commit_all(root, "baseline")

        result = self._run(root)
        self.assertEqual(drift.render_human(result), "")
        self.assertEqual(result["checked"], 0)

    def test_mixed_run_reports_both_checked_and_skipped(self) -> None:
        result = self._run(self._mixed_root())
        text = drift.render_human(result)
        self.assertIn(
            "✓ 1 of 2 capabilities in sync; 1 not checked — spec.md not yet committed",
            text,
        )
        self.assertNotIn("All 1 checked", text)
        self.assertEqual(result["checked"], 1)
        self.assertEqual([s["name"] for s in result["skipped"]], ["about"])

    def test_mixed_run_with_drift_still_states_the_skipped_count(self) -> None:
        root = self._mixed_root()
        _write(root, "src/todos/list.ts", "// todos\n// drifted\n")
        _commit_all(root, "off-pipeline edit")

        result = self._run(root)
        text = drift.render_human(result)
        self.assertIn("unspeced src/todos/list.ts", text)
        self.assertIn("1 checked, 1 skipped (spec.md not yet committed)", text)
        self.assertEqual(result["checked"], 1)

    def test_checked_count_tracks_the_capabilities_actually_examined(self) -> None:
        # `checked` must equal the examined set in every state, not the configured one.
        cases = {
            "disabled": _bake_drift_repo(self.YAML.replace("enabled: true", "enabled: false")),
            "all-skipped": _bake_drift_repo(self.YAML),
            "mixed": self._mixed_root(),
        }
        _commit_all(cases["disabled"], "init")
        _commit_all(cases["all-skipped"], "init")

        expected = {"disabled": 0, "all-skipped": 0, "mixed": 1}
        for label, root in cases.items():
            with self.subTest(state=label):
                result = self._run(root)
                self.assertIn("checked", result)
                self.assertEqual(result["checked"], expected[label])
                self.assertEqual(result["checked"], len(result["capabilities"]))

    def test_exits_zero_when_every_capability_was_skipped(self) -> None:
        # The never-halts contract holds even when nothing ran.
        root = _bake_drift_repo(self.YAML)
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "code only")

        self.assertEqual(drift.main(["--root", str(root)]), 0)
        self.assertEqual(drift.main(["--root", str(root), "--json"]), 0)
        self.assertEqual(self._run(root)["checked"], 0)

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


class WorkingDriftTests(unittest.TestCase):
    """`--working` widens drift to the working tree; the default mode must not move."""

    YAML = DriftTests.YAML

    def _run(self, root: Path, working: bool = False) -> dict:
        living = drift.rsp.load_living(str(root))
        return drift.compute_drift(str(root), living, working=working)

    def _baked(self) -> Path:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "baseline")
        return root

    def test_uncommitted_edit_needs_working_mode(self) -> None:
        root = self._baked()
        _write(root, "src/todos/list.ts", "// todos\n// uncommitted\n")

        todos = next(c for c in self._run(root)["capabilities"] if c["name"] == "todos")
        self.assertTrue(todos["inSync"])
        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "unspeced")],
        )

    def test_untracked_file_is_drifted_only_with_working(self) -> None:
        root = self._baked()
        _write(root, "src/todos/new-item.ts", "// brand new\n")

        self.assertTrue(next(c for c in self._run(root)["capabilities"]
                             if c["name"] == "todos")["inSync"])
        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertIn("src/todos/new-item.ts", [d["file"] for d in todos["drifted"]])

    def test_working_tree_deletion_is_drifted(self) -> None:
        root = self._baked()
        (root / "src/todos/list.ts").unlink()

        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertEqual([d["file"] for d in todos["drifted"]], ["src/todos/list.ts"])

    def test_committed_then_reedited_file_is_reported_once(self) -> None:
        root = self._baked()
        _write(root, "src/todos/list.ts", "// todos\n// committed change\n")
        _commit_all(root, "committed change")
        _write(root, "src/todos/list.ts", "// todos\n// and an uncommitted one\n")

        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertEqual([d["file"] for d in todos["drifted"]], ["src/todos/list.ts"])

    def test_exempt_globs_still_filter_in_working_mode(self) -> None:
        root = self._baked()
        _write(root, "src/todos/list.test.ts", "// uncommitted test file\n")

        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertTrue(todos["inSync"])

    def test_uncommitted_spec_is_still_skipped_in_working_mode(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "code only")  # neither capability spec committed
        _write(root, "src/todos/list.ts", "// todos\n// dirty\n")

        result = self._run(root, working=True)
        self.assertEqual(result["capabilities"], [])
        self.assertEqual(result["checked"], 0)
        self.assertIn(
            "0 checked, 2 skipped (spec.md not yet committed)",
            drift.render_human(result),
        )

    def test_uncommitted_spec_context_earns_tracked_in_working_mode(self) -> None:
        root = self._baked()
        _write(root, "src/todos/list.ts", "// changed via pipeline, all uncommitted\n")
        _write(
            root, "specs/003-wip/.spec-context.json",
            '{"files_modified": ["src/todos/list.ts"], "status": "implementing"}\n',
        )

        todos = next(c for c in self._run(root, working=True)["capabilities"]
                     if c["name"] == "todos")
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "tracked")],
        )

    def test_json_carries_the_mode_flag_in_both_modes(self) -> None:
        root = self._baked()
        self.assertFalse(self._run(root)["working"])
        self.assertTrue(self._run(root, working=True)["working"])
        disabled = _bake_drift_repo(self.YAML.replace("enabled: true", "enabled: false"))
        self.assertTrue(self._run(disabled, working=True)["working"])

    def test_default_mode_result_is_unmoved_by_a_dirty_tree(self) -> None:
        root = self._baked()
        clean = self._run(root)
        _write(root, "src/todos/list.ts", "// todos\n// dirty\n")
        _write(root, "src/todos/untracked.ts", "// dirty\n")
        self.assertEqual(self._run(root), clean)

    def test_working_header_names_the_working_tree(self) -> None:
        root = self._baked()
        _write(root, "src/todos/list.ts", "// todos\n// dirty\n")

        self.assertIn("🔍 Spec drift report (working tree included)",
                      drift.render_human(self._run(root, working=True)))
        _commit_all(root, "now committed")
        self.assertIn("🔍 Spec drift report\n", drift.render_human(self._run(root)) + "\n")

    def test_working_mode_always_exits_zero(self) -> None:
        dirty = self._baked()
        _write(dirty, "src/todos/list.ts", "// dirty\n")
        no_git = Path(tempfile.mkdtemp())
        (no_git / ".specify").mkdir(parents=True)
        (no_git / ".specify" / "companion.yml").write_text(self.YAML, encoding="utf-8")

        for root in (dirty, no_git):
            self.assertEqual(drift.main(["--root", str(root), "--working"]), 0)
            self.assertEqual(drift.main(["--root", str(root), "--working", "--json"]), 0)


def _shallow_clone(src: Path, depth: int) -> Path:
    dst = Path(tempfile.mkdtemp()) / "clone"
    subprocess.run(
        ["git", "clone", "-q", "--depth", str(depth), f"file://{src}", str(dst)],
        check=True, capture_output=True, text=True,
    )
    return dst


class DriftShallowCloneTests(unittest.TestCase):
    """A CI checkout without the history to compare against must say so."""

    YAML = DriftTests.YAML

    def _run(self, root: Path) -> dict:
        living = drift.rsp.load_living(str(root))
        return drift.compute_drift(str(root), living)

    def _source_repo(self) -> Path:
        """todos adopted at the first commit, about adopted near the tip, with
        filler commits between so a depth-3 clone splits the two."""
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "src/todos/list.ts", "// todos\n")
        _commit_all(root, "adopt todos")
        for i in range(4):
            _write(root, "src/other/f.ts", f"// filler {i}\n")
            _commit_all(root, f"filler {i}")
        _write(root, "capabilities/about/spec.md", "# About\n")
        _write(root, "src/about/page.ts", "// about\n")
        _commit_all(root, "adopt about")
        _write(root, "src/todos/list.ts", "// todos\n// changed outside\n")
        _commit_all(root, "off-pipeline edit")
        return root

    def test_depth_one_clone_skips_instead_of_claiming_in_sync(self) -> None:
        clone = _shallow_clone(self._source_repo(), 1)

        result = self._run(clone)
        text = drift.render_human(result)
        self.assertEqual(result["checked"], 0)
        self.assertEqual(
            sorted(sk["reason"] for sk in result["skipped"]),
            [drift.SKIP_SHALLOW, drift.SKIP_SHALLOW],
        )
        self.assertNotIn("✓", text)
        self.assertNotIn("in sync", text)
        self.assertIn("shallow clone", text)

    def test_deeper_shallow_clone_skips_instead_of_fabricating_a_baseline(self) -> None:
        clone = _shallow_clone(self._source_repo(), 3)

        result = self._run(clone)
        todos = next(sk for sk in result["skipped"] if sk["name"] == "todos")
        self.assertEqual(todos["reason"], drift.SKIP_SHALLOW)
        self.assertEqual([c["name"] for c in result["capabilities"]], ["about"])
        self.assertEqual(result["capabilities"][0]["drifted"], [])

    def test_mixed_shallow_run_reports_both_counts_and_the_fix(self) -> None:
        clone = _shallow_clone(self._source_repo(), 3)

        text = drift.render_human(self._run(clone))
        self.assertIn(
            f"✓ 1 of 2 capabilities in sync; 1 not checked — {drift.SKIP_SHALLOW}", text
        )
        self.assertNotIn("All 1 checked", text)
        self.assertIn("fetch-depth: 0", text)

    def test_full_clone_is_unaffected_by_the_shallow_guard(self) -> None:
        source = self._source_repo()

        result = self._run(source)
        todos = next(c for c in result["capabilities"] if c["name"] == "todos")
        self.assertEqual(result["skipped"], [])
        self.assertEqual(result["checked"], 2)
        self.assertEqual(
            [(d["file"], d["severity"]) for d in todos["drifted"]],
            [("src/todos/list.ts", "unspeced")],
        )
        self.assertNotIn("shallow", drift.render_human(result))

    def test_every_shallow_path_still_exits_zero(self) -> None:
        source = self._source_repo()
        for depth in (1, 3):
            clone = _shallow_clone(source, depth)
            with self.subTest(depth=depth):
                self.assertEqual(drift.main(["--root", str(clone)]), 0)
                self.assertEqual(drift.main(["--root", str(clone), "--json"]), 0)

    def test_unreadable_history_is_not_reported_as_an_uncommitted_spec(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _commit_all(root, "adopt todos")
        for obj in (root / ".git" / "objects").rglob("*"):
            if obj.is_file():
                obj.unlink()

        result = self._run(root)
        todos = next(sk for sk in result["skipped"] if sk["name"] == "todos")
        self.assertEqual(todos["reason"], drift.SKIP_UNREADABLE)
        self.assertNotEqual(todos["reason"], drift.SKIP_UNCOMMITTED)
        self.assertEqual(drift.main(["--root", str(root)]), 0)

    def test_repo_with_no_commits_reports_uncommitted_not_unreadable(self) -> None:
        root = _bake_drift_repo(self.YAML)
        _write(root, "capabilities/todos/spec.md", "# Todos\n")
        _write(root, "capabilities/about/spec.md", "# About\n")

        result = self._run(root)
        self.assertEqual(result["checked"], 0)
        self.assertEqual(
            sorted(sk["reason"] for sk in result["skipped"]),
            [drift.SKIP_UNCOMMITTED, drift.SKIP_UNCOMMITTED],
        )
        self.assertNotIn("unreadable", drift.render_human(result))
        self.assertEqual(drift.main(["--root", str(root)]), 0)

    def test_full_clone_with_no_shallow_file_finds_no_boundaries(self) -> None:
        root = self._source_repo()

        self.assertEqual(drift._shallow_boundaries(str(root)), frozenset())
        self.assertTrue(drift._shallow_boundaries(str(_shallow_clone(root, 1))))

    def test_an_unreadable_shallow_file_skips_instead_of_claiming_full_history(self) -> None:
        clone = _shallow_clone(self._source_repo(), 1)
        shallow = Path(clone) / ".git" / "shallow"
        shallow.chmod(0o000)
        self.addCleanup(shallow.chmod, 0o644)

        self.assertIsNone(drift._shallow_boundaries(str(clone)))

        result = self._run(Path(clone))
        self.assertEqual(result["checked"], 0)
        self.assertTrue(result["skipped"])
        self.assertEqual(
            {sk["reason"] for sk in result["skipped"]}, {drift.SKIP_UNREADABLE}
        )
        self.assertNotIn("in sync", drift.render_human(result))
        self.assertEqual(drift.main(["--root", str(clone)]), 0)


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


# --- LS·8 × LS·3: named requirements (the shape the fold-back writes) --------

NAMED_SPEC = """\
# Billing
## Requirements

### Requirement: Charge a card

#### Scenario: a valid card is charged
- WHEN a user submits a valid card
- THEN the charge succeeds

### Refund a charge

#### Scenario: a charge is refunded
- WHEN an operator refunds a settled charge
- THEN the money is returned
"""

NAMED_COVERAGE = """\
# Billing coverage

| Requirement | Test |
| --- | --- |
| Charge a card | src/billing/charge.test.ts |
"""

MIXED_SPEC = """\
# Billing
## Requirements
- **FR-001** Charge a card.
- **FR-002** Refund a charge.

### Users can email a receipt

#### Scenario: a receipt is emailed
- WHEN a charge settles
- THEN a receipt is emailed
"""

# `###` used as a SECTION grouping over FR bullets — the heading is a label, the
# bullets are the requirements.
SECTIONED_SPEC = """\
# Billing
## Requirements

### Public surface
- **FR-001** Charge a card.
- **FR-002** Refund a charge.

### Layout primitives
- **NFR-001** Renders under 100ms.
"""


class NamedRequirementParseTests(unittest.TestCase):
    """LS·8 — the named (`### <name>`) requirement form the fold writes."""

    def test_named_headings_are_requirements(self) -> None:
        # Both `### Requirement: <name>` and the bare `### <name>` form; the
        # `Requirement:` label is stripped from the identity.
        self.assertEqual(
            coverage.spec_requirements(NAMED_SPEC),
            ["Charge a card", "Refund a charge"],
        )

    def test_scenario_heading_is_not_a_requirement(self) -> None:
        reqs = coverage.spec_requirements(NAMED_SPEC)
        self.assertFalse([r for r in reqs if r.lower().startswith("scenario")])

    def test_section_heading_over_fr_bullets_is_not_a_requirement(self) -> None:
        # `### Public surface` groups FR bullets → the bullets are the
        # requirements, the heading is not (no double counting).
        self.assertEqual(
            coverage.spec_requirements(SECTIONED_SPEC), ["FR-1", "FR-2", "NFR-1"]
        )

    def test_mixed_spec_reports_both_forms(self) -> None:
        self.assertEqual(
            coverage.spec_requirements(MIXED_SPEC),
            ["FR-1", "FR-2", "Users can email a receipt"],
        )

    def test_pure_fr_spec_is_unchanged(self) -> None:
        self.assertEqual(coverage.spec_requirements(BILLING_SPEC), ["FR-1", "FR-2", "FR-3"])

    def test_named_requirements_are_deduped_case_insensitively(self) -> None:
        text = "### Charge a card\n\n### Requirement: **charge a card**\n"
        self.assertEqual(coverage.spec_requirements(text), ["Charge a card"])

    def test_coverage_map_matches_a_requirement_by_name(self) -> None:
        names = coverage.spec_requirements(NAMED_SPEC)
        cmap = coverage.coverage_map(NAMED_COVERAGE, names)
        self.assertEqual(cmap["charge a card"], ["src/billing/charge.test.ts"])
        self.assertNotIn("refund a charge", cmap)

    def test_name_matching_needs_the_spec_names(self) -> None:
        # Without the spec's names there is nothing to look for — the id-only
        # behavior is preserved for callers that pass one argument.
        self.assertEqual(coverage.coverage_map(NAMED_COVERAGE), {})

    def test_a_name_only_partially_present_does_not_match(self) -> None:
        cmap = coverage.coverage_map(
            "| Charge | src/billing/charge.test.ts |\n", ["Charge a card"]
        )
        self.assertNotIn("charge a card", cmap)


class NamedRequirementReportTests(unittest.TestCase):
    """LS·8 — named requirements reach the report (issue #454)."""

    def test_named_spec_is_reported_covered_and_uncovered(self) -> None:
        root = _bake_coverage_repo(spec=NAMED_SPEC, cov=NAMED_COVERAGE)
        cap = coverage.run(str(root), None)["capabilities"][0]
        by_id = {r["id"]: r for r in cap["requirements"]}
        self.assertEqual((cap["covered"], cap["total"]), (1, 2))
        self.assertTrue(by_id["Charge a card"]["covered"])
        self.assertEqual(by_id["Charge a card"]["tests"], ["src/billing/charge.test.ts"])
        # A named requirement with no coverage entry reports as UNCOVERED —
        # before #454 it was absent from the report entirely.
        self.assertFalse(by_id["Refund a charge"]["covered"])
        self.assertEqual(by_id["Refund a charge"]["kind"], "name")

    def test_mixed_spec_counts_both_forms(self) -> None:
        cov = BILLING_COVERAGE + "- Users can email a receipt → src/billing/receipt.test.ts\n"
        root = _bake_coverage_repo(spec=MIXED_SPEC, cov=cov)
        cap = coverage.run(str(root), None)["capabilities"][0]
        by_id = {r["id"]: r for r in cap["requirements"]}
        self.assertEqual((cap["covered"], cap["total"]), (3, 3))
        self.assertEqual(by_id["FR-1"]["kind"], "id")
        self.assertEqual(
            by_id["Users can email a receipt"]["tests"], ["src/billing/receipt.test.ts"]
        )

    def test_named_capability_without_a_coverage_file_reports_uncovered(self) -> None:
        root = _bake_coverage_repo(spec=NAMED_SPEC, cov=None)
        cap = coverage.run(str(root), None)["capabilities"][0]
        self.assertFalse(cap["hasCoverage"])
        self.assertEqual((cap["covered"], cap["total"]), (0, 2))

    def test_human_render_lists_named_requirements(self) -> None:
        root = _bake_coverage_repo(spec=NAMED_SPEC, cov=NAMED_COVERAGE)
        text = coverage.render_human(coverage.run(str(root), None))
        self.assertIn("✓ Charge a card → src/billing/charge.test.ts", text)
        self.assertIn("✗ Refund a charge — uncovered", text)


CENTRAL_YAML = """\
livingSpecs:
  enabled: true
  capabilities:
    - name: billing
      match: ["src/features/billing/**"]
"""


def _read_registry(root: Path) -> str:
    return (root / "living-specs.yml").read_text(encoding="utf-8")

def _read_config(root: Path) -> str:
    return (root / ".specify" / "companion.yml").read_text(encoding="utf-8")


class RelocateCapabilityTests(unittest.TestCase):
    """#460 — migrating a capability between centralized and colocated storage."""

    def test_central_to_colocated_moves_file_and_sets_spec(self) -> None:
        root = make_repo(CENTRAL_YAML, files=["src/features/billing/x.ts"],
                         spec_files=["capabilities/billing/spec.md"])
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertEqual(len(result["relocated"]), 1)
        target = root / "src/features/billing/billing.spec.md"
        self.assertTrue(target.is_file())
        self.assertFalse((root / "capabilities/billing/spec.md").exists())
        self.assertIn("spec: src/features/billing/billing.spec.md", _read_registry(root))

    def test_colocated_to_central_moves_back_and_removes_the_key(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: billing\n      match: [\"src/features/billing/**\"]\n"
            "      spec: src/features/billing/billing.spec.md\n"
        )
        root = make_repo(yaml, spec_files=["src/features/billing/billing.spec.md"])
        relocate.relocate(str(root), "central", name="billing")
        self.assertTrue((root / "capabilities/billing/spec.md").is_file())
        self.assertFalse((root / "src/features/billing/billing.spec.md").exists())
        # Terse by default: the resolver fills the centralized path itself.
        self.assertNotIn("spec:", _read_registry(root))

    def test_resolver_agrees_with_the_config_after_a_move(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        relocate.relocate(str(root), "colocated", name="billing")
        entry = rsp.discover_all(rsp.load_living(str(root)), str(root))[0]
        self.assertEqual(entry["location"], "colocated")
        self.assertEqual(entry["spec"], "src/features/billing/billing.spec.md")
        self.assertTrue(entry["exists"])

    def test_tier_siblings_move_with_the_hot_spec(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=[
            "capabilities/billing/spec.md",
            "capabilities/billing/spec.arch.md",
            "capabilities/billing/spec.coverage.md",
        ])
        relocate.relocate(str(root), "colocated", name="billing")
        area = root / "src/features/billing"
        self.assertTrue((area / "billing.spec.md").is_file())
        self.assertTrue((area / "billing.arch.md").is_file())
        self.assertTrue((area / "billing.coverage.md").is_file())

    def test_absent_tier_sibling_is_simply_not_moved(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=[
            "capabilities/billing/spec.md", "capabilities/billing/spec.arch.md",
        ])
        relocate.relocate(str(root), "colocated", name="billing")
        area = root / "src/features/billing"
        self.assertTrue((area / "billing.arch.md").is_file())
        self.assertFalse((area / "billing.coverage.md").exists())

    def test_rerun_in_the_target_layout_is_a_clean_no_op(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        relocate.relocate(str(root), "colocated", name="billing")
        before = _read_config(root)
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertEqual(result["relocated"], [])
        self.assertEqual(result["unchanged"][0]["action"], "already-colocated")
        self.assertEqual(_read_config(root), before)
        self.assertEqual(relocate.main(["--root", str(root), "--name", "billing",
                                        "--to", "colocated"]), 0)

    def test_already_central_is_a_no_op(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        result = relocate.relocate(str(root), "central", name="billing")
        self.assertEqual(result["relocated"], [])
        self.assertEqual(result["unchanged"][0]["action"], "already-central")

    def test_multi_glob_without_a_common_root_fails_clearly(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: wide\n      match: [\"src/a/**\", \"lib/b/**\"]\n"
        )
        root = make_repo(yaml, spec_files=["capabilities/wide/spec.md"])
        with self.assertRaises(ValueError) as ctx:
            relocate.relocate(str(root), "colocated", name="wide")
        self.assertIn("no single area root", str(ctx.exception))
        self.assertIn("--spec", str(ctx.exception))
        # Nothing was touched — not even a registry brought into being.
        self.assertTrue((root / "capabilities/wide/spec.md").is_file())
        self.assertFalse((root / "living-specs.yml").exists())
        self.assertEqual(
            relocate.main(["--root", str(root), "--name", "wide", "--to", "colocated"]), 2
        )

    def test_sibling_globs_use_the_shallowest_common_directory(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: wide\n      match: [\"src/a/**\", \"src/b/**\"]\n"
        )
        root = make_repo(yaml, spec_files=["capabilities/wide/spec.md"])
        result = relocate.relocate(str(root), "colocated", name="wide")
        self.assertEqual(result["relocated"][0]["spec"], "src/wide.spec.md")
        self.assertTrue((root / "src/wide.spec.md").is_file())

    def test_spec_override_beats_the_derivation(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        relocate.relocate(str(root), "colocated", name="billing",
                          spec="src/features/billing/docs/money.spec.md")
        self.assertTrue((root / "src/features/billing/docs/money.spec.md").is_file())
        self.assertIn("spec: src/features/billing/docs/money.spec.md", _read_registry(root))

    def test_spec_override_rescues_an_ambiguous_capability(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: wide\n      match: [\"src/a/**\", \"lib/b/**\"]\n"
        )
        root = make_repo(yaml, spec_files=["capabilities/wide/spec.md"])
        relocate.relocate(str(root), "colocated", name="wide", spec="src/a/wide.spec.md")
        self.assertTrue((root / "src/a/wide.spec.md").is_file())

    def test_all_migrates_many_and_skips_the_ambiguous_one(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: alpha\n      match: [\"src/alpha/**\"]\n"
            "    - name: wide\n      match: [\"src/a/**\", \"lib/b/**\"]\n"
            "    - name: beta\n      match: [\"src/beta/**\"]\n"
        )
        root = make_repo(yaml, spec_files=[
            "capabilities/alpha/spec.md", "capabilities/wide/spec.md",
            "capabilities/beta/spec.md",
        ])
        result = relocate.relocate(str(root), "colocated", every=True)
        self.assertEqual({p["name"] for p in result["relocated"]}, {"alpha", "beta"})
        self.assertEqual([s["name"] for s in result["skipped"]], ["wide"])
        self.assertTrue((root / "src/alpha/alpha.spec.md").is_file())
        self.assertTrue((root / "src/beta/beta.spec.md").is_file())
        # The skipped capability keeps BOTH halves of its old layout.
        self.assertTrue((root / "capabilities/wide/spec.md").is_file())
        cfg = _read_registry(root)
        self.assertIn("spec: src/alpha/alpha.spec.md", cfg)
        self.assertIn("spec: src/beta/beta.spec.md", cfg)
        self.assertNotIn("spec: capabilities/wide", cfg)
        # Partial run -> exit 1, never an abort.
        self.assertEqual(relocate.main(["--root", str(root), "--all", "--to", "colocated"]), 1)

    def test_all_round_trips_back_to_central(self) -> None:
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: alpha\n      match: [\"src/alpha/**\"]\n"
            "    - name: beta\n      match: [\"src/beta/**\"]\n"
        )
        root = make_repo(yaml, spec_files=[
            "capabilities/alpha/spec.md", "capabilities/beta/spec.md",
        ])
        relocate.relocate(str(root), "colocated", every=True)
        relocate.relocate(str(root), "central", every=True)
        self.assertTrue((root / "capabilities/alpha/spec.md").is_file())
        self.assertTrue((root / "capabilities/beta/spec.md").is_file())
        self.assertNotIn("spec:", _read_registry(root))

    def test_a_failed_config_write_rolls_the_files_back(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=[
            "capabilities/billing/spec.md", "capabilities/billing/spec.arch.md",
        ])
        before = _read_config(root)
        original_write = relocate._write_config
        relocate._write_config = lambda *a, **k: (_ for _ in ()).throw(OSError("disk full"))
        try:
            with self.assertRaises(OSError):
                relocate.relocate(str(root), "colocated", name="billing")
        finally:
            relocate._write_config = original_write
        # Config and disk still agree — on the ORIGINAL layout.
        self.assertEqual(_read_config(root), before)
        self.assertTrue((root / "capabilities/billing/spec.md").is_file())
        self.assertTrue((root / "capabilities/billing/spec.arch.md").is_file())
        self.assertFalse((root / "src/features/billing/billing.spec.md").exists())
        entry = rsp.discover_all(rsp.load_living(str(root)), str(root))[0]
        self.assertEqual(entry["location"], "centralized")
        self.assertTrue(entry["exists"])

    def test_destination_collision_refuses_before_moving_anything(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=[
            "capabilities/billing/spec.md",
            "src/features/billing/billing.spec.md",
        ])
        with self.assertRaises(ValueError) as ctx:
            relocate.relocate(str(root), "colocated", name="billing")
        self.assertIn("already exists", str(ctx.exception))
        self.assertTrue((root / "capabilities/billing/spec.md").is_file())

    def test_display_name_change_is_reported(self) -> None:
        # A colocated stem that differs from the capability name renames the sidebar
        # entry when it moves to the centralized layout.
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: todos-store\n      match: [\"src/store/**\"]\n"
            "      spec: src/store/todos.spec.md\n"
        )
        root = make_repo(yaml, spec_files=["src/store/todos.spec.md"])
        plan = relocate.relocate(str(root), "central", name="todos-store")["relocated"][0]
        self.assertTrue(plan["renamed"])
        self.assertEqual(plan["displayNameFrom"], "todos")
        self.assertEqual(plan["displayName"], "todos-store")
        self.assertIn("sidebar name changes", relocate.render_human(
            {"relocated": [plan], "unchanged": [], "skipped": []}))

    def test_matching_stem_does_not_report_a_rename(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        plan = relocate.relocate(str(root), "colocated", name="billing")["relocated"][0]
        self.assertFalse(plan["renamed"])

    def test_missing_config_is_a_clear_error_not_a_traceback(self) -> None:
        root = Path(tempfile.mkdtemp())
        self.assertEqual(
            relocate.main(["--root", str(root), "--name", "x", "--to", "central"]), 2
        )

    def test_malformed_config_refuses_to_write(self) -> None:
        root = make_repo("livingSpecs:\n  enabled: true\n  capabilities:\n  - [unclosed\n")
        self.assertEqual(
            relocate.main(["--root", str(root), "--name", "x", "--to", "central"]), 2
        )

    def test_unknown_capability_lists_the_registered_ones(self) -> None:
        root = make_repo(CENTRAL_YAML)
        with self.assertRaises(ValueError) as ctx:
            relocate.relocate(str(root), "colocated", name="nope")
        self.assertIn("billing", str(ctx.exception))

    def test_name_and_all_are_mutually_exclusive(self) -> None:
        root = make_repo(CENTRAL_YAML)
        self.assertEqual(relocate.main(["--root", str(root), "--to", "central"]), 2)
        self.assertEqual(
            relocate.main(["--root", str(root), "--all", "--name", "billing",
                           "--to", "central"]), 2
        )
        self.assertEqual(
            relocate.main(["--root", str(root), "--all", "--to", "central",
                           "--spec", "x.spec.md"]), 2
        )

    def test_empty_colocated_spec_can_be_repaired_to_central(self) -> None:
        # This config already breaks the resolver; relocating to central is the fix.
        yaml = (
            "livingSpecs:\n  enabled: true\n  capabilities:\n"
            "    - name: broken\n      match: [\"src/broken/**\"]\n      spec: \"\"\n"
        )
        root = make_repo(yaml)
        result = relocate.relocate(str(root), "central", name="broken")
        self.assertEqual(result["relocated"][0]["spec"], "capabilities/broken/spec.md")
        self.assertEqual(rsp.main(["--root", str(root), "--all"]), 0)

    def test_unrelated_config_blocks_survive_the_rewrite(self) -> None:
        yaml = "commands:\n  specify:\n    nodes: [\"resolve-dir\"]\n\n" + CENTRAL_YAML
        root = make_repo(yaml, spec_files=["capabilities/billing/spec.md"])
        relocate.relocate(str(root), "colocated", name="billing")
        cfg = _read_config(root)
        self.assertIn("commands:", cfg)
        self.assertIn('nodes: ["resolve-dir"]', cfg)


# --------------------------------------------------------------------------- #
# The capability registry lives outside `.specify/`
# --------------------------------------------------------------------------- #
def _bare_git_repo() -> Path:
    """A committed throwaway repo with no capabilities registered."""
    def run(*args: str) -> None:
        _sp.run(["git", *args], cwd=root, check=True,
                stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)

    root = Path(tempfile.mkdtemp())
    run("init")
    run("config", "user.email", "t@example.com")
    run("config", "user.name", "t")
    (root / ".specify").mkdir(parents=True)
    (root / ".specify" / "companion.yml").write_text(
        "commands:\n  specify:\n    nodes: [\"resolve-dir\"]\n", encoding="utf-8"
    )
    (root / "README.md").write_text("# repo\n", encoding="utf-8")
    run("add", "-A")
    run("commit", "-m", "initial")
    return root


class RegistrySurvivesCleanupTests(unittest.TestCase):
    """The regression itself: `git restore … .specify/` must not erase registrations."""

    def test_registration_survives_the_cleanup_command(self) -> None:
        root = _bare_git_repo()
        regcap.register(str(root), "provetrap", ["src/core/**"], [], None)
        self.assertEqual(
            [c["name"] for c in rsp.load_living(str(root))["capabilities"]], ["provetrap"]
        )

        _sp.run(["git", "restore", ".specify/"], cwd=root, check=True,
                stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)

        self.assertEqual(
            [c["name"] for c in rsp.load_living(str(root))["capabilities"]], ["provetrap"]
        )
        matched = rsp.match_changed(["src/core/thing.ts"], rsp.load_living(str(root)), str(root))
        self.assertEqual([m["name"] for m in matched], ["provetrap"])

    def test_registry_is_written_outside_the_restored_folder(self) -> None:
        root = Path(tempfile.mkdtemp())
        result = regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertEqual(result["configPath"], "living-specs.yml")
        self.assertTrue((root / "living-specs.yml").is_file())
        self.assertFalse((root / ".specify" / "companion.yml").exists())


class RegistryMigrationTests(unittest.TestCase):
    """Legacy registrations keep working, and move to the registry on the next write."""

    def test_legacy_only_still_resolves(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(meta["origin"], "legacy")
        self.assertEqual([c["name"] for c in living["capabilities"]],
                         ["checkout", "checkout-cart"])
        self.assertEqual(meta["warnings"], [])

    def test_registration_migrates_the_whole_set(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        result = regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        self.assertEqual(result["migratedFrom"], cc.LEGACY_CONFIG_REL)
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(meta["origin"], "registry")
        self.assertEqual([c["name"] for c in living["capabilities"]],
                         ["checkout", "checkout-cart", "billing"])
        self.assertNotIn("livingSpecs", _read_config(root))

    def test_migration_leaves_sibling_blocks_and_comments_intact(self) -> None:
        yaml = (
            "# top of file\n"
            "commands:\n  specify:\n    nodes: [\"resolve-dir\"]\n"
            "\n# downstream hooks (keep me)\n"
            + CHECKOUT_YAML
            + "\nhooks:\n  after_specify: noop\n"
        )
        root = make_repo(yaml)
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        cfg = _read_config(root)
        self.assertIn("# top of file", cfg)
        self.assertIn('nodes: ["resolve-dir"]', cfg)
        self.assertIn("# downstream hooks (keep me)", cfg)
        self.assertIn("after_specify: noop", cfg)
        self.assertNotIn("livingSpecs", cfg)
        self.assertNotIn("checkout", cfg)

    def test_relocation_migrates_too(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertEqual(result["configPath"], "living-specs.yml")
        self.assertEqual(result["migratedFrom"], cc.LEGACY_CONFIG_REL)
        self.assertNotIn("livingSpecs", _read_config(root))
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(meta["origin"], "registry")
        self.assertEqual([c["name"] for c in living["capabilities"]], ["billing"])

    def test_registry_wins_and_stale_legacy_is_reported(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        (root / "living-specs.yml").write_text(
            'enabled: true\ncapabilities:\n  - name: billing\n    match: ["src/billing/**"]\n',
            encoding="utf-8",
        )
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(meta["origin"], "registry")
        self.assertTrue(meta["legacy_stale"])
        self.assertEqual([c["name"] for c in living["capabilities"]], ["billing"])
        self.assertEqual(len(meta["warnings"]), 1)
        self.assertIn("living-specs.yml", meta["warnings"][0])

    def test_unparseable_registry_does_not_fall_back_to_legacy(self) -> None:
        root = make_repo(CHECKOUT_YAML)
        (root / "living-specs.yml").write_text("- just\n- a list\n", encoding="utf-8")
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(living["capabilities"], [])
        self.assertFalse(living["enabled"])
        self.assertEqual(len(meta["warnings"]), 1)
        self.assertIn("malformed", meta["warnings"][0])

    def test_stale_legacy_block_survives_a_registry_write(self) -> None:
        # The registry answered, so the legacy capabilities were never carried forward —
        # deleting that block would lose them outright.
        root = make_repo(CHECKOUT_YAML)
        (root / "living-specs.yml").write_text(
            'enabled: true\ncapabilities:\n  - name: billing\n    match: ["src/billing/**"]\n',
            encoding="utf-8",
        )
        result = regcap.register(str(root), "search", ["src/search/**"], [], None)
        self.assertNotIn("migratedFrom", result)
        self.assertEqual(result["staleLegacy"], cc.LEGACY_CONFIG_REL)
        legacy = _read_config(root)
        self.assertIn("livingSpecs", legacy)
        self.assertIn("checkout", legacy)
        self.assertIn("checkout-cart", legacy)
        self.assertEqual(
            [c["name"] for c in rsp.load_living(str(root))["capabilities"]],
            ["billing", "search"],
        )

    def test_relocation_leaves_a_stale_legacy_block_alone(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["capabilities/billing/spec.md"])
        (root / "living-specs.yml").write_text(
            'enabled: true\ncapabilities:\n  - name: billing\n    match: ["src/billing/**"]\n',
            encoding="utf-8",
        )
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertNotIn("migratedFrom", result)
        self.assertIn("checkout", _read_config(root))

    def test_unparseable_legacy_reports_the_parse_error_not_an_absence(self) -> None:
        root = Path(tempfile.mkdtemp())
        (root / ".specify").mkdir()
        (root / ".specify" / "companion.yml").write_text(
            "livingSpecs:\n  enabled: true\nno colon here\n", encoding="utf-8"
        )
        with self.assertRaises(ValueError) as ctx:
            relocate.relocate(str(root), "colocated", every=True)
        self.assertIn("malformed", str(ctx.exception))

    def test_relocation_reports_a_stale_legacy_block_it_did_not_migrate(self) -> None:
        root = make_repo(CHECKOUT_YAML, spec_files=["src/billing/billing.spec.md"])
        (root / "living-specs.yml").write_text(
            "enabled: true\ncapabilities:\n  - name: billing\n"
            '    match: ["src/billing/**"]\n    spec: src/billing/billing.spec.md\n',
            encoding="utf-8",
        )
        # Already colocated, so nothing moves and the legacy block is never dropped.
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertEqual(result["relocated"], [])
        self.assertEqual(result["staleLegacy"], cc.LEGACY_CONFIG_REL)
        self.assertIn("livingSpecs", _read_config(root))
        human = relocate.render_human(result)
        self.assertIn(cc.LEGACY_CONFIG_REL, human)
        self.assertIn("ignored", human)

    def test_relocation_that_migrates_reports_the_move_not_a_stale_block(self) -> None:
        root = make_repo(CENTRAL_YAML, spec_files=["capabilities/billing/spec.md"])
        result = relocate.relocate(str(root), "colocated", name="billing")
        self.assertEqual(result["migratedFrom"], cc.LEGACY_CONFIG_REL)
        self.assertNotIn("staleLegacy", result)
        self.assertIn("moved your capability registrations out of",
                      relocate.render_human(result))

    def test_unparseable_registry_is_refused_not_overwritten(self) -> None:
        root = Path(tempfile.mkdtemp())
        bad = "- just\n- a list\n"
        (root / "living-specs.yml").write_text(bad, encoding="utf-8")
        with self.assertRaises(ValueError):
            regcap.register(str(root), "x", ["src/x/**"], [], None)
        self.assertEqual((root / "living-specs.yml").read_text(encoding="utf-8"), bad)


class RegistryHandEditTests(unittest.TestCase):
    """A hand-written registry works, in either accepted shape."""

    FLAT = (
        "# my capabilities\n"
        "enabled: true\n"
        "capabilities:\n"
        '  - name: checkout\n    match: ["src/checkout/**"]\n'
    )
    WRAPPED = (
        "livingSpecs:\n  enabled: true\n  capabilities:\n"
        '    - name: checkout\n      match: ["src/checkout/**"]\n'
    )

    def _resolve(self, text: str):
        root = Path(tempfile.mkdtemp())
        (root / "living-specs.yml").write_text(text, encoding="utf-8")
        return rsp.load_living(str(root))

    def test_flattened_and_wrapped_shapes_resolve_identically(self) -> None:
        self.assertEqual(self._resolve(self.FLAT), self._resolve(self.WRAPPED))

    def test_hand_written_capability_matches_changed_files(self) -> None:
        root = Path(tempfile.mkdtemp())
        (root / "living-specs.yml").write_text(self.FLAT, encoding="utf-8")
        living = rsp.load_living(str(root))
        self.assertTrue(living["enabled"])
        matched = rsp.match_changed(["src/checkout/cart.ts"], living, str(root))
        self.assertEqual([m["name"] for m in matched], ["checkout"])

    def test_hand_edit_survives_a_later_registration(self) -> None:
        root = Path(tempfile.mkdtemp())
        (root / "living-specs.yml").write_text(self.FLAT, encoding="utf-8")
        regcap.register(str(root), "billing", ["src/billing/**"], [], None)
        text = (root / "living-specs.yml").read_text(encoding="utf-8")
        self.assertIn("# my capabilities", text)
        self.assertEqual([c["name"] for c in rsp.load_living(str(root))["capabilities"]],
                         ["checkout", "billing"])

    def test_registry_marks_a_nested_directory_as_its_own_project(self) -> None:
        root = Path(tempfile.mkdtemp())
        (root / "living-specs.yml").write_text(self.FLAT, encoding="utf-8")
        nested = root / "examples" / "sample"
        nested.mkdir(parents=True)
        (nested / "living-specs.yml").write_text("enabled: false\ncapabilities: []\n",
                                                 encoding="utf-8")
        (nested / "thing.spec.md").write_text("# nested\n", encoding="utf-8")
        self.assertTrue(cc.is_project_root(str(nested)))
        self.assertEqual(rsp.find_spec_files(str(root)), [])


class RegistryNotAdoptedTests(unittest.TestCase):
    """Neither file present reads as not adopted — quietly, and successfully."""

    def test_resolver_drift_and_coverage_are_all_silent(self) -> None:
        root = Path(tempfile.mkdtemp())
        living, meta = rsp.load_living_with_meta(str(root))
        self.assertEqual(meta["origin"], "none")
        self.assertIsNone(meta["path"])
        self.assertEqual(meta["warnings"], [])
        self.assertFalse(living["enabled"])
        self.assertEqual(living["capabilities"], [])

        for argv in (["--root", str(root), "--all"], ["--root", str(root), "--orphans"]):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = rsp.main(argv)
            self.assertEqual(code, 0)
            self.assertEqual(err.getvalue(), "")

        for module, argv in ((drift, ["--root", str(root)]),
                             (coverage, ["--root", str(root)])):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = module.main(argv)
            self.assertEqual(code, 0)
            self.assertEqual(err.getvalue(), "")


if __name__ == "__main__":
    unittest.main()
