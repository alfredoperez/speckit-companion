#!/usr/bin/env python3
"""The amend command edits a spec in place, records it, and is declared everywhere a command must be."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
ROOT = EXT.parent.parent
BODY = (EXT / "commands" / "speckit.companion.amend.md").read_text(encoding="utf-8")
NAME = "speckit.companion.amend"


class AmendBody(unittest.TestCase):
    def test_edits_in_place_and_never_mints(self):
        self.assertIn("Edit `spec.md` in place", BODY)
        self.assertIn("never mint a folder", BODY)
        self.assertIn("never run `mint-spec-dir`", BODY)

    def test_records_with_amend(self):
        self.assertIn("write-context.py", BODY)
        self.assertIn("--amend", BODY)

    def test_replans_only_when_requirements_change(self):
        self.assertIn("speckit.companion.plan", BODY)
        self.assertIn("speckit.converge", BODY)
        self.assertIn("only when a requirement was added or removed", BODY)
        self.assertIn("wording only", BODY)

    def test_never_writes_status(self):
        self.assertIn("Never write `status` or `currentStep`", BODY)
        self.assertIn("Set status in VS Code", BODY)

    def test_removed_requirement_asks_keep_or_remove(self):
        self.assertIn("keep or remove", BODY)
        self.assertIn("--decision", BODY)
        self.assertIn('"by": "you"', BODY)
        self.assertIn("--concern", BODY)
        self.assertIn("unattended", BODY)


class AmendDeclared(unittest.TestCase):
    def test_extension_yml_matches_body_description(self):
        yml = (EXT / "extension.yml").read_text(encoding="utf-8")
        m = re.search(rf"- name: {re.escape(NAME)}\n\s+file: commands/{re.escape(NAME)}\.md\n\s+description: \"(.*)\"", yml)
        self.assertIsNotNone(m, "amend missing from extension.yml provides.commands")
        fm = re.search(r'^description: "(.*)"$', BODY, re.M)
        self.assertIsNotNone(fm)
        self.assertEqual(m.group(1), fm.group(1))

    def test_registry_lists_it(self):
        reg = json.loads((ROOT / ".specify" / "extensions" / ".registry").read_text(encoding="utf-8"))
        self.assertIn(NAME, reg["extensions"]["companion"]["registered_commands"]["claude"])

    def test_readme_and_commands_doc_list_it(self):
        self.assertIn(f"`/{NAME}`", (EXT / "README.md").read_text(encoding="utf-8"))
        self.assertIn(f"`{NAME}`", (EXT / "docs" / "commands.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
