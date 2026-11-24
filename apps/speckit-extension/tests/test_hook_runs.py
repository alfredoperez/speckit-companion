"""Each rendered hook asks for its record, and the writer keeps it in hookRuns[] without touching history."""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
WRITER = SCRIPTS / "write-context.py"
sys.path.insert(0, str(SCRIPTS))

import hook_render  # noqa: E402

BODY = "<!-- speckit-companion:node finalize -->\nwork\n<!-- /speckit-companion:node finalize -->\n"


def entry(kind, when="after", index=0, **hook):
    return {"when": when, "anchor": "finalize", "index": index, "hook": {"type": kind, **hook}}


class EveryHookAsksForItsRecord(unittest.TestCase):
    def flag_in(self, rendered):
        found = re.search(r"--hook-outcome '([^']+)=ran'", rendered)
        self.assertIsNotNone(found, rendered)
        return found.group(1)

    def test_each_type_ends_with_one_record_line_naming_the_hook(self):
        cases = [
            (entry("skill", ref="house-check"), "specify/after/finalize/0/skill:house-check"),
            (entry("prompt", when="before", index=2, text="look first"), "specify/before/finalize/2/prompt"),
            (entry("command", run="make lint"), "specify/after/finalize/0/command"),
        ]
        for hook, address in cases:
            out = hook_render.insert_hooks(BODY, [hook], command="specify")
            self.assertEqual(self.flag_in(out), address)
            self.assertEqual(out.count("--hook-outcome"), 1)
            block = out.split("<!-- speckit-companion:hook")[1]
            last = block.split("<!-- /speckit-companion:hook")[0].strip().splitlines()[-1]
            self.assertIn("--hook-outcome", last, "the record line closes the hook block")

    def test_a_node_hook_names_its_node(self):
        with tempfile.TemporaryDirectory() as nodes:
            Path(nodes, "extra.md").write_text("---\nid: extra\n---\nDo extra.\n", encoding="utf-8")
            out = hook_render.insert_hooks(BODY, [entry("node", ref="extra")], nodes_dir=nodes,
                                           command="plan")
        self.assertEqual(self.flag_in(out), "plan/after/finalize/0/node:extra")

    def test_the_line_is_short(self):
        line = hook_render.record_line(entry("skill", ref="house-check"), "specify")
        self.assertLessEqual(len(line.split()), 30)


class TheWriterKeepsTheRecord(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)
        (self.root / ".specify").mkdir()
        (self.root / ".specify" / "feature.json").write_text(
            json.dumps({"feature_directory": "specs/001-x"}), encoding="utf-8")
        self.write("--step", "specify", "--kind", "start", "--status", "specifying")

    def write(self, *args):
        return subprocess.run([sys.executable, str(WRITER), *args], cwd=self.root,
                              capture_output=True, text=True)

    def ctx(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    def test_a_record_alone_lands_and_adds_no_history_row(self):
        before = self.ctx()["history"]
        done = self.write("--hook-outcome", "specify/after/finalize/0/skill:house-check=ran")
        self.assertEqual(done.returncode, 0, done.stderr)
        ctx = self.ctx()
        self.assertEqual(ctx["history"], before)
        [run] = ctx["hookRuns"]
        self.assertEqual(
            {k: run[k] for k in ("step", "when", "anchor", "index", "type", "ref", "outcome", "by")},
            {"step": "specify", "when": "after", "anchor": "finalize", "index": 0,
             "type": "skill", "ref": "house-check", "outcome": "ran", "by": "ai"})
        self.assertTrue(run["at"].endswith("Z"))

    def test_a_record_alone_lands_on_a_spec_past_specify(self):
        self.write("--step", "specify", "--advance", "--by", "ai")
        done = self.write("--hook-outcome", "plan/before/plan-doc/0/node:debug-timing=ran")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(len(self.ctx()["hookRuns"]), 1)

    def test_a_skip_keeps_its_reason_on_one_line(self):
        self.write("--hook-outcome", "specify/before/draft-spec/1/prompt=skipped: not\nneeded here")
        [run] = self.ctx()["hookRuns"]
        self.assertEqual(run["outcome"], "skipped")
        self.assertEqual(run["reason"], "not needed here")
        self.assertEqual(run["ref"], "")

    def test_it_rides_on_a_step_close_and_the_close_still_lands(self):
        done = self.write("--step", "specify", "--advance", "--by", "ai",
                          "--hook-outcome", "specify/after/handoff/0/prompt=ran")
        self.assertEqual(done.returncode, 0, done.stderr)
        ctx = self.ctx()
        self.assertEqual(ctx["status"], "specified")
        self.assertEqual(len(ctx["hookRuns"]), 1)

    def test_it_rides_on_a_batch_and_the_batch_still_lands(self):
        done = self.write("--batch", '{"context": ["area: x"]}',
                          "--hook-outcome", "specify/after/finalize/0/skill:a=ran")
        self.assertEqual(done.returncode, 0, done.stderr)
        ctx = self.ctx()
        self.assertEqual(ctx["context"], ["area: x"])
        self.assertEqual(len(ctx["hookRuns"]), 1)

    def test_records_only_grow(self):
        self.write("--hook-outcome", "specify/after/finalize/0/skill:a=ran")
        self.write("--hook-outcome", "specify/after/finalize/0/skill:a=skipped: second run")
        runs = self.ctx()["hookRuns"]
        self.assertEqual([r["outcome"] for r in runs], ["ran", "skipped"])

    def test_a_bad_record_writes_nothing_and_the_other_work_still_happens(self):
        for bad in ("specify/after/finalize/0/skill:a=maybe",
                    "specify/after/finalize/0/shell=ran",
                    "specify/finalize/ran"):
            alone = self.write("--hook-outcome", bad)
            self.assertNotEqual(alone.returncode, 0)
            self.assertIn("not recording hook outcome", alone.stderr)
        riding = self.write("--set", "intent=x", "--hook-outcome", "nope=ran")
        self.assertEqual(riding.returncode, 0)
        ctx = self.ctx()
        self.assertNotIn("hookRuns", ctx)
        self.assertEqual(ctx["intent"], "x")

    def test_set_cannot_replace_the_records(self):
        self.write("--hook-outcome", "specify/after/finalize/0/skill:a=ran")
        self.write("--set", "hookRuns=[]")
        self.assertEqual(len(self.ctx()["hookRuns"]), 1)


if __name__ == "__main__":
    unittest.main()
