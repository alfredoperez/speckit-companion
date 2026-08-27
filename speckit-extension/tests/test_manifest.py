#!/usr/bin/env python3
"""The artifact manifest (R003) and the report when a declaration goes unmet (R004).

`writes:` sat in six nodes' frontmatter and no code read it — documentation
shaped like data. A build could not say what it was going to produce, so a run
could not be held against it, so a step that quietly stopped writing its document
looked exactly like one that wrote it.

Stdlib `unittest` only.
"""
from __future__ import annotations

import importlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
SCRIPTS = EXT / "scripts"
sys.path.insert(0, str(SCRIPTS))

manifest_mod = importlib.import_module("manifest")
assemble = importlib.import_module("assemble-nodes")


class TheManifestDescribesTheAssembledPipeline(unittest.TestCase):
    def setUp(self):
        self.manifest = manifest_mod.build()

    def test_every_declared_artifact_is_attributed_to_a_node(self):
        for command, entries in self.manifest["commands"].items():
            for entry in entries:
                self.assertTrue(entry["artifact"], f"{command} declares an unnamed artifact")
                self.assertTrue(entry["node"], f"{command} declares an unattributed artifact")

    def test_it_only_names_nodes_that_are_actually_in_the_order(self):
        # Derived from the assembled order, so it cannot describe a pipeline
        # other than the one that was built.
        for command, entries in self.manifest["commands"].items():
            order = set(assemble.default_order(command))
            for entry in entries:
                self.assertIn(entry["node"], order,
                              f"{command} attributes an artifact to a node it does not run")

    def test_the_author_nodes_declarations_are_all_present(self):
        specify = manifest_mod.artifacts_for(self.manifest, "specify")
        self.assertIn("spec.md", specify)
        self.assertIn("checklists/requirements.md", specify)
        self.assertIn("plan.md", manifest_mod.artifacts_for(self.manifest, "plan"))
        self.assertIn("tasks.md", manifest_mod.artifacts_for(self.manifest, "tasks"))

    def test_a_recipe_that_drops_a_node_drops_its_artifact(self):
        # What makes the manifest worth deriving: a project's order decides what
        # the pipeline produces, so the manifest has to follow the order.
        full = assemble.default_order("specify")
        without = [n for n in full if n != "quality-checklist"]
        trimmed = manifest_mod.build(orders={"specify": without})
        self.assertNotIn("checklists/requirements.md",
                         manifest_mod.artifacts_for(trimmed, "specify"))
        self.assertIn("spec.md", manifest_mod.artifacts_for(trimmed, "specify"))


class AnUnmetDeclarationIsReported(unittest.TestCase):
    def test_a_missing_artifact_is_named_with_the_node_that_promised_it(self):
        manifest = manifest_mod.build()
        with tempfile.TemporaryDirectory() as empty:
            missing = manifest_mod.unproduced(manifest, "specify", empty)
        names = {m["artifact"] for m in missing}
        self.assertIn("spec.md", names)
        report = manifest_mod.render_unproduced("specify", missing)
        self.assertIn("draft-spec", report)
        self.assertIn("did not produce", report)

    def test_nothing_is_reported_when_every_artifact_is_there(self):
        manifest = manifest_mod.build()
        with tempfile.TemporaryDirectory() as produced:
            root = Path(produced)
            (root / "spec.md").write_text("x", encoding="utf-8")
            (root / "checklists").mkdir()
            (root / "checklists" / "requirements.md").write_text("x", encoding="utf-8")
            self.assertEqual(manifest_mod.unproduced(manifest, "specify", str(root)), [])

    def test_the_cli_exits_non_zero_only_when_something_is_missing(self):
        with tempfile.TemporaryDirectory() as empty:
            failed = subprocess.run(
                [sys.executable, str(SCRIPTS / "manifest.py"), "--verify", "plan",
                 "--feature-dir", empty],
                capture_output=True, text=True,
            )
        self.assertEqual(failed.returncode, 1)
        self.assertIn("plan-doc", failed.stdout)

        with tempfile.TemporaryDirectory() as produced:
            (Path(produced) / "plan.md").write_text("x", encoding="utf-8")
            passed = subprocess.run(
                [sys.executable, str(SCRIPTS / "manifest.py"), "--verify", "plan",
                 "--feature-dir", produced],
                capture_output=True, text=True,
            )
        self.assertEqual(passed.returncode, 0, passed.stdout + passed.stderr)


class AssemblyEmitsIt(unittest.TestCase):
    def test_building_writes_a_manifest_beside_the_commands(self):
        self.assertTrue(Path(manifest_mod.MANIFEST_PATH).is_file(),
                        "assembly did not leave a manifest")
        with open(manifest_mod.MANIFEST_PATH, encoding="utf-8") as fh:
            written = json.load(fh)
        self.assertEqual(written["commands"], manifest_mod.build()["commands"])

    def test_the_check_run_reports_the_manifest_without_writing_it(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "assemble-nodes.py"), "--check"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("a run of this pipeline writes:", result.stdout)


if __name__ == "__main__":
    unittest.main()
