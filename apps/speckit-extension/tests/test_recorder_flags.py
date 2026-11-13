import re
import subprocess
import sys
import unittest
from pathlib import Path

EXT = Path(__file__).resolve().parent.parent
RECORDER = EXT / "scripts" / "write-context.py"
SOURCES = ("nodes", "presets", "commands", "fragments")


def _recorder_flags() -> set[str]:
    out = subprocess.run(
        [sys.executable, str(RECORDER), "--help"], capture_output=True, text=True, check=True,
    ).stdout
    return set(re.findall(r"(?<![\w-])--[a-z][a-z-]*", out))


def _flags_called() -> dict[str, set[str]]:
    called: dict[str, set[str]] = {}
    for folder in SOURCES:
        for path in sorted((EXT / folder).rglob("*.md")):
            for line in path.read_text(encoding="utf-8").splitlines():
                if "write-context.py" not in line:
                    continue
                # A --verify-run payload is `what::command`; the command's flags are not the recorder's.
                passed = re.sub(r'::[^"]*', "", line.split("write-context.py", 1)[1])
                for flag in re.findall(r"(?<![\w-])--[a-z][a-z-]*", passed):
                    called.setdefault(flag, set()).add(str(path.relative_to(EXT)))
    return called


class RecorderFlagsTests(unittest.TestCase):
    def test_every_flag_an_instruction_passes_exists(self) -> None:
        known = _recorder_flags()
        unknown = {flag: sorted(paths) for flag, paths in _flags_called().items() if flag not in known}
        self.assertEqual(unknown, {})

    def test_asking_for_the_usage_leaves_no_trace_in_the_active_spec(self) -> None:
        import json
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            spec = root / "specs" / "001-x"
            spec.mkdir(parents=True)
            (root / ".specify").mkdir()
            (root / ".specify" / "feature.json").write_text(json.dumps({"feature_directory": "specs/001-x"}))
            subprocess.run([sys.executable, str(RECORDER), "--help"], cwd=root, capture_output=True, check=True)
            self.assertFalse((spec / ".trace.jsonl").exists())


if __name__ == "__main__":
    unittest.main()
