#!/usr/bin/env python3
"""Turning living specs on, and choosing where the specs live.

Both were unreachable from the panel: a project could be running living specs or
not, keeping its specs central or beside the code, and the builder drew the same
board either way.

Two things make writing them safe rather than a second writer for a registry
that already has one. The setting goes into whichever file the resolver READS —
the registry at the project root, or the legacy `livingSpecs:` block — because a
setting written into the other one is reported as saved and never read. And only
the key being changed is touched: the capability list, the exempt globs and the
authored rules come through byte-identical, since adoption owns those.

`layout` had always been read and never emitted, so a registry rewrite deleted
whichever layout the project had chosen. It is an owned key now.

Stdlib `unittest` only.
"""
from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(HERE))

import companion_config as cc  # noqa: E402

from builder_harness import Project, Refused  # noqa: E402

REGISTRY = """# Living specs for this project.
enabled: false
exempt: ["**/*.test.*"]
capabilities:
  - name: auth
    match: ["src/auth/**"]
    spec: capabilities/auth/auth.spec.md
rules:
  spec:
    - "Say what the user sees."
"""


class AProjectWithNothingAdopted(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.registry = Path(self.project.root) / cc.LIVING_SPECS_REL

    def living(self):
        return cc.resolve_living_specs(str(self.project.root))

    def test_turning_it_on_writes_the_registry(self):
        self.project.write("--living-enabled", "true")
        self.assertTrue(self.registry.exists())
        living, meta = self.living()
        self.assertTrue(living["enabled"])
        self.assertEqual(meta["origin"], "registry")

    def test_the_layout_is_read_back(self):
        self.project.write("--living-enabled", "true", "--living-layout", "colocated")
        self.assertEqual(self.living()[0]["layout"], "colocated")

    def test_a_layout_that_is_not_one_is_refused(self):
        with self.assertRaises(Refused):
            self.project.write("--living-layout", "sideways")
        self.assertFalse(self.registry.exists())

    def test_the_graph_says_nothing_is_adopted(self):
        living = self.project.graph()["livingSpecs"]
        self.assertEqual(living["origin"], "none")
        self.assertFalse(living["enabled"])
        self.assertEqual(living["capabilities"], [])


class AProjectWithARegistry(unittest.TestCase):
    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.registry = Path(self.project.root) / cc.LIVING_SPECS_REL
        self.registry.write_text(REGISTRY, encoding="utf-8")

    def test_only_the_setting_changes(self):
        self.project.write("--living-enabled", "true", "--living-layout", "colocated")
        text = self.registry.read_text(encoding="utf-8")
        self.assertIn("# Living specs for this project.", text)
        self.assertIn("    spec: capabilities/auth/auth.spec.md", text)
        self.assertIn('    - "Say what the user sees."', text)
        self.assertIn('exempt: ["**/*.test.*"]', text)

    def test_the_header_comment_stays_at_the_top(self):
        """Inserted first, a setting the panel added landed above the file's own words."""
        self.project.write("--living-layout", "colocated")
        first = self.registry.read_text(encoding="utf-8").splitlines()[0]
        self.assertTrue(first.startswith("#"))

    def test_the_registry_is_still_what_the_resolver_reads(self):
        self.project.write("--living-enabled", "true")
        living, meta = cc.resolve_living_specs(str(self.project.root))
        self.assertEqual(meta["origin"], "registry")
        self.assertTrue(living["enabled"])
        self.assertEqual([c["name"] for c in living["capabilities"]], ["auth"])
        self.assertEqual(living["rules"]["spec"], ["Say what the user sees."])

    def test_the_graph_carries_the_registry_to_read(self):
        self.project.write("--living-enabled", "true", "--living-layout", "colocated")
        living = self.project.graph()["livingSpecs"]
        self.assertEqual(living["origin"], "registry")
        self.assertEqual(living["path"], "living-specs.yml")
        self.assertTrue(living["enabled"])
        self.assertEqual(living["layout"], "colocated")
        self.assertEqual([c["name"] for c in living["capabilities"]], ["auth"])
        self.assertEqual(living["exempt"], ["**/*.test.*"])

    def test_a_registry_rewrite_keeps_the_chosen_layout(self):
        """`layout` was read and never emitted, so registering a capability erased it."""
        self.project.write("--living-layout", "colocated")
        done = subprocess.run(
            [sys.executable, str(SCRIPTS / "register-capability.py"),
             "--name", "billing", "--match", "src/billing/**",
             "--root", str(self.project.root)],
            capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        living, _meta = cc.resolve_living_specs(str(self.project.root))
        self.assertEqual(living["layout"], "colocated")
        self.assertEqual([c["name"] for c in living["capabilities"]], ["auth", "billing"])


class AProjectStillOnTheLegacyBlock(unittest.TestCase):
    """The registry wins when it exists; the old block is what answers when it does not."""

    def setUp(self):
        self.project = Project()
        self.addCleanup(self.project.close)
        self.project.set_config(
            "commands:\n"
            "  specify:\n"
            "    nodes: [resolve-dir]\n"
            "\n"
            "livingSpecs:\n"
            "  enabled: true\n"
            "  capabilities:\n"
            "    - name: billing\n"
            "      match: [\"src/billing/**\"]\n"
        )

    def test_the_setting_goes_where_the_resolver_reads_it(self):
        self.project.write("--living-layout", "colocated")
        living, meta = cc.resolve_living_specs(str(self.project.root))
        self.assertEqual(meta["origin"], "legacy")
        self.assertEqual(living["layout"], "colocated")
        self.assertFalse((Path(self.project.root) / cc.LIVING_SPECS_REL).exists())

    def test_the_rest_of_companion_yml_is_untouched(self):
        self.project.write("--living-enabled", "false")
        text = self.project.config_text()
        self.assertIn("    nodes: [resolve-dir]", text)
        self.assertIn("    - name: billing", text)
        self.assertIn("  enabled: false", text)


if __name__ == "__main__":
    unittest.main()
