#!/usr/bin/env python3
"""Tests for the companion.yml loader, merge contract, and failure table (#317).

Stdlib `unittest` only. These prove the prose in _parts/orchestrator.md matches
the code: hooks merge in declared order, a recipe's nodes: override resolves, an
anchor outside the active recipe is warned + skipped, a missing type:node ref is a
hard error, absent config is silent defaults, and malformed config degrades + warns.
"""
from __future__ import annotations

import importlib
import sys
import os
import stat
import tempfile
from unittest import mock
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPTS))
cc = importlib.import_module("companion_config")


class YamlSubsetTests(unittest.TestCase):
    def test_parses_nested_hooks_and_flow_maps(self) -> None:
        cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        impl = cfg["commands"]["implement"]["hooks"]
        self.assertEqual(impl["before"]["handoff"][0], {"type": "command", "run": "npm test"})
        self.assertEqual(impl["before"]["handoff"][1]["type"], "prompt")
        self.assertEqual(impl["after"]["implement-exec"][0], {"type": "node", "ref": "review"})

    def test_block_form_hooks_parse_and_do_not_swallow_siblings(self) -> None:
        cfg = cc.load_yaml(
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      after:\n"
            "        implement-exec:\n"
            "          - type: command\n"
            "            run: npm test\n"
            "      before:\n"
            "        handoff:\n"
            "          - type: prompt\n"
            "            text: Confirm CHANGELOG.\n"
        )
        hooks = cfg["commands"]["implement"]["hooks"]
        self.assertEqual(hooks["after"]["implement-exec"][0], {"type": "command", "run": "npm test"})
        self.assertEqual(hooks["before"]["handoff"][0], {"type": "prompt", "text": "Confirm CHANGELOG."})

    def test_inline_comment_after_flow_seq_is_stripped(self) -> None:
        cfg = cc.load_yaml(
            "commands:\n"
            "  plan:\n"
            "    nodes: [gather-context, plan-doc, handoff]   # drops constitution-check\n"
        )
        self.assertEqual(cfg["commands"]["plan"]["nodes"], ["gather-context", "plan-doc", "handoff"])

    def test_hash_inside_quoted_scalar_is_not_a_comment(self) -> None:
        cfg = cc.load_yaml(
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      before:\n"
            "        handoff:\n"
            "          - { type: command, run: \"echo '#42 done'\" }\n"
        )
        self.assertEqual(cfg["commands"]["implement"]["hooks"]["before"]["handoff"][0]["run"], "echo '#42 done'")

    def test_recipe_node_list_is_a_flow_seq(self) -> None:
        cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        self.assertEqual(
            cfg["commands"]["plan"]["nodes"],
            ["gather-context", "plan-doc", "side-files", "handoff"],
        )


class MergeContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())

    def test_hooks_preserve_declared_order(self) -> None:
        active = ["implement-exec", "handoff"]
        ordered, warnings = cc.merge_hooks(self.cfg, "implement", active)
        runs = [(h["when"], h["anchor"], h["index"], h["hook"]["type"]) for h in ordered]
        self.assertEqual(
            runs,
            [
                ("before", "handoff", 0, "command"),
                ("before", "handoff", 1, "prompt"),
                ("after", "implement-exec", 0, "node"),
            ],
        )
        self.assertEqual(warnings, [])

    def test_anchor_not_in_active_recipe_is_warned_and_skipped(self) -> None:
        ordered, warnings = cc.merge_hooks(self.cfg, "implement", ["implement-exec"])
        self.assertNotIn("handoff", [h["anchor"] for h in ordered])
        self.assertTrue(any("handoff" in w and "skipped" in w for w in warnings))

    def test_background_flag_is_preserved_through_merge(self) -> None:
        cfg = cc.load_yaml(
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      after:\n"
            "        implement-exec:\n"
            "          - { type: command, run: \"npm run e2e\", background: true }\n"
            "          - { type: command, run: \"echo done\" }\n"
        )
        ordered, warnings = cc.merge_hooks(cfg, "implement", ["implement-exec", "handoff"])
        self.assertEqual(ordered[0]["hook"].get("background"), True)
        self.assertIsNone(ordered[1]["hook"].get("background"))
        self.assertEqual(warnings, [])

    def test_missing_node_ref_is_hard_error(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(cc.ConfigError):
                cc.merge_hooks(self.cfg, "implement", ["implement-exec", "handoff"], nodes_dir=d)

    def test_present_node_ref_passes(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "review.md").write_text("---\nid: review\n---\nbody\n")
            ordered, _ = cc.merge_hooks(self.cfg, "implement", ["implement-exec", "handoff"], nodes_dir=d)
            self.assertIn("review", [h["hook"].get("ref") for h in ordered])


class RecipeResolveTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cfg = cc.load_yaml((FIXTURES / "companion.yml").read_text())
        self.default = ["gather-context", "plan-doc", "constitution-check", "side-files", "handoff"]

    def test_recipe_override_replaces_default_order(self) -> None:
        self.assertEqual(
            cc.resolve_order(self.cfg, "plan", self.default),
            ["gather-context", "plan-doc", "side-files", "handoff"],
        )

    def test_command_without_recipe_keeps_default(self) -> None:
        self.assertEqual(cc.resolve_order(self.cfg, "tasks", ["tasks-doc", "handoff"]),
                         ["tasks-doc", "handoff"])

    def test_reads_of_dropped_node_errors(self) -> None:
        active = {"plan-doc": ["gather-context"], "side-files": ["plan-doc"]}  # gather-context dropped
        with self.assertRaises(cc.ConfigError):
            cc.validate_reads(active)

    def test_reads_all_present_passes(self) -> None:
        active = {"gather-context": [], "plan-doc": ["gather-context"], "side-files": ["plan-doc"], "handoff": []}
        cc.validate_reads(active)  # no raise


class ShipTicketDogfoodTests(unittest.TestCase):
    """The ship-ticket example wires real node hooks; assert it parses + resolves."""

    EXAMPLE = Path(__file__).resolve().parent.parent / "examples" / "ship-ticket"

    def test_node_form_merges_five_hooks_in_order_with_refs_resolving(self) -> None:
        cfg = cc.load_yaml((self.EXAMPLE / "companion.yml").read_text())
        ordered, warnings = cc.merge_hooks(
            cfg, "implement", ["implement-exec", "handoff"],
            nodes_dir=str(self.EXAMPLE / "nodes"),
        )
        refs = [h["hook"]["ref"] for h in ordered]
        self.assertEqual(refs, ["review", "pr", "copilot", "merge", "install-local"])
        self.assertTrue(all(h["when"] == "after" and h["anchor"] == "implement-exec" for h in ordered))
        self.assertEqual(warnings, [])

    def test_inline_form_parses_command_and_prompt_hooks(self) -> None:
        cfg = cc.load_yaml((self.EXAMPLE / "companion.inline.yml").read_text())
        ordered, warnings = cc.merge_hooks(cfg, "implement", ["implement-exec", "handoff"])
        types = [h["hook"]["type"] for h in ordered]
        self.assertEqual(types, ["command", "prompt", "prompt", "prompt", "command"])
        self.assertEqual(warnings, [])


class FailureTableTests(unittest.TestCase):
    def test_absent_config_is_silent_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            cfg, warnings = cc.load_config(str(Path(d) / "companion.yml"))
            self.assertEqual(cfg, {})
            self.assertEqual(warnings, [])

    def test_malformed_config_degrades_with_warning(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "companion.yml"
            p.write_text("commands:\n  implement:\n  bad line without colon\n")
            cfg, warnings = cc.load_config(str(p))
            self.assertEqual(cfg, {})
            self.assertTrue(warnings and "malformed" in warnings[0])


ANCHORED_CONFIG = """commands:
  implement:
    hooks:
      before:
        complete:
          - { type: command, run: "echo hi" }
      after:
        handoff:
          - { type: prompt, text: "review the diff" }
  specify: &shared
    hooks:
      after:
        handoff:
          - { type: prompt, text: "..." }
  plan: *shared
"""


class UnsupportedSyntaxTests(unittest.TestCase):
    """Syntax the reader cannot represent degrades loudly, never to a half-applied config."""

    def _load(self, text: str):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "companion.yml"
            p.write_text(text)
            return cc.load_config(str(p))

    def test_an_anchored_config_is_reported_as_malformed(self) -> None:
        cfg, warnings = self._load(ANCHORED_CONFIG)
        self.assertEqual(cfg, {})
        self.assertEqual(len(warnings), 1)
        self.assertIn("malformed companion.yml", warnings[0])
        self.assertIn("using shipped defaults", warnings[0])

    def test_an_anchored_config_applies_nothing_at_all(self) -> None:
        cfg, _warnings = self._load(ANCHORED_CONFIG)
        self.assertIsNone(cfg.get("commands"))
        ordered, _merge_warnings = cc.merge_hooks(cfg, "implement", ["complete", "handoff"])
        self.assertEqual(ordered, [])

    def test_an_anchor_on_the_last_line_is_still_rejected(self) -> None:
        with self.assertRaises(ValueError):
            cc.load_yaml("commands:\n  specify: &shared\n")

    def test_an_alias_with_its_anchor_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            cc.load_yaml("specify: &shared {}\ncommands:\n  plan: *shared\n")

    def test_an_alias_shaped_token_with_no_anchor_reads_as_a_glob(self) -> None:
        # Lexically identical to `- *bundle` in an exempt list. Real YAML would
        # error on the undefined alias; here it stays a literal string, and the
        # config fails visibly downstream if it was meant as an alias — better
        # than rejecting every registry that holds an unquoted glob.
        self.assertEqual(cc.load_yaml("commands:\n  plan: *shared\n"),
                         {"commands": {"plan": "*shared"}})

    def test_a_dotted_anchor_name_is_still_an_anchor(self) -> None:
        with self.assertRaises(ValueError):
            cc.load_yaml("a: &shared.spec {}\nb: *shared.spec\n")

    def test_a_slashed_anchor_name_is_still_an_anchor(self) -> None:
        with self.assertRaises(ValueError):
            cc.load_yaml("a: &caps/auth {}\n")

    def test_shell_operators_are_not_dotted_anchors(self) -> None:
        cfg = cc.load_yaml('run: "a && b 2>&1"\nplain: a && b.sh 2>&1\n')
        self.assertEqual(cfg["plain"], "a && b.sh 2>&1")

    def test_a_dotted_glob_with_no_anchor_still_parses(self) -> None:
        self.assertEqual(cc.load_yaml("exempt:\n  - *.min.js\n"),
                         {"exempt": ["*.min.js"]})

    def test_rendered_scalars_with_a_hash_round_trip(self) -> None:
        rendered = "\n".join(cc.render_capability(
            {"name": "auth #2", "match": ["src/auth/**"], "spec": "specs/my file #1.md"}))
        cfg = cc.load_yaml("capabilities:\n" + rendered + "\n")
        cap = cfg["capabilities"][0]
        self.assertEqual(cap["name"], "auth #2")
        self.assertEqual(cap["spec"], "specs/my file #1.md")

    def test_the_rejection_names_the_line(self) -> None:
        with self.assertRaises(ValueError) as caught:
            cc.load_yaml("debug: true\n\n# a comment\ncommands: &shared\n")
        self.assertIn("line 4", str(caught.exception))

    def test_tab_indentation_is_rejected_not_collapsed(self) -> None:
        cfg, warnings = self._load("commands:\n\timplement:\n\t\tnodes: [plan-doc]\n")
        self.assertEqual(cfg, {})
        self.assertEqual(len(warnings), 1)
        self.assertIn("malformed companion.yml", warnings[0])

    def test_a_block_scalar_value_is_rejected(self) -> None:
        cfg, warnings = self._load(
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      after:\n"
            "        handoff:\n"
            "          - type: prompt\n"
            "            text: |\n"
            "              first line\n"
            "              second line\n"
        )
        self.assertEqual(cfg, {})
        self.assertEqual(len(warnings), 1)

    def test_a_folded_scalar_with_a_chomping_marker_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            cc.load_yaml("note: >-\n  folded text\n")

    def test_a_document_separator_is_rejected(self) -> None:
        cfg, warnings = self._load("debug: true\n---\ncommands:\n  plan:\n    nodes: [plan-doc]\n")
        self.assertEqual(cfg, {})
        self.assertEqual(len(warnings), 1)

    def test_a_file_the_parser_stops_short_of_is_rejected(self) -> None:
        with self.assertRaises(ValueError) as caught:
            cc.load_yaml("commands:\n  plan:\n    nodes: [plan-doc]\n  tasks:\n- stray\n")
        self.assertIn("line 5", str(caught.exception))


class NothingAcceptedTodayIsNarrowedTests(unittest.TestCase):
    """The guard widens what is reported; it must never shrink what parses."""

    # A committed copy of this project's real config, not the live file. Asserting
    # a fixed hook composition against the working config turns "someone added a
    # hook" into a parser-regression failure, and the file has changed three times
    # in recent memory.
    PROJECT_CONFIG = Path(__file__).resolve().parent / "fixtures" / "config" / "project-companion.yml"

    def test_a_real_world_config_resolves_every_hook_it_declares(self) -> None:
        cfg, warnings = cc.load_config(str(self.PROJECT_CONFIG))
        self.assertEqual(warnings, [])
        implement, implement_warnings = cc.merge_hooks(
            cfg, "implement", ["complete", "implement-exec", "handoff"]
        )
        self.assertEqual(implement_warnings, [])
        self.assertEqual(
            [(h["when"], h["anchor"]) for h in implement],
            [
                ("before", "complete"),
                ("before", "complete"),
                ("before", "implement-exec"),
                ("after", "handoff"),
                ("after", "handoff"),
                ("after", "handoff"),
            ],
        )
        for command, anchor in (("specify", "draft-spec"), ("plan", "plan-doc"), ("tasks", "tasks-doc")):
            ordered, step_warnings = cc.merge_hooks(cfg, command, [anchor])
            self.assertEqual(step_warnings, [])
            self.assertEqual(len(ordered), 1)
            self.assertEqual(ordered[0]["hook"], {"type": "node", "ref": "debug-timing"})

    def test_the_live_project_config_parses_without_warnings(self) -> None:
        # The valuable half of reading the working file: it must stay inside the
        # supported subset. Nothing is asserted about WHAT it declares, so adding
        # a hook is not a parser failure.
        live = Path(__file__).resolve().parent.parent.parent / ".specify" / "companion.yml"
        if not live.is_file():
            self.skipTest("not running inside the speckit-companion checkout")
        cfg, warnings = cc.load_config(str(live))
        self.assertEqual(warnings, [], f"the project's own config no longer parses: {warnings}")
        self.assertTrue(cfg.get("commands"), "a config that parses to nothing is a silent truncation")

    def _tmp_config(self, body: str) -> str:
        d = tempfile.mkdtemp()
        path = Path(d) / "companion.yml"
        path.write_text(body, encoding="utf-8")
        return str(path)

    def test_an_alias_inside_a_flow_collection_is_rejected(self) -> None:
        # Scanning only the first token of each half let this through, and the
        # assembler received a node id that cannot exist — the config half-applied.
        # The token is only an alias when its anchor is defined; bare, it is a glob.
        for body in ("shared: &shared {}\nnodes: [*shared]",
                     "shared: &shared {}\nhooks:\n  - { type: prompt, text: *shared }"):
            with self.subTest(body):
                cfg, warnings = cc.load_config(self._tmp_config(body + "\n"))
                self.assertEqual(cfg, {})
                self.assertEqual(len(warnings), 1)
                self.assertIn("anchors and aliases", warnings[0])

    def test_a_document_separator_is_reported_with_its_line(self) -> None:
        cfg, warnings = cc.load_config(self._tmp_config("commands: {}\n---\nmore: yes\n"))
        self.assertEqual(cfg, {})
        self.assertEqual(len(warnings), 1)
        self.assertIn("line 2", warnings[0])
        self.assertIn("one document", warnings[0])

    def test_shell_redirects_in_an_unquoted_command_still_parse(self) -> None:
        # `2>&1` matched the alias pattern and threw away the whole config, with a
        # message about anchors on a line containing none.
        for body in ("run: cmd > log 2>&1", "run: cmd 1>&2"):
            with self.subTest(body):
                self.assertEqual(cc._unsupported(body), "")

    def test_unquoted_globs_ending_in_a_name_still_parse(self) -> None:
        for body in ("- *tmp", "- *bundle", "exempt: [*.min.js, *bundle]"):
            with self.subTest(body):
                self.assertEqual(cc._unsupported(body), "")

    def test_an_alias_is_only_an_alias_when_its_anchor_is_defined(self) -> None:
        # `*shared` with no `&shared` anywhere is a glob and must parse; the same
        # token with the anchor defined is an alias and must be rejected.
        self.assertEqual(cc.load_yaml("nodes: [*shared]"), {"nodes": ["*shared"]})
        with self.assertRaises(ValueError) as ctx:
            cc.load_yaml("a: &shared\nb: [*shared]")
        self.assertIn("anchors and aliases", str(ctx.exception))

    def test_a_sequence_at_its_key_s_own_indent_parses(self) -> None:
        # Ordinary YAML, and the style spec-kit's own `extensions.yml` is written
        # in — refusing it meant we could not read the registry of the tool we
        # extend, so a project's installed-extension hooks were invisible.
        self.assertEqual(
            cc.load_yaml("capabilities:\n- name: auth\n"),
            {"capabilities": [{"name": "auth"}]},
        )
        self.assertEqual(cc.load_yaml("installed:\n- companion\n"),
                         {"installed": ["companion"]})

    def test_an_indented_sequence_still_parses_the_same_way(self) -> None:
        self.assertEqual(cc.load_yaml("capabilities:\n  - name: auth\n"),
                         {"capabilities": [{"name": "auth"}]})

    def test_a_plain_scalar_wrapped_onto_the_next_line_is_joined(self) -> None:
        # Emitters wrap long values; YAML joins them with a space. Reading only
        # the first line stopped the parse mid-file.
        cfg = cc.load_yaml(
            "hooks:\n"
            "  after_specify:\n"
            "  - command: speckit.companion.after-specify\n"
            "    description: Record specify completion\n"
            "      into .spec-context.json\n"
            "    optional: false\n"
        )
        entry = cfg["hooks"]["after_specify"][0]
        self.assertEqual(entry["description"],
                         "Record specify completion into .spec-context.json")
        self.assertIs(entry["optional"], False)

    def test_a_marker_character_later_in_a_value_stays_ordinary_text(self) -> None:
        cfg = cc.load_yaml(
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      before:\n"
            "        handoff:\n"
            "          - type: command\n"
            "            run: npm run build && npm test > build.log\n"
        )
        hook = cfg["commands"]["implement"]["hooks"]["before"]["handoff"][0]
        self.assertEqual(hook["run"], "npm run build && npm test > build.log")

    def test_a_quoted_glob_in_a_flow_seq_stays_a_glob(self) -> None:
        cfg = cc.load_yaml('exempt: ["*.config.*", "**/migrations/**"]\n')
        self.assertEqual(cfg["exempt"], ["*.config.*", "**/migrations/**"])

    def test_an_unquoted_glob_in_a_block_seq_stays_a_glob(self) -> None:
        cfg = cc.load_yaml("exempt:\n  - *.config.*\n  - **/migrations/**\n")
        self.assertEqual(cfg["exempt"], ["*.config.*", "**/migrations/**"])

    def test_a_marker_inside_a_comment_or_a_quoted_value_is_not_a_rejection(self) -> None:
        cfg = cc.load_yaml(
            "# reuse via &shared is not supported here\n"
            "commands:\n"
            "  implement:\n"
            "    hooks:\n"
            "      before:\n"
            "        handoff:\n"
            '          - { type: command, run: "echo &shared | tee log" }\n'
        )
        hook = cfg["commands"]["implement"]["hooks"]["before"]["handoff"][0]
        self.assertEqual(hook["run"], "echo &shared | tee log")


if __name__ == "__main__":
    unittest.main()


class DebugFlagTests(unittest.TestCase):
    """`debug: true` — one literal value, read at render time, off on any doubt."""

    def test_a_literal_true_turns_it_on(self):
        cfg, warnings = cc.load_config(self._write("debug: true\n"))
        self.assertEqual(warnings, [])
        self.assertTrue(cc.debug_enabled(cfg))

    def test_every_other_value_is_off(self):
        for body in ("debug: false\n", 'debug: "true"\n', "debug: verbose\n",
                     "debug:\n", "commands: {}\n"):
            with self.subTest(body=body):
                cfg, _w = cc.load_config(self._write(body))
                self.assertFalse(cc.debug_enabled(cfg))

    def test_an_absent_config_is_off_with_no_warning(self):
        cfg, warnings = cc.load_config(str(Path(self._dir()) / "nope.yml"))
        self.assertEqual((cfg, warnings), ({}, []))
        self.assertFalse(cc.debug_enabled(cfg))

    def test_a_malformed_config_is_off_and_warns_once(self):
        cfg, warnings = cc.load_config(self._write("- not\n- a\n- mapping\n"))
        self.assertFalse(cc.debug_enabled(cfg))
        self.assertEqual(len(warnings), 1)

    def test_debug_from_root_reads_the_projects_own_config(self):
        root = Path(self._dir())
        (root / ".specify").mkdir()
        (root / ".specify" / "companion.yml").write_text("debug: true\n", encoding="utf-8")
        self.assertTrue(cc.debug_from_root(str(root)))

    def test_debug_from_root_on_a_project_with_no_config_is_off(self):
        self.assertFalse(cc.debug_from_root(self._dir()))

    def _dir(self):
        if not hasattr(self, "_tmp"):
            self._tmp = tempfile.TemporaryDirectory()
            self.addCleanup(self._tmp.cleanup)
        return self._tmp.name

    def _write(self, body):
        p = Path(self._dir()) / "companion.yml"
        p.write_text(body, encoding="utf-8")
        return str(p)


class AtomicWriteTextTests(unittest.TestCase):
    """The shared writer behind every registry and config rewrite."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

    def test_two_concurrent_writers_cannot_publish_each_others_half(self):
        # A fixed `<path>.tmp` let the second writer truncate the first's temp,
        # so the first `os.replace` published half a file.
        target = self.root / "living-specs.yml"
        target.write_text("original\n", encoding="utf-8")
        seen = []
        real_mkstemp = cc.tempfile.mkstemp

        def recording_mkstemp(*a, **kw):
            fd, path = real_mkstemp(*a, **kw)
            seen.append(path)
            return fd, path

        with mock.patch.object(cc.tempfile, "mkstemp", recording_mkstemp):
            cc.atomic_write_text(str(target), "first\n")
            cc.atomic_write_text(str(target), "second\n")
        self.assertEqual(len(set(seen)), 2, "each writer needs its own temp name")
        self.assertEqual(target.read_text(encoding="utf-8"), "second\n")

    def test_the_write_is_flushed_to_disk_before_the_rename(self):
        target = self.root / "cfg.yml"
        synced = []
        real_fsync = cc.os.fsync
        with mock.patch.object(cc.os, "fsync", lambda fd: (synced.append(fd), real_fsync(fd))[1]):
            cc.atomic_write_text(str(target), "body\n")
        self.assertTrue(synced, "a rename that outruns the data blocks leaves a zero-length file")

    def test_existing_permissions_survive_the_replace(self):
        target = self.root / "cfg.yml"
        target.write_text("a\n", encoding="utf-8")
        os.chmod(target, 0o600)
        cc.atomic_write_text(str(target), "b\n")
        self.assertEqual(stat.S_IMODE(os.stat(target).st_mode), 0o600)

    def test_a_symlinked_config_is_followed_not_replaced(self):
        real = self.root / "real.yml"
        real.write_text("a\n", encoding="utf-8")
        link = self.root / "link.yml"
        link.symlink_to(real)
        cc.atomic_write_text(str(link), "b\n")
        self.assertTrue(link.is_symlink(), "the link must survive")
        self.assertEqual(real.read_text(encoding="utf-8"), "b\n")

    def test_a_failed_write_leaves_no_temp_behind(self):
        target = self.root / "cfg.yml"
        with mock.patch.object(cc.os, "replace", side_effect=OSError("nope")):
            with self.assertRaises(OSError):
                cc.atomic_write_text(str(target), "b\n")
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), [])
