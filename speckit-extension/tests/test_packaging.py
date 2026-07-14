#!/usr/bin/env python3
"""Tests for the release-archive packing list.

Guards the packaging contract: the declared RUNTIME_SCRIPTS must equal the closure
independently derived from the shipped command bodies, every script must carry an
explicit ship / don't-ship decision, and the derivation must follow indirect
dependencies rather than only the scripts a command names outright.

Stdlib `unittest` only (runs under pytest too), so the existing CI discover sweep
picks it up.
"""
from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"

_spec = importlib.util.spec_from_file_location("package_manifest", SCRIPTS / "package-manifest.py")
pm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pm)


def scripts_on_disk() -> set[str]:
    return {f for f in os.listdir(SCRIPTS) if f.endswith(".py")}


class TestPackingList(unittest.TestCase):
    def test_gate_passes_on_the_real_repo(self):
        problems = pm.check()
        self.assertEqual(problems, [], "packaging gate found problems:\n" + "\n".join(problems))

    def test_declared_list_equals_the_derived_closure(self):
        self.assertEqual(pm.derive_closure(), set(pm.RUNTIME_SCRIPTS))

    def test_every_declared_script_exists_on_disk(self):
        for script in pm.RUNTIME_SCRIPTS:
            self.assertTrue((SCRIPTS / script).exists(), f"{script} is declared but absent")

    def test_runtime_and_build_only_are_disjoint(self):
        self.assertEqual(pm.RUNTIME_SCRIPTS & pm.BUILD_ONLY, frozenset())

    def test_every_script_has_a_shipping_decision(self):
        unclassified = scripts_on_disk() - set(pm.RUNTIME_SCRIPTS) - set(pm.BUILD_ONLY)
        self.assertEqual(unclassified, set(), f"scripts with no ship decision: {sorted(unclassified)}")


class TestClosureDerivation(unittest.TestCase):
    def test_indirect_dependencies_are_reached(self):
        """companion_config.py is named by no command — only the resolver imports it."""
        self.assertNotIn("companion_config.py", pm.direct_refs())
        self.assertIn("companion_config.py", pm.derive_closure())

    def test_the_previously_missing_scripts_are_in_the_closure(self):
        for script in (
            "resolve-spec-paths.py",
            "companion_config.py",
            "register-capability.py",
            "drift.py",
            "check-coverage.py",
        ):
            self.assertIn(script, pm.derive_closure())

    def test_build_only_scripts_stay_out_of_the_closure(self):
        self.assertEqual(pm.derive_closure() & set(pm.BUILD_ONLY), set())

    def test_every_script_a_command_names_actually_exists(self):
        missing = pm.direct_refs() - scripts_on_disk()
        self.assertEqual(missing, set(), f"commands call scripts that do not exist: {sorted(missing)}")

    def test_stdlib_imports_are_not_mistaken_for_siblings(self):
        deps = pm.sibling_deps("write-context.py", scripts_on_disk())
        self.assertNotIn("os.py", deps)
        self.assertNotIn("json.py", deps)


class TestGateFailsOnDrift(unittest.TestCase):
    """Each case simulates one real regression and asserts check() names it."""

    def assertProblem(self, problems: list[str], needle: str):
        self.assertTrue(
            any(needle in p for p in problems),
            f"expected a problem matching {needle!r}, got: {problems}",
        )

    def test_a_reachable_script_left_out_of_the_list_fails(self):
        short = frozenset(pm.RUNTIME_SCRIPTS - {"companion_config.py"})
        with mock.patch.object(pm, "RUNTIME_SCRIPTS", short):
            self.assertProblem(pm.check(), "needed but not packaged: companion_config.py")

    def test_a_packaged_script_nothing_reaches_fails(self):
        padded = frozenset(pm.RUNTIME_SCRIPTS | {"capture-golden.py"})
        with mock.patch.object(pm, "RUNTIME_SCRIPTS", padded):
            self.assertProblem(pm.check(), "packaged but unreachable: capture-golden.py")

    def test_a_declared_script_that_does_not_exist_fails(self):
        padded = frozenset(pm.RUNTIME_SCRIPTS | {"ghost.py"})
        with mock.patch.object(pm, "RUNTIME_SCRIPTS", padded):
            self.assertProblem(pm.check(), "declared but absent: ghost.py")

    def test_a_new_script_with_no_shipping_decision_fails(self):
        with mock.patch.object(pm, "BUILD_ONLY", frozenset(pm.BUILD_ONLY - {"capture-golden.py"})):
            self.assertProblem(pm.check(), "unclassified: capture-golden.py")

    def test_a_command_calling_a_script_that_does_not_exist_fails(self):
        refs = pm.direct_refs() | {"ghost.py"}
        with mock.patch.object(pm, "direct_refs", lambda: refs):
            self.assertProblem(pm.check(), "referenced but missing: ghost.py")

    def test_a_command_file_the_manifest_declares_but_disk_lacks_fails(self):
        declared = pm.declared_command_files() + [str(SCRIPTS.parent / "commands" / "gone.md")]
        with mock.patch.object(pm, "declared_command_files", lambda: declared):
            self.assertProblem(pm.check(), "command file absent: commands/gone.md")

    def test_copy_to_refuses_to_build_from_a_failing_list(self):
        short = frozenset(pm.RUNTIME_SCRIPTS - {"companion_config.py"})
        with tempfile.TemporaryDirectory() as tmp:
            dest = os.path.join(tmp, "scripts")
            with mock.patch.object(pm, "RUNTIME_SCRIPTS", short):
                self.assertEqual(pm._copy_to(dest), 1)
            self.assertFalse(os.path.exists(dest), "a failing list must not produce an archive")

    def test_copy_to_fills_the_archive_from_the_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = os.path.join(tmp, "scripts")
            self.assertEqual(pm._copy_to(dest), 0)
            self.assertEqual(set(os.listdir(dest)), set(pm.RUNTIME_SCRIPTS))


if __name__ == "__main__":
    unittest.main()
