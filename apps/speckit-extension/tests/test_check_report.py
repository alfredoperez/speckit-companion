"""The shared report refuses a status it cannot render or count."""
import importlib.util
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def _report_cls():
    spec = importlib.util.spec_from_file_location("check_report", SCRIPTS / "check_report.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Report


class TheSharedReportTakesBothConventions(unittest.TestCase):
    def setUp(self):
        self.Report = _report_cls()

    def test_the_legacy_shorthand_still_works(self):
        r = self.Report()
        r.add(True, "a", "ok")
        r.add(False, "b", "no")
        r.add(None, "c", "note")
        self.assertEqual([s for s, _, _ in r.rows], ["PASS", "FAIL", "INFO"])
        self.assertEqual(r.failed, 1)

    def test_an_explicit_status_still_works(self):
        r = self.Report()
        r.add("WARN", "a", "hmm")
        self.assertEqual(r.warned, 1)

    def test_a_status_it_cannot_render_is_refused_where_it_is_written(self):
        # "False" is a string, so it skipped the shorthand table and was stored
        # verbatim: it counted as neither a pass nor a failure, and rendering it
        # raised far away from the call that caused it.
        r = self.Report()
        with self.assertRaises(ValueError):
            r.add("False", "a", "a check that meant to fail")


if __name__ == "__main__":
    unittest.main()
