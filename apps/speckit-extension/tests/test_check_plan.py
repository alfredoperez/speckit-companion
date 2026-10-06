#!/usr/bin/env python3
"""Tests for the plan's call-path check (check_plan.py).

Stdlib `unittest` only — run with:

    python3 -m unittest discover -s apps/speckit-extension/tests -p "test_*.py"
"""

from __future__ import annotations

import importlib
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

EXT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EXT / "scripts"))
cp = importlib.import_module("check_plan")

SERVER = "\n".join(
    ["// header"] * 9
    + ["function settle(at) {", "  reviewRuns();", "}", "", "function reviewRuns() {", "}"]
) + "\n"


def calls(*rows: str, title: str = "The run settles") -> str:
    return "\n".join([f"```calls {title}".rstrip(), *rows, "```"]) + "\n"


class Repo(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "src").mkdir()
        (self.root / "src" / "server.mjs").write_text(SERVER, encoding="utf-8")
        self.spec = self.root / "specs" / "001-x"
        self.spec.mkdir(parents=True)

    def tearDown(self):
        self._tmp.cleanup()

    def check(self, text: str, size: str | None = None) -> dict:
        return cp.check_text(text, "plan.md", self.root, size)

    def rules(self, text: str, size: str | None = None) -> list:
        return [(f["level"], f["rule"]) for f in self.check(text, size)["findings"]]

    def run_main(self, plan: str, *extra: str) -> tuple:
        (self.spec / "plan.md").write_text(plan, encoding="utf-8")
        out = io.StringIO()
        with redirect_stdout(out):
            code = cp.main(["--feature-dir", str(self.spec), "--root", str(self.root), *extra])
        return code, out.getvalue()


GOOD = calls(
    "  settle() @ src/server.mjs:10",
    "~   reviewRuns() @ src/server.mjs:14",
    "+   writeRecord() @ src/server.mjs:12",
    "+     recordStep() **new** @ src/run-record.mjs",
)


class AStockPlanIsUntouched(Repo):
    def test_a_plan_with_no_blocks_prints_nothing_and_exits_0(self):
        code, out = self.run_main("# Plan\n\n```bash\nnpm test\n```\n")
        self.assertEqual((code, out), (0, ""))

    def test_a_calls_fence_shown_inside_another_fence_is_not_read(self):
        self.assertEqual(self.check("````markdown\n" + calls("nonsense") + "````\n")["blocks"], 0)


class AGoodBlock(Repo):
    def test_passes_clean(self):
        report = self.check(GOOD)
        self.assertEqual((report["blocks"], report["lines"], report["findings"]), (1, 4, []))

    def test_says_so_in_one_line(self):
        code, out = self.run_main(GOOD)
        self.assertEqual(code, 0)
        self.assertIn("Every cited file and line checks out", out)

    def test_declares_every_path_for_the_bench(self):
        declared = self.check(GOOD)["declared"]
        self.assertEqual([d["mark"] for d in declared], [" ", "~", "+", "+"])
        self.assertTrue(declared[3]["new"])
        self.assertIsNone(declared[3]["line"])

    def test_json_is_printed_even_with_no_blocks(self):
        code, out = self.run_main("# Plan\n", "--json")
        self.assertEqual((code, json.loads(out)["blocks"]), (0, 0))

    def test_crlf_input_reads_the_same(self):
        self.assertEqual(self.check(GOOD.replace("\n", "\r\n"))["findings"], [])

    def test_a_note_line_under_the_block_is_allowed(self):
        self.assertEqual(self.rules(GOOD + "note: called, not changed.\n"), [])


