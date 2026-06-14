# Quickstart: Composable Command Nodes

**Feature**: 172-composable-command-nodes — for the maintainer working on or verifying this reshape.

## What this changes

Shared command logic (sizing, routing, timing) is authored once in `_parts/`, and the `/speckit.companion.*` command files are assembled from those parts plus their own fixed text. The committed/shipped command files stay whole, so a plain terminal still reads a complete command. A parity check proves the assembled output is byte-for-byte identical to a frozen reference.

## One-time setup (before decomposing)

```bash
# Freeze today's command set as the proof-of-no-change reference
python3 speckit-extension/scripts/capture-golden.py
```

## Everyday loop (editing shared logic)

```bash
# 1. Edit a shared rule in exactly one place
$EDITOR speckit-extension/presets/_parts/sizing.md

# 2. Re-assemble the command bodies from parts
python3 speckit-extension/scripts/build-commands.py

# 3a. Re-bless the frozen reference — you intentionally changed a rule, so the
#     pre-edit golden is now stale (Contract 3: re-blessing is explicit, reviewed)
python3 speckit-extension/scripts/capture-golden.py

# 3b. Prove nothing else drifted
python3 speckit-extension/scripts/check-shape-parity.py
# → [shape-parity] OK — N bodies match parts and golden
```

Change the rule once; every command that includes that part reflects it after `build` (SC-003). The parity check still proves two things: every fenced region equals its part (no forked copy), and every unchanged command equals the golden. Skip the re-bless in step 3a and the check will (correctly) report `golden drift` for the commands that embed the edited rule — that is the byte-for-byte reference catching a real content change.

## Verifying each story

**P1 — byte-for-byte parity:** with no part edited, `build-commands.py` then `check-shape-parity.py` must report zero drift vs the golden. This is the gate that lets the rest ship.

**P2 — single definition:** `grep -rn "5 files" speckit-extension/` (and the routing/timing text) should resolve to one `_parts/` file, not three command bodies.

**P3 — self-advance + terminal mark-complete:**
- Agentic CLI: run the first Companion step; confirm it continues through the pipeline, pauses at gates, runs the terminal `mark-complete` node after implement, and the spec's `.spec-context.json` lands at `status: completed`.
- Plain/one-shot: run one step; confirm it does **not** auto-advance and completion stays a manual action.
- Stock SpecKit: confirm a stock run stops at `implemented` with no terminal node.

## Capture regression (must stay green)

```bash
python3 -m pytest speckit-extension/tests/test_context.py
# the .spec-context.json history/timing output is unchanged before and after the reshape (SC-007)
```
