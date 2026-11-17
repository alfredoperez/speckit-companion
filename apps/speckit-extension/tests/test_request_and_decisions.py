"""The record keeps the request word for word, and each decision says who answered and when."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WRITER = ROOT / "scripts" / "write-context.py"

REQUEST = '  support keeps typing the "same" 3 filters, it\'s $HOME <b>x</b>\n\nno sharing for now  \n'


class RecordTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, *args, stdin=None):
        result = subprocess.run([sys.executable, str(WRITER), "--feature-dir", str(self.spec), *args],
                                cwd=self.root, input=stdin, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def ctx(self):
        return json.loads((self.spec / ".spec-context.json").read_text(encoding="utf-8"))

    def decide(self, **entry):
        self.write("--decision", json.dumps(entry))


class RequestTests(RecordTests):
    def test_stdin_keeps_quotes_dollars_markup_and_line_breaks(self):
        self.write("--request", "-", stdin=REQUEST)
        self.assertEqual(self.ctx()["request"], REQUEST.strip())

    def test_a_file_works_the_same(self):
        path = self.root / "request.txt"
        path.write_text(REQUEST, encoding="utf-8")
        self.write("--request", str(path))
        self.assertEqual(self.ctx()["request"], REQUEST.strip())

    def test_a_stored_request_is_never_replaced(self):
        self.write("--request", "-", stdin="first")
        result = self.write("--request", "-", stdin="a restatement")
        self.assertEqual(self.ctx()["request"], "first")
        self.assertIn("Kept the request already stored", result.stdout)

    def test_a_blank_request_is_not_stored(self):
        self.write("--request", "-", stdin="  \n ")
        path = self.spec / ".spec-context.json"
        self.assertNotIn("request", json.loads(path.read_text(encoding="utf-8")) if path.exists() else {})

    def test_a_missing_file_declines_without_failing(self):
        result = self.write("--request", str(self.root / "nope.txt"))
        self.assertIn("not stored", result.stdout + result.stderr)


class DecisionTests(RecordTests):
    def test_a_decision_is_stamped_with_the_agent_and_a_time(self):
        self.decide(decision="Use the settings table")
        entry = self.ctx()["decisions"][0]
        self.assertEqual(entry["by"], "agent")
        self.assertRegex(entry["at"], r"^\d{4}-\d{2}-\d{2}T")

    def test_a_named_author_and_time_are_kept(self):
        self.decide(decision="Per user", by="you", at="2026-11-03T10:12:00Z")
        entry = self.ctx()["decisions"][0]
        self.assertEqual((entry["by"], entry["at"]), ("you", "2026-11-03T10:12:00Z"))

    def test_reopening_keeps_every_earlier_answer_oldest_first(self):
        self.decide(decision="A new table", id="store", at="2026-11-03T09:00:00Z")
        self.decide(decision="The settings table", id="store", by="you", at="2026-11-03T10:00:00Z")
        self.decide(decision="A cache", id="store", at="2026-11-03T11:00:00Z")
        decisions = self.ctx()["decisions"]
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["decision"], "A cache")
        self.assertEqual([e["decision"] for e in decisions[0]["earlier"]], ["A new table", "The settings table"])
        self.assertEqual(decisions[0]["earlier"][1]["by"], "you")

    def test_the_same_answer_under_the_same_id_adds_nothing(self):
        self.decide(decision="Per user", id="scope", at="2026-11-03T09:00:00Z")
        self.decide(decision="Per user", id="scope")
        decisions = self.ctx()["decisions"]
        self.assertEqual(len(decisions), 1)
        self.assertNotIn("earlier", decisions[0])
        self.assertEqual(decisions[0]["at"], "2026-11-03T09:00:00Z")

    def test_a_reopened_decision_keeps_its_place(self):
        self.decide(decision="First", id="a")
        self.decide(decision="Second", id="b")
        self.decide(decision="First, revised", id="a")
        self.assertEqual([d["decision"] for d in self.ctx()["decisions"]], ["First, revised", "Second"])

    def test_two_ids_with_the_same_answer_are_both_kept(self):
        self.decide(decision="Yes", id="q1")
        self.decide(decision="Yes", id="q2")
        self.decide(decision="No", id="q2")
        decisions = self.ctx()["decisions"]
        self.assertEqual([(d["id"], d["decision"]) for d in decisions], [("q1", "Yes"), ("q2", "No")])
        self.assertEqual(decisions[1]["earlier"][0]["decision"], "Yes")

    def test_an_unreadable_time_is_replaced_with_the_write_time(self):
        self.decide(decision="Per user", at="yesterday")
        self.decide(decision="Per team", at="2026-11-03")
        for entry in self.ctx()["decisions"]:
            self.assertRegex(entry["at"], r"^\d{4}-\d{2}-\d{2}T")

    def test_request_cannot_be_overwritten_through_set(self):
        self.write("--request", "-", stdin="first")
        self.write("--set", "request=replacement")
        self.assertEqual(self.ctx()["request"], "first")

    def test_without_an_id_the_text_still_de_dups(self):
        self.decide(decision="Per user")
        self.decide(decision="Per user")
        self.assertEqual(len(self.ctx()["decisions"]), 1)

    def test_a_caller_cannot_write_its_own_earlier_answers(self):
        self.decide(decision="Per user", earlier=[{"decision": "invented"}])
        self.assertNotIn("earlier", self.ctx()["decisions"][0])

    def test_the_batch_goes_through_the_same_writer(self):
        self.write("--batch", json.dumps({"decisions": [{"decision": "A", "id": "x"}]}))
        self.write("--batch", json.dumps({"decisions": [{"decision": "B", "id": "x"}]}))
        entry = self.ctx()["decisions"][0]
        self.assertEqual((entry["decision"], entry["earlier"][0]["decision"]), ("B", "A"))
        self.assertEqual(entry["by"], "agent")


if __name__ == "__main__":
    unittest.main()
