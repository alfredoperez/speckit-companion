"""A capability whose membership never reaches the files its requirements name.

The Conduit case: adoption wrote `src/pages/editor/**` for article authoring while the
feature edits `src/features/article/create-article/**`. Both halves are individually
valid — the requirement's marker matches real files, the capability's glob matches real
files — so every existing check passes and the resolver still claims nothing. A run
touching that area is told about no capability at all, silently.
"""
from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "speckit-extension" / "scripts"

sys.path.insert(0, str(SCRIPTS))
_spec = importlib.util.spec_from_file_location("living_validate", SCRIPTS / "living_validate.py")
lv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lv)

SPEC = textwrap.dedent("""\
    # Article authoring

    ## Purpose

    Writing and publishing an article.

    ## Requirements

    ### An article can be written and published
    <!-- touches: src/features/article/create-article/** -->

    The editor SHALL let an author write an article and publish it.

    #### Scenario: an article is published
    - **WHEN** the author publishes
    - **THEN** the article appears in the feed
    """)


def codes(findings) -> list:
    return [f["code"] for f in findings]


class ACapabilityThatDoesNotClaimItsOwnRequirements(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cap-coverage-")
        self.root = Path(self.tmp)
        for rel in ("src/features/article/create-article", "src/pages/editor"):
            (self.root / rel).mkdir(parents=True, exist_ok=True)
            (self.root / rel / "index.ts").write_text("export {};\n", encoding="utf-8")
        (self.root / "capabilities" / "article-authoring").mkdir(parents=True, exist_ok=True)
        self.spec_rel = "capabilities/article-authoring/article-authoring.spec.md"
        (self.root / self.spec_rel).write_text(SPEC, encoding="utf-8")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _registry(self, match: str) -> None:
        (self.root / "living-specs.yml").write_text(textwrap.dedent(f"""\
            enabled: true
            layout: central
            capabilities:
              - name: article-authoring
                match:
                  - {match}
                spec: {self.spec_rel}
            """), encoding="utf-8")

    def _check(self):
        return lv.check_living_spec(
            SPEC, self.spec_rel, root=str(self.root), capability="article-authoring")

    def test_the_conduit_case_is_reported(self):
        self._registry("src/pages/editor/**")
        self.assertIn("requirements-outside-capability", codes(self._check()))

    def test_a_capability_that_claims_its_requirements_is_quiet(self):
        self._registry("src/features/article/create-article/**")
        self.assertNotIn("requirements-outside-capability", codes(self._check()))

    def test_a_broader_glob_still_covers_a_narrower_marker(self):
        # `src/features/**` reaches `src/features/article/create-article/**`; a check that
        # compared the two as strings would call this a miss and cry wolf on every project.
        self._registry("src/features/**")
        self.assertNotIn("requirements-outside-capability", codes(self._check()))

    def test_nothing_is_claimed_when_the_registry_says_nothing(self):
        # No registry entry means no membership to judge against, not a finding.
        self.assertNotIn("requirements-outside-capability", codes(self._check()))


class TheCoverageRuleItself(unittest.TestCase):
    def test_exact_prefix_and_pattern_all_count_as_covered(self):
        self.assertTrue(lv._covered_by_capability("src/a/**", {"src/a/**"}))
        self.assertTrue(lv._covered_by_capability("src/a/b/**", {"src/a/**"}))
        self.assertTrue(lv._covered_by_capability("src/a/b/**", {"src/**"}))

    def test_a_sibling_directory_is_not_covered(self):
        self.assertFalse(lv._covered_by_capability("src/features/x/**", {"src/pages/**"}))
        self.assertFalse(lv._covered_by_capability("src/ab/**", {"src/a/**"}))

    def test_an_empty_pattern_covers_nothing(self):
        self.assertFalse(lv._covered_by_capability("", {"src/**"}))
        self.assertFalse(lv._covered_by_capability("src/a/**", {"", "  "}))


if __name__ == "__main__":
    unittest.main()
