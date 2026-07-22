#!/usr/bin/env python3
"""Tests for record-living-specs.py — the deterministic living-spec recorder.

Stdlib `unittest` only. Covers the contract the specify node bodies rely on:
an enabled registry with a matching change records the owning capabilities
leaf-first; a disabled/absent registry, a no-match change, and an unresolvable
input all no-op silently and exit 0; and re-recording is idempotent.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

_spec = importlib.util.spec_from_file_location(
    "record_living_specs", SCRIPTS / "record-living-specs.py"
)
rls = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rls)

ENABLED_REGISTRY = """\
enabled: true
capabilities:
  - name: checkout
    match: ["src/checkout/**"]
    spec: src/checkout/checkout.spec.md
  - name: checkout-cart
    match: ["src/checkout/cart/**"]
    spec: src/checkout/cart/checkout-cart.spec.md
"""

DISABLED_REGISTRY = "enabled: false\ncapabilities: []\n"


def _make_root(registry: str | None) -> Path:
    root = Path(tempfile.mkdtemp())
    if registry is not None:
        (root / "living-specs.yml").write_text(registry, encoding="utf-8")
    return root


def _loaded(feature_dir: Path):
    ctx_path = feature_dir / ".spec-context.json"
    if not ctx_path.is_file():
        return None
    return json.loads(ctx_path.read_text(encoding="utf-8")).get("livingSpecs")


class RecordLivingSpecsTests(unittest.TestCase):
    def test_enabled_match_records_leaf_first(self) -> None:
        root = _make_root(ENABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        names, outcome = rls.record(fd, ["src/checkout/cart/basket.ts"], str(root))
        # Both the leaf (checkout-cart) and its parent (checkout) own the file;
        # the resolver returns most-specific first.
        self.assertEqual(names, ["checkout-cart", "checkout"])
        self.assertEqual(outcome, "loaded")
        self.assertEqual(_loaded(fd), {"loaded": ["checkout-cart", "checkout"]})

    def test_disabled_registry_is_a_noop(self) -> None:
        root = _make_root(DISABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["src/checkout/cart/basket.ts"], str(root))[0], [])
        self.assertIsNone(_loaded(fd))

    def test_absent_registry_is_a_noop(self) -> None:
        root = _make_root(None)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["src/checkout/cart/basket.ts"], str(root))[0], [])
        self.assertIsNone(_loaded(fd))

    def test_no_match_is_a_noop(self) -> None:
        root = _make_root(ENABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["docs/README.md"], str(root))[0], [])
        self.assertIsNone(_loaded(fd))

    def test_empty_changed_is_a_noop(self) -> None:
        root = _make_root(ENABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["", "   "], str(root))[0], [])
        self.assertIsNone(_loaded(fd))

    def test_recording_is_idempotent(self) -> None:
        root = _make_root(ENABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        rls.record(fd, ["src/checkout/cart/basket.ts"], str(root))
        rls.record(fd, ["src/checkout/cart/basket.ts"], str(root))
        self.assertEqual(_loaded(fd), {"loaded": ["checkout-cart", "checkout"]})

    def test_main_exits_zero_on_unresolvable_input(self) -> None:
        # A colocated capability with no spec path makes the resolver raise;
        # main() must swallow it and still exit 0 (never fail the host command).
        root = _make_root("enabled: true\ncapabilities:\n  - name: broken\n    match: [\"src/**\"]\n    spec: \"\"\n")
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        rc = rls.main(["--feature-dir", str(fd), "--changed", "src/x.ts", "--root", str(root)])
        self.assertEqual(rc, 0)
        self.assertIsNone(_loaded(fd))

    def test_main_exits_zero_on_malformed_invocation(self) -> None:
        # argparse raises SystemExit (exit 2) on a bad/missing arg; that must NOT
        # escape and fail the host command — the recorder is best-effort.
        self.assertEqual(rls.main(["--bogus-flag"]), 0)          # unknown flag
        self.assertEqual(rls.main([]), 0)                        # missing required --feature-dir

    def test_main_records_via_cli(self) -> None:
        root = _make_root(ENABLED_REGISTRY)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        rc = rls.main(["--feature-dir", str(fd), "--changed", "src/checkout/pay.ts", "--root", str(root)])
        self.assertEqual(rc, 0)
        self.assertEqual(_loaded(fd), {"loaded": ["checkout"]})

    def test_malformed_registry_is_a_noop(self) -> None:
        # A registry that parses but is not a mapping must degrade to disabled,
        # never crash or write.
        root = _make_root("- just\n- a\n- list\n")
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["src/checkout/pay.ts"], str(root))[0], [])
        self.assertIsNone(_loaded(fd))

    def test_non_utf8_registry_is_a_noop(self) -> None:
        # A non-UTF-8 registry raises UnicodeDecodeError on read (a ValueError,
        # not an OSError); the loader must swallow it and record nothing.
        root = Path(tempfile.mkdtemp())
        (root / "living-specs.yml").write_bytes(b"enabled: true\ncap: \xff\xfe\n")
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        self.assertEqual(rls.record(fd, ["src/checkout/pay.ts"], str(root))[0], [])
        self.assertIsNone(_loaded(fd))


def _last_action(feature_dir: Path):
    ctx_path = feature_dir / ".spec-context.json"
    if not ctx_path.is_file():
        return None
    return json.loads(ctx_path.read_text(encoding="utf-8")).get("last_action")


class BreadcrumbTests(unittest.TestCase):
    """The deterministic audit trail replaces the AI's prose gate: the
    script itself stamps last_action for every outcome, so 'correctly did
    nothing' can't be misjudged as 'not configured'."""

    def _run(self, registry, changed):
        root = _make_root(registry)
        fd = root / "specs" / "001-feature"
        fd.mkdir(parents=True)
        rls.main(["--feature-dir", str(fd), "--changed", *changed, "--root", str(root)])
        return fd

    def test_loaded_outcome_writes_named_breadcrumb(self) -> None:
        fd = self._run(ENABLED_REGISTRY, ["src/checkout/pay.ts"])
        self.assertEqual(_last_action(fd), "living specs loaded (checkout)")

    def test_no_match_writes_evaluated_breadcrumb(self) -> None:
        fd = self._run(ENABLED_REGISTRY, ["docs/README.md"])
        self.assertEqual(_last_action(fd), "living specs evaluated — no capabilities matched")
        # No capability recorded, but the breadcrumb still proves the gate ran.
        self.assertIsNone(_loaded(fd))

    def test_disabled_writes_not_configured_breadcrumb(self) -> None:
        fd = self._run(DISABLED_REGISTRY, ["src/checkout/pay.ts"])
        self.assertEqual(_last_action(fd), "living specs evaluated — skipped (not configured)")
        self.assertIsNone(_loaded(fd))

    def test_absent_registry_writes_not_configured_breadcrumb(self) -> None:
        fd = self._run(None, ["src/checkout/pay.ts"])
        self.assertEqual(_last_action(fd), "living specs evaluated — skipped (not configured)")


if __name__ == "__main__":
    unittest.main()
