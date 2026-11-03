"""Spec folders are minted under a lock, numbered the way the project chose."""
import json
import subprocess
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
MINT = SCRIPTS / "mint-spec-dir.py"
sys.path.insert(0, str(SCRIPTS))

import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location("mint_spec_dir", MINT)
mint_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mint_mod)


class MintSpecDir(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        (self.root / ".specify").mkdir()
        (self.root / "specs" / "007-old").mkdir(parents=True)

    def run_mint(self, name):
        return subprocess.run([sys.executable, str(MINT), "--short-name", name], cwd=self.root,
                              capture_output=True, text=True, check=True).stdout.strip()

    def test_it_takes_the_next_number_and_points_feature_json_at_it(self):
        self.assertEqual(self.run_mint("Saved Filters!"), "specs/008-saved-filters")
        pointer = json.loads((self.root / ".specify" / "feature.json").read_text(encoding="utf-8"))
        self.assertEqual(pointer, {"feature_directory": "specs/008-saved-filters"})

    def test_runs_started_together_never_share_a_number(self):
        with ThreadPoolExecutor(max_workers=6) as pool:
            made = list(pool.map(self.run_mint, [f"race {i}" for i in range(6)]))
        numbers = sorted(p.split("/")[1].split("-")[0] for p in made)
        self.assertEqual(numbers, ["008", "009", "010", "011", "012", "013"])

    def test_timestamp_numbering_gives_timestamp_folders(self):
        (self.root / ".specify" / "init-options.json").write_text(json.dumps({"feature_numbering": "timestamp"}), encoding="utf-8")
        folder = mint_mod.mint(self.root, "due dates", now=datetime(2026, 11, 3, 14, 25, 1))
        self.assertEqual(folder.name, "20261103-142501-due-dates")

    def test_timestamp_folders_do_not_move_the_sequential_count(self):
        (self.root / "specs" / "20261103-142501-x").mkdir()
        self.assertEqual(self.run_mint("next"), "specs/008-next")


    def test_a_project_without_specify_gets_no_folder(self):
        bare = self.root / "bare"
        bare.mkdir()
        with self.assertRaises(SystemExit):
            mint_mod.mint(bare, "x")
        self.assertFalse((bare / "specs").exists())

    def test_a_file_with_a_number_still_claims_it(self):
        (self.root / "specs" / "008-notes.md").write_text("", encoding="utf-8")
        self.assertEqual(self.run_mint("next"), "specs/009-next")

    def test_branches_claim_numbers_when_asked(self):
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "a"], cwd=self.root, check=True)
        subprocess.run(["git", "branch", "014-teammate"], cwd=self.root, check=True)
        self.assertEqual(mint_mod.mint(self.root, "mine", branches=True).name, "015-mine")
        self.assertEqual(mint_mod.mint(self.root, "plain").name, "016-plain")


if __name__ == "__main__":
    unittest.main()