class Errors(Repo):
    def test_a_cited_file_that_does_not_exist(self):
        self.assertIn(("ERROR", "missing-file"), self.rules(calls("  settle() @ src/nope.mjs:3")))

    def test_a_removed_function_in_a_file_that_does_not_exist(self):
        self.assertIn(("ERROR", "missing-file"),
                      self.rules(calls("  settle() @ src/server.mjs:10", "-   gone() @ src/old.mjs:4")))

    def test_a_line_past_the_end_of_the_file(self):
        self.assertIn(("ERROR", "line-out-of-range"), self.rules(calls("  settle() @ src/server.mjs:99")))

    def test_a_new_file_that_already_exists(self):
        self.assertIn(("ERROR", "new-exists"),
                      self.rules(calls("+ settle() **new** @ src/server.mjs")))

    def test_new_on_a_changed_line(self):
        self.assertIn(("ERROR", "malformed"), self.rules(calls("~ settle() **new** @ src/a.mjs")))

    def test_new_with_a_line(self):
        self.assertIn(("ERROR", "malformed"), self.rules(calls("+ settle() **new** @ src/a.mjs:3")))

    def test_no_marker_column(self):
        self.assertIn(("ERROR", "malformed"), self.rules(calls("settle() @ src/server.mjs:10")))

    def test_no_location(self):
        self.assertIn(("ERROR", "malformed"), self.rules(calls("  settle()")))

    def test_an_odd_indent(self):
        self.assertIn(("ERROR", "malformed"),
                      self.rules(calls("  settle() @ src/server.mjs:10", "~  reviewRuns() @ src/server.mjs:14")))

    def test_a_level_skipped(self):
        self.assertIn(("ERROR", "malformed"),
                      self.rules(calls("  settle() @ src/server.mjs:10", "~     reviewRuns() @ src/server.mjs:14")))

    def test_a_second_entry_point(self):
        self.assertIn(("ERROR", "malformed"),
                      self.rules(calls("  settle() @ src/server.mjs:10", "  reviewRuns() @ src/server.mjs:14")))

    def test_tabs(self):
        self.assertIn(("ERROR", "malformed"),
                      self.rules(calls("  settle() @ src/server.mjs:10", "~ \treviewRuns() @ src/server.mjs:14")))

    def test_a_path_outside_the_repo(self):
        self.assertIn(("ERROR", "malformed"), self.rules(calls("  settle() @ ../secret.txt:1")))

    def test_an_unclosed_or_empty_block(self):
        self.assertIn(("ERROR", "malformed"), self.rules("```calls The run\n  settle() @ src/server.mjs:10\n"))
        self.assertIn(("ERROR", "malformed"), self.rules("```calls The run\n```\n"))

    def test_strict_exits_1_on_an_error_and_plain_exits_0(self):
        bad = calls("  settle() @ src/nope.mjs:3")
        self.assertEqual(self.run_main(bad)[0], 0)
        self.assertEqual(self.run_main(bad, "--strict")[0], 1)


class Warnings(Repo):
    def test_a_symbol_not_near_its_line(self):
        self.assertEqual(self.rules(calls("  recordStep() @ src/server.mjs:1")),
                         [("WARNING", "symbol-not-near")])

    def test_a_new_function_is_not_looked_for(self):
        self.assertEqual(self.rules(calls("+ brandNew() @ src/server.mjs:1")), [])

    def test_a_block_over_twelve_lines(self):
        rows = ["  settle() @ src/server.mjs:10"] + ["    reviewRuns() @ src/server.mjs:14"] * 12
        self.assertIn(("WARNING", "too-long"), self.rules(calls(*rows)))

    def test_more_than_three_blocks(self):
        self.assertIn(("WARNING", "too-many-blocks"), self.rules(GOOD * 4))

    def test_more_than_one_note_line(self):
        self.assertIn(("WARNING", "long-note"), self.rules(GOOD + "note: one.\nnote: two.\n"))

    def test_an_existing_path_with_no_line(self):
        self.assertEqual(self.rules(calls("  settle() @ src/server.mjs")), [("WARNING", "no-line")])

    def test_a_block_with_no_title(self):
        self.assertEqual(self.rules(calls("  settle() @ src/server.mjs:10", title="")),
                         [("WARNING", "no-title")])

    def test_a_block_in_a_simple_spec(self):
        self.assertIn(("WARNING", "simple-size"), self.rules(GOOD, size="simple"))

    def test_the_size_is_read_from_the_spec(self):
        (self.spec / ".spec-context.json").write_text('{"size": "simple"}', encoding="utf-8")
        _code, out = self.run_main(GOOD)
        self.assertIn("simple-size", out)

    def test_warnings_never_fail_strict(self):
        self.assertEqual(self.run_main(calls("  settle() @ src/server.mjs"), "--strict")[0], 0)


class TheProjectCopyIsTheShippedNode(unittest.TestCase):
    def test_this_repos_node_file_matches_the_shipped_part(self):
        repo = EXT.parents[1]
        shipped = (EXT / "presets" / "_parts" / "call-paths.md").read_text(encoding="utf-8")
        mine = (repo / ".specify" / "companion" / "nodes" / "call-paths.md").read_text(encoding="utf-8")
        self.assertEqual(mine, shipped)


if __name__ == "__main__":
    unittest.main()
