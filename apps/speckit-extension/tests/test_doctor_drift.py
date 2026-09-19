#!/usr/bin/env python3
"""The drift audit: recompute, classify, and catch a claim that contradicts it.

The classifiers are exercised against real git repositories built in a temp
directory, because every false-alarm shape this feature exists to name — a wrong
baseline, a rename, the companion's own writes — is decidable only from git.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import doctor_drift as dd  # noqa: E402


def git(root, *args):
    return subprocess.run(["git", "-C", str(root), *args],
                          capture_output=True, text=True, check=False)


class _Repo:
    """A throwaway git repository with a deterministic identity."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        git(self.path, "init", "-q", "-b", "main")
        git(self.path, "config", "user.email", "t@example.com")
        git(self.path, "config", "user.name", "T")

    def commit(self, name, body, message):
        f = self.path / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(body, encoding="utf-8")
        git(self.path, "add", "-A")
        git(self.path, "commit", "-q", "-m", message)
        return git(self.path, "rev-parse", "HEAD").stdout.strip()

    def cleanup(self):
        self.tmp.cleanup()


class ClassificationTests(unittest.TestCase):
    def setUp(self):
        self.repo = _Repo()

    def tearDown(self):
        self.repo.cleanup()

    def test_real_drift_names_its_files_and_commits(self):
        base = self.repo.commit("capabilities/x/spec.md", "# X\n", "add spec")
        self.repo.commit("src/x.py", "print(1)\n", "change the behavior")
        flag = dd.classify(self.repo.path, {
            "name": "x", "commit": base, "drifted": [{"file": "src/x.py", "severity": "unspeced"}],
        })
        self.assertEqual(flag["class"], dd.CLASS_REAL)
        self.assertEqual(flag["files"], ["src/x.py"])
        self.assertEqual([c["subject"] for c in flag["commits"]], ["change the behavior"])

    def test_the_companions_own_writes_are_self_inflicted_not_real_drift(self):
        base = self.repo.commit("capabilities/x/spec.md", "# X\n", "add spec")
        flag = dd.classify(self.repo.path, {
            "name": "x", "commit": base,
            "drifted": [{"file": "specs/001-a/.spec-context.json", "severity": "tracked"},
                        {"file": "specs/001-a/.trace.jsonl", "severity": "tracked"}],
        })
        self.assertEqual(flag["class"], dd.CLASS_SELF)
        self.assertIn("companion writes", flag["reason"])

    def test_a_baseline_that_is_not_an_ancestor_is_a_suspect_baseline(self):
        base = self.repo.commit("capabilities/x/spec.md", "# X\n", "add spec")
        git(self.repo.path, "checkout", "-q", "-b", "side")
        stray = self.repo.commit("other.md", "stray\n", "a commit HEAD never sees")
        git(self.repo.path, "checkout", "-q", "main")
        self.repo.commit("src/x.py", "print(1)\n", "change")
        flag = dd.classify(self.repo.path, {
            "name": "x", "commit": stray, "drifted": [{"file": "src/x.py", "severity": "unspeced"}],
        })
        self.assertEqual(flag["class"], dd.CLASS_BASELINE)
        self.assertIn("not an ancestor of HEAD", flag["reason"])
        self.assertNotEqual(base, stray)

    def test_a_pure_rename_is_a_suspect_baseline_not_real_drift(self):
        base = self.repo.commit("src/old.py", "print('same body, same file')\n", "add source")
        git(self.repo.path, "mv", "src/old.py", "src/new.py")
        git(self.repo.path, "commit", "-q", "-m", "rename only")
        flag = dd.classify(self.repo.path, {
            "name": "x", "commit": base, "drifted": [{"file": "src/new.py", "severity": "unspeced"}],
        })
        self.assertEqual(flag["class"], dd.CLASS_BASELINE)
        self.assertIn("rename", flag["reason"])

    def test_an_unreachable_baseline_is_unknown_never_clean(self):
        self.repo.commit("capabilities/x/spec.md", "# X\n", "add spec")
        flag = dd.classify(self.repo.path, {
            "name": "x", "commit": "0" * 40,
            "drifted": [{"file": "src/x.py", "severity": "unspeced"}],
        })
        self.assertEqual(flag["class"], dd.CLASS_UNKNOWN)
        self.assertIn("unreachable", flag["reason"])


