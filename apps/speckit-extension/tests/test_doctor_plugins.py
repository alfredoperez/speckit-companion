"""The doctor names a plugin the project's nodes call that is behind its marketplace, and never fails on a missing version."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor_checks as dc  # noqa: E402


class PluginFreshness(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        base = Path(tmp.name)
        self.root, self.plugins, self.market = base / "project", base / "plugins", base / "marketplace"
        (self.root / ".specify" / "companion" / "nodes").mkdir(parents=True)
        self.plugins.mkdir()
        (self.market / ".claude-plugin").mkdir(parents=True)
        (self.plugins / "known_marketplaces.json").write_text(
            json.dumps({"tools": {"installLocation": str(self.market)}}), encoding="utf-8")

    def node(self, text):
        (self.root / ".specify" / "companion" / "nodes" / "skills.md").write_text(text, encoding="utf-8")

    def installed(self, **versions):
        (self.plugins / "installed_plugins.json").write_text(json.dumps({"plugins": {
            f"{name.replace('_', '-')}@tools": [{"version": v}] for name, v in versions.items()}}), encoding="utf-8")

    def offered(self, *plugins):
        (self.market / ".claude-plugin" / "marketplace.json").write_text(
            json.dumps({"name": "tools", "plugins": list(plugins)}), encoding="utf-8")

    def findings(self):
        dc._PLUGINS_REPORTED.clear()
        status, found = dc.check_plugins(self.root, self.plugins)
        return status, [(f.severity, f.title) for f in found]

    def test_a_plugin_behind_its_marketplace_names_both_versions(self):
        self.node("Load `angular-plugin:code-skill` and `product-engineering:jira-sync`.")
        self.installed(angular_plugin="3.38.3", product_engineering="2.0.5")
        self.offered({"name": "angular-plugin", "version": "3.38.10"}, {"name": "product-engineering", "version": "2.0.5"})
        self.assertEqual(self.findings()[1],
                         [("warning", "angular-plugin is behind: 3.38.3 installed, 3.38.10 available")])

    def test_the_version_falls_back_to_the_plugins_own_manifest(self):
        self.node("skill: angular-plugin:code-skill")
        self.installed(angular_plugin="3.38.3")
        own = self.market / "plugins" / "angular-plugin" / ".claude-plugin"
        own.mkdir(parents=True)
        (own / "plugin.json").write_text(json.dumps({"version": "3.39.0"}), encoding="utf-8")
        self.offered({"name": "angular-plugin", "source": "./plugins/angular-plugin"})
        self.assertEqual(self.findings()[1][0][0], "warning")

    def test_an_unreadable_version_is_reported_unknown_not_failed(self):
        self.node("Run alfredo-experiments:bench and angular-plugin:code-skill.")
        self.installed(angular_plugin="3.38.3")
        self.offered({"name": "angular-plugin"}, {"name": "alfredo-experiments", "version": "1.0.0"})
        status, found = self.findings()
        self.assertEqual(status.state, "ran")
        self.assertEqual(found, [("note", "alfredo-experiments: version unknown"),
                                 ("note", "angular-plugin: version unknown")])

    def test_nodes_that_name_no_plugin_are_not_applicable(self):
        self.node("No plugin here: just prose.")
        self.installed(angular_plugin="3.38.3")
        self.offered({"name": "angular-plugin", "version": "3.38.3"})
        self.assertEqual(self.findings()[0].state, "not-applicable")

    def test_missing_plugin_files_never_raise(self):
        self.node("angular-plugin:code-skill")
        status, found = dc.check_plugins(self.root, self.plugins / "absent")
        self.assertEqual((status.state, found), ("not-applicable", []))


if __name__ == "__main__":
    unittest.main()
