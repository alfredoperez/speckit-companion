"""The doctor names each agent's layout, an agent missing Companion, and a CLI missing from PATH."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor_checks as dc  # noqa: E402


class AgentLayout(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        (self.root / ".specify" / "extensions" / "companion").mkdir(parents=True)

    def agent(self, key, stock, companion=None):
        manifests = self.root / ".specify" / "integrations"
        manifests.mkdir(parents=True, exist_ok=True)
        (manifests / f"{key}.manifest.json").write_text(
            json.dumps({"integration": key, "files": {stock: "sha"}}), encoding="utf-8")
        for rel in (stock, companion):
            if rel:
                (self.root / rel).parent.mkdir(parents=True, exist_ok=True)
                (self.root / rel).write_text("", encoding="utf-8")

    def installed(self, *keys):
        (self.root / ".specify" / "integration.json").write_text(
            json.dumps({"installed_integrations": list(keys)}), encoding="utf-8")

    def findings(self):
        dc._AGENTS_REPORTED.clear()
        with mock.patch("shutil.which", return_value="/usr/bin/specify"):
            _, found = dc.check_agents(self.root)
        return found

    def test_it_names_the_agent_missing_companion_in_a_two_agent_project(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md", ".claude/skills/speckit-companion-specify/SKILL.md")
        self.agent("copilot", ".github/prompts/speckit.specify.prompt.md")
        self.installed("claude", "copilot")
        warnings = [f for f in self.findings() if f.severity == "warning"]
        self.assertEqual([f.title for f in warnings], ["Companion is not installed for copilot in .github/prompts"])
        self.assertIn("specify integration use copilot", warnings[0].detail)

    def test_it_says_skills_or_commands_for_each_agent(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md", ".claude/skills/speckit-companion-specify/SKILL.md")
        self.agent("copilot", ".github/prompts/speckit.specify.prompt.md", ".github/prompts/speckit.companion.specify.prompt.md")
        self.installed("claude", "copilot")
        [note] = [f for f in self.findings() if f.severity == "note"]
        self.assertEqual(note.detail, "claude: skills in .claude/skills; copilot: commands in .github/prompts")

    def test_a_manifest_an_uninstalled_agent_left_behind_is_ignored(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md", ".claude/skills/speckit-companion-specify/SKILL.md")
        self.agent("codex", ".agents/skills/speckit-specify/SKILL.md")
        self.installed("claude")
        self.assertEqual([f for f in self.findings() if f.severity == "warning"], [])

    def test_it_reports_the_cli_missing_from_path(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md", ".claude/skills/speckit-companion-specify/SKILL.md")
        dc._AGENTS_REPORTED.clear()
        with mock.patch("shutil.which", return_value=None):
            _, found = dc.check_agents(self.root)
        self.assertIn("The specify CLI is not on this shell's PATH", [f.title for f in found if f.severity == "note"])

    def test_an_older_record_without_the_installed_list_still_ignores_leftovers(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md", ".claude/skills/speckit-companion-specify/SKILL.md")
        self.agent("codex", ".agents/skills/speckit-specify/SKILL.md")
        (self.root / ".specify" / "integration.json").write_text(json.dumps({"integration": "claude"}), encoding="utf-8")
        self.assertEqual([f for f in self.findings() if f.severity == "warning"], [])

    def test_every_surface_of_an_agent_is_judged(self):
        manifests = self.root / ".specify" / "integrations"
        manifests.mkdir(parents=True)
        (manifests / "copilot.manifest.json").write_text(json.dumps({"integration": "copilot", "files": {
            ".github/agents/speckit.specify.agent.md": "a", ".github/prompts/speckit.specify.prompt.md": "b"}}), encoding="utf-8")
        (self.root / ".github" / "prompts").mkdir(parents=True)
        (self.root / ".github" / "prompts" / "speckit.companion.specify.prompt.md").write_text("", encoding="utf-8")
        self.installed("copilot")
        warnings = [f.title for f in self.findings() if f.severity == "warning"]
        self.assertEqual(warnings, ["Companion is not installed for copilot in .github/agents"])

    def test_an_unreadable_manifest_is_reported_not_skipped(self):
        manifests = self.root / ".specify" / "integrations"
        manifests.mkdir(parents=True)
        (manifests / "claude.manifest.json").write_text("{ broken", encoding="utf-8")
        self.installed("claude")
        self.assertIn("Could not read claude.manifest.json", [f.title for f in self.findings()])

    def test_a_run_over_many_specs_reports_the_project_once(self):
        self.agent("claude", ".claude/skills/speckit-specify/SKILL.md")
        self.installed("claude")
        dc._AGENTS_REPORTED.clear()
        first, _ = dc.check_agents(self.root)
        second, again = dc.check_agents(self.root)
        self.assertEqual((first.state, second.state, again), ("ran", "skipped", []))

    def test_a_project_with_no_integration_has_nothing_to_judge(self):
        dc._AGENTS_REPORTED.clear()
        status, found = dc.check_agents(self.root)
        self.assertEqual((status.state, found), ("not-applicable", []))


if __name__ == "__main__":
    unittest.main()
