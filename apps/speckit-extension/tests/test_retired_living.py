#!/usr/bin/env python3
"""A project that still carries living specs leftovers keeps working, and the doctor says so once."""

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import companion_config  # noqa: E402

RETIRED = "livingSpecs is retired; safe to delete"


def run(script, *args, cwd):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args], cwd=cwd,
                          capture_output=True, text=True)


def make_project(tmp: Path, config=True, constitution=None):
    subprocess.run(["git", "init", "-q"], cwd=tmp, check=True)
    (tmp / ".specify" / "memory").mkdir(parents=True)
    if config:
        (tmp / ".specify" / "companion.yml").write_text(
            "livingSpecs:\n  enabled: true\n  loaded: []\n", encoding="utf-8")
    if constitution:
        (tmp / ".specify" / "memory" / "constitution.md").write_text(constitution, encoding="utf-8")
    feature = tmp / "specs" / "001-a"
    feature.mkdir(parents=True)
    (feature / "spec.md").write_text("# a\n", encoding="utf-8")
    return feature


def digest(path: Path):
    return {str(p.relative_to(path)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(path.rglob("*")) if p.is_file()}


class LeftoverTests(unittest.TestCase):
    def test_leftovers_are_ignored_and_untouched_by_the_writer(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            feature = make_project(tmp)
            caps = tmp / "capabilities"
            caps.mkdir()
            (caps / "x.spec.md").write_text("# x\n", encoding="utf-8")
            (feature / ".spec-context.json").write_text(json.dumps({
                "livingSpecs": {"loaded": ["x"], "synced": ["x"]}}), encoding="utf-8")
            before = digest(caps)

            r = run("write-context.py", "--feature-dir", str(feature), "--set", "intent=x", cwd=tmp)
            self.assertEqual(r.returncode, 0, r.stderr)
            r = run("write-context.py", "--feature-dir", str(feature), "--step", "specify",
                    "--kind", "start", "--by", "ai", cwd=tmp)
            self.assertEqual(r.returncode, 0, r.stderr)

            record = json.loads((feature / ".spec-context.json").read_text(encoding="utf-8"))
            self.assertEqual(record["livingSpecs"], {"loaded": ["x"], "synced": ["x"]})
            self.assertEqual(digest(caps), before)

    def test_the_config_loads_without_a_warning(self):
        with tempfile.TemporaryDirectory() as d:
            make_project(Path(d))
            cfg, warnings = companion_config.load_config(str(Path(d) / ".specify" / "companion.yml"))
            self.assertEqual(warnings, [])
            self.assertIn("livingSpecs", cfg)


class DoctorNotesTests(unittest.TestCase):
    def doctor(self, tmp, feature):
        r = run("doctor.py", "--feature-dir", str(feature), cwd=tmp)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def test_a_leftover_block_is_named_exactly_once(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            out = self.doctor(tmp, make_project(tmp))
            self.assertEqual(out.count(RETIRED), 1, out)

    def test_a_constitution_naming_living_specs_gets_the_persistence_note(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            feature = make_project(tmp, config=False, constitution="Fold-back keeps Living Specs current.\n")
            out = self.doctor(tmp, feature)
            self.assertIn("flow-forward", out)
            self.assertIn("#how-companion-keeps-specs", out)
            self.assertNotIn(RETIRED, out)

    def test_a_clean_project_sees_neither(self):
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            feature = make_project(tmp, config=False, constitution="Write tests first.\n")
            out = self.doctor(tmp, feature)
            self.assertNotIn(RETIRED, out)
            self.assertNotIn("flow-forward", out)


if __name__ == "__main__":
    unittest.main()
