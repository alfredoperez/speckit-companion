"""#605 — the 26-row behaviour table from the ticket, pinned as one table.

Every row here was a wrong verdict at some point during the eight review passes
that led to this rule being backed out. The table IS the acceptance criteria, so
it lives as a table rather than as scattered assertions.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import doctor_drift as dd  # noqa: E402


def claim(what, result=None):
    return {"text": what, "result": result}


# (subject, outcome, why) — each of these MUST read as a claim.
IS_A_CLAIM = [
    ("living-spec drift check", "in sync — no drift", "the shape runs are told to record"),
    ("living specs check", "in sync — no drift", "the subject need not contain 'drift'"),
    ("living-spec drift check", "no drift found", "descriptive wording — what real runs write"),
    ("living-spec drift check", "no real drift found", "a negator a couple of words back still negates"),
    ("living-spec drift check", "no drift in living specs", "a negated phrase is not an affirmation"),
    ("living-spec drift check", "in sync (0 drifted files)", "a verdict carrying detail"),
    ("living-spec drift check", "clean — no drift across 4 capabilities", "a verdict with a count"),
    ("checked for drift in living specs", "in sync — clean", "naming drift in the subject is not asserting it"),
    ("ran the drift computation", "in sync, no drift", "naming the computation is not saying it did not run"),
    ("ran scripts/drift.py", "clean, in sync", "a definite verdict counts beside a script name"),
    ("living specs are in sync — no drift", None, "free-text sentence, no outcome field"),
    ("living specs are in sync — no drift", "pass", "assertion in the subject, generic verdict beside it"),
    ("living specs are in sync — no drift", "", "a blank verdict falls back to the subject"),
    ("drift check after the failed rebase", "in sync — no drift",
     "a word in the subject must not suppress a real claim"),
]

# …and each of these MUST NOT.
IS_NOT_A_CLAIM = [
    ("check that living specs are in sync", "drift found in auth", "the outcome reports drift"),
    ("verify no drift in living specs", "drift detected in 2 capabilities",
     "a check named for its hoped-for outcome is not that outcome"),
    ("verify no drift in living specs", "3 files drifted in auth", "wording the rule does not enumerate"),
    ("verify no drift in living specs", "FAIL", "a bare negative verdict"),
    ("confirm no drift before merge", "blocked", "any short non-clean verdict"),
    ("living-spec drift check", "not in sync", "a negated clean phrase"),
    ("living-spec drift check", "no longer in sync", "likewise"),
    ("living-spec drift check", "skipped — no drift computation was available",
     "a check that did not run asserts nothing"),
    ("checked drift.py wiring", "clean", "a note about tooling, not about the project"),
    ("checked the drift wiring", "clean", "the same in prose, with no filename to key on"),
    ("reviewed drift handling in the doctor", "looks clean", "a note about the doctor's own code"),
    ("drift check", "cleaned up two stale entries", "'cleaned' is not 'clean'"),
    ("drift check", "none of the capabilities were checked", "'none of' is not a clean verdict"),
]


class TheBehaviourTable(unittest.TestCase):
    def test_every_claim_row_reads_as_a_claim(self):
        for what, result, why in IS_A_CLAIM:
            with self.subTest(what=what, result=result):
                self.assertTrue(dd._claims_clean(claim(what, result)), why)

    def test_every_non_claim_row_stays_quiet(self):
        for what, result, why in IS_NOT_A_CLAIM:
            with self.subTest(what=what, result=result):
                self.assertFalse(dd._claims_clean(claim(what, result)), why)


class TheDesignDecisions(unittest.TestCase):
    """The rule's stated choices, asserted so they cannot drift silently."""

    def test_an_unrelated_field_cannot_supply_the_verdict(self):
        # A note reading "the registry is in sync" once turned a run reporting
        # drift into a run accused of lying about it.
        entry = {"what": "drift audit", "result": "drift found in auth",
                 "note": "the registry is in sync"}
        self.assertFalse(dd._claims_clean(
            {"text": entry["what"], "result": entry["result"]}))

    def test_a_bare_clean_is_deliberately_not_a_claim(self):
        # The unresolvable pair: this and "checked the drift wiring — clean" are
        # structurally identical. It errs toward silence, and accepts the miss.
        self.assertFalse(dd._claims_clean(claim("living-spec drift check", "clean")))

    def test_an_entry_with_no_usable_identity_is_skipped(self):
        ctx = {"verified": [["no drift"], 42, None]}
        self.assertEqual(dd._recorded_claims(ctx), [])

    def test_a_real_recorded_outcome_shape_does_not_false_positive(self):
        # Real verified[] entries are descriptive sentences, not tidy verdicts.
        for outcome in ("1197/1197 pass (12 new loader tests)",
                        "compile clean; 1647 tests in 120 suites pass"):
            with self.subTest(outcome=outcome):
                self.assertFalse(dd._claims_clean(claim("test suite", outcome)))


if __name__ == "__main__":
    unittest.main()
