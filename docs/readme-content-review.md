# README content review — implementation-detail audit

**Date:** 2026-05-25
**Scope:** Diagnosis only. Captures where `README.md` reads too much like internal
documentation versus user-facing benefit/usage prose. No body rewrite has been made
yet — this is the punch list to act on later.

## Verdict

The README has two tiers. The **top half is well-pitched** for a user-facing README;
the **bottom half reads like an API reference** and is the main source of the "too
much implementation detail" feeling. A first-time reader hits a wall around the
Configuration section.

## Well-pitched — keep as-is

| Section | ~Lines | Why it works |
|---|---|---|
| Why it exists | 19–25 | Clear user value, no internals |
| Features | 27–121 | UX-focused with screenshots (see caveats below) |
| Getting Started | ~123–128 | Procedural, clean |
| Sample Specs | ~129–138 | Narrative guidance |
| Supported AI Providers | ~139–173 | Comparison table, usage-oriented |

## Too implementation-heavy — trim or relocate

### 1. Configuration (~174–473) — the biggest offender
~300 lines of JSON dumps and dense property tables. Reads as reference material, not
onboarding. Notable spots:
- Every subsection opens with a config JSON block (~180–183, 199–202, 217–220, …).
- "Real-world example" (~276–305) is a full workflow JSON blob rather than narrative.
- Three more substantial JSON examples follow (~309–413).
- Property-definition tables dominate (~353–359, 384–386, 418–427).
- A "Behavior" subsection (~429–437) reads like an engineering spec.

### 2. Spec Context (~475–531) — exhaustive schema dump
- Full `.spec-context.json` schema block with internal field names (`stepHistory`,
  `substeps`) (~484–498).
- Exposes an internal source path: `src/core/types/spec-context.schema.json`.
- Describes low-level lifecycle writes (~506–515).
- Status vocabulary presented as a state-machine (~524–531).
- Mentions legacy-shape coercion and the function name `normalizeSpecContext`.

### 3. Feature prose leaking internals (smaller, in the otherwise-good top half)
- Repeated `.spec-context.json` mentions and per-file names in the Inline Comments /
  Persistent Comments / Reading Specs bullets (~38, 45, 47, 72). Users care that
  comments persist and survive a reopen — not which JSON file holds them.

## Recommendation (for a future pass — user's call, not done here)

1. **Relocate reference material:** move Configuration → `docs/configuration.md` and
   Spec Context → `docs/spec-context.md`. Leave a short summary + link in the README.
   This preserves the (good) reference content while shrinking the README to a
   benefit-first overview.
2. **Strip internals from feature prose:** drop source paths (`src/...`), class/
   function names (`normalizeSpecContext`), and most raw `.spec-context.json`
   references from the Features section; keep the user-visible behavior.
3. **Result:** README becomes "what it does and why you'd want it" with deep config
   one click away — matching how the well-pitched top half already reads.

## Out of scope of this review (handled separately)
- Marketplace screenshot breakage (root cause: `/main`-pinned image URLs + renamed
  files) — fixed via the v0.19.0 release + stable-filename policy.
- The `Visual Workflow Editor` → `Visual Spec Viewer` heading/caption mismatch — fixed.
- In-page anchor links not navigating on the Marketplace — fixed (absolute anchors).