class FalseClaimTests(unittest.TestCase):
    """A claim is compared against the recomputation, never trusted in place of it."""

    def setUp(self):
        self.repo = _Repo()
        self.base = self.repo.commit("capabilities/x/spec.md", "# X\n", "add spec")
        self.repo.commit("src/x.py", "print(1)\n", "change the behavior")
        self.result = {
            "enabled": True, "checked": 1, "skipped": [],
            "capabilities": [{"name": "x", "spec": "capabilities/x/spec.md",
                              "commit": self.base, "inSync": False,
                              "drifted": [{"file": "src/x.py", "severity": "unspeced"}]}],
        }

    def tearDown(self):
        self.repo.cleanup()

    def run_audit(self, ctx):
        original = dd.recompute
        dd.recompute = lambda _root: self.result
        try:
            return dd.check_drift(self.repo.path, self.repo.path, ctx)
        finally:
            dd.recompute = original

    def test_a_drift_clean_claim_contradicted_by_recomputation_is_reported(self):
        ctx = {"verified": [{"what": "living specs are in sync — no drift",
                             "result": "pass", "at": "2026-08-01T12:00:00Z"}]}
        _status, findings = self.run_audit(ctx)
        false_claims = [f for f in findings if "contradicts the recomputation" in f.title]
        self.assertEqual(len(false_claims), 1)
        self.assertEqual(false_claims[0].severity, "problem")
        self.assertIn("x", false_claims[0].detail)

    def test_a_string_form_claim_is_read_the_same_as_an_entry_form_one(self):
        ctx = {"verified": ["living specs are in sync — no drift"]}
        _status, findings = self.run_audit(ctx)
        false_claims = [f for f in findings if "contradicts the recomputation" in f.title]
        self.assertEqual(len(false_claims), 1)
        self.assertEqual(false_claims[0].severity, "problem")

    def test_an_entry_with_no_usable_identity_cannot_become_a_false_claim(self):
        # A nested list stringified to "['no drift']", matched the clean-claim
        # pattern, and accused the run of a claim it never made.
        ctx = {"verified": [
            ["no drift"],                       # not an entry at all
            {"nested": ["drift", "clean"]},     # no identity key
            {"what": ["no drift"]},             # identity present but not text
        ]}
        _status, findings = self.run_audit(ctx)
        self.assertEqual([f for f in findings if "contradicts" in f.title], [],
                         "an entry with no identity value must be skipped, not stringified")

    def test_the_shape_the_pipeline_actually_records_is_detected(self):
        # The implement command tells every run to record
        # {"what": "<check>", "command": "<cmd>", "result": "<outcome>"} — the
        # topic in `what`, the verdict in `result`. Scanning `what` alone made
        # the check silent on exactly the shape real runs write.
        ctx = {"verified": [{"what": "living-spec drift check",
                             "command": "drift.py",
                             "result": "in sync — no drift"}]}
        _status, findings = self.run_audit(ctx)
        hit = [f for f in findings if "contradicts the recomputation" in f.title]
        self.assertEqual(len(hit), 1, "a real drift-clean claim must still be caught")

    def test_no_claim_means_no_false_claim_finding(self):
        _status, findings = self.run_audit({})
        self.assertEqual([f for f in findings if "contradicts" in f.title], [])

    def test_the_flag_itself_is_still_reported_with_its_evidence(self):
        _status, findings = self.run_audit({})
        real = [f for f in findings if f.evidence.get("class") == dd.CLASS_REAL]
        self.assertEqual(len(real), 1)
        self.assertEqual(real[0].evidence["files"], ["src/x.py"])
        self.assertIn("change the behavior", real[0].detail)

    def test_a_skipped_capability_is_carried_through_as_unknown(self):
        self.result = {"enabled": True, "checked": 0, "capabilities": [],
                       "skipped": [{"name": "y", "reason": "spec history unreachable (shallow clone)"}]}
        _status, findings = self.run_audit({})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].evidence["class"], dd.CLASS_UNKNOWN)
        self.assertIn("shallow", findings[0].detail)

    def test_living_specs_disabled_is_not_applicable_not_clean(self):
        self.result = {"enabled": False, "checked": 0, "capabilities": [], "skipped": []}
        status, findings = self.run_audit({})
        self.assertEqual(status.state, "not-applicable")
        self.assertEqual(findings, [])

    def test_an_unreadable_recomputation_is_a_skip_with_a_reason(self):
        original = dd.recompute
        dd.recompute = lambda _root: None
        try:
            status, findings = dd.check_drift(self.repo.path, self.repo.path, {})
        finally:
            dd.recompute = original
        self.assertEqual(status.state, "skipped")
        self.assertTrue(status.reason)


class GroundTruthTests(unittest.TestCase):
    def test_the_audit_runs_the_real_drift_script_rather_than_reimplementing_it(self):
        result = dd.recompute(ROOT.parent)
        self.assertIsNotNone(result, "drift.py must be invocable as the ground truth")
        self.assertIn("capabilities", result)
        self.assertIn("checked", result)


if __name__ == "__main__":
    unittest.main()


class DeclaredSkipIsNotRealDrift(unittest.TestCase):
    """A capability the run deliberately skipped, with a written reason, is `declared`.

    Classifying it `real` — the strongest verdict — made a written-down decision
    render identically to an oversight at the one place the difference is checked.
    """

    CAP = {"name": "spec-viewer", "commit": "abc1234",
           "drifted": [{"file": "src/features/spec-viewer/footerActions.ts"}]}

    def test_a_recorded_skip_downgrades_the_flag_and_carries_its_reason(self):
        ctx = {"livingSpecs": {"skipped": [
            {"name": "spec-viewer", "reason": "only swapped its private resolver for the shared one"},
        ]}}
        flag = dd.classify(None, self.CAP, ctx)
        self.assertEqual(flag["class"], dd.CLASS_DECLARED)
        self.assertIn("only swapped its private resolver", flag["reason"])

    def test_a_skip_for_another_capability_does_not_cover_this_one(self):
        ctx = {"livingSpecs": {"skipped": [{"name": "specs", "reason": "unrelated"}]}}
        self.assertNotEqual(dd.classify(None, self.CAP, ctx)["class"], dd.CLASS_DECLARED)

    def test_no_record_at_all_classifies_as_before(self):
        self.assertNotEqual(dd.classify(None, self.CAP, {})["class"], dd.CLASS_DECLARED)
        self.assertNotEqual(dd.classify(None, self.CAP, None)["class"], dd.CLASS_DECLARED)
