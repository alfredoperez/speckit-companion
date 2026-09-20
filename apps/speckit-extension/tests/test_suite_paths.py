"""Every test module's own path constants point where they claim.

Each suite computes the repo root or the extension dir itself, with its own
`parents[n]`. Twice now a folder move left some of that arithmetic one level
short, and the suites did not fail: they loaded an empty config from a path that
does not exist and asserted nothing. This fails instead.

`ROOT` is deliberately checked against both meanings, because it names the
extension dir in most suites and the repo root in one.
"""
import re
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSIGN = re.compile(r"^([A-Z_]+) = (Path\(__file__\)\.resolve\(\)[^\n#]*)$", re.M)

#: name -> the file that must exist inside whatever that constant resolves to.
MARKERS = {
    "SCRIPTS": "write-context.py",
    "EXT": "extension.yml",
    "REPO": "package.json",
    "HERE": "test_suite_paths.py",
    "FIXTURES": None,
    "FIXTURE": None,
    "ROOT": ("extension.yml", "package.json"),
}


class EveryPathConstantResolves(unittest.TestCase):
    def test_each_suite_computes_a_directory_that_exists(self):
        checked = 0
        for path in sorted(HERE.glob("*.py")):
            source = path.read_text(encoding="utf-8")
            for name, expr in ASSIGN.findall(source):
                with self.subTest(module=path.name, const=name):
                    resolved = eval(expr, {"Path": Path, "__file__": str(path)})
                    self.assertTrue(
                        resolved.exists(),
                        f"{path.name}: {name} = {expr.strip()} points at nothing")
                    marker = MARKERS.get(name)
                    if marker is None:
                        continue
                    wanted = (marker,) if isinstance(marker, str) else marker
                    self.assertTrue(
                        any((resolved / m).exists() for m in wanted),
                        f"{path.name}: {name} resolves to {resolved}, which holds none of {wanted}")
                    checked += 1
        self.assertGreater(checked, 40, "the scan stopped finding path constants; fix the pattern")


if __name__ == "__main__":
    unittest.main()
