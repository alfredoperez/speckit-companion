# Install nudges

Every place the VS Code extension asks you to install the companion spec-kit extension, in one list, with an honest read on whether it is too much.

To look at them: `SB_PORT=6031 npm run storybook`, then **Install nudges → Every surface**. Each story draws one surface and captions it with its source line; the last story stacks the ones a fresh, uninstalled workspace actually meets.

## The inventory

Fifteen surfaces. Twelve of them can fire; one is unreachable; two are passive menu entries.

| # | Surface | Copy | Trigger | Dismissal | Recurs |
|---|---------|------|---------|-----------|--------|
| 1 | Activation notification (`src/speckit/activationInstallNudge.ts:78`) | "This project uses spec-kit. Install the SpecKit Companion extension to unlock live status, resumability, the complexity fast path, and living specs 🌱." + **Install** / **Don't show again** | Opening any workspace with `.specify/` and no companion extension | "Don't show again" → `speckit.installNudgeDismissed` (global, permanent) | Once per window session — every new window, until dismissed |
| 2 | Activity-bar badge (`src/extension.ts:301`) | Blue `1` badge, tooltip "Install SpecKit Companion" | Companion missing | **None.** Ignores the dismissal flag *and* the `speckit.companion.installPrompt` setting | Permanent, always on screen |
| 3 | Pinned CTA row in Specs (`src/features/specs/specExplorerProvider.ts:133`) | "Get Companion — living specs, capture, fast-path" | Companion missing and at least one spec exists | **None.** Ignores the dismissal flag and the setting | Permanent, first row of the tree |
| 4 | viewsWelcome install block (`package.json:110`) | "SpecKit Companion adds living specs, lifecycle capture, and a fast-path for small changes." + **Install SpecKit Companion** / **Dismiss** | Detected, constitution set up, companion missing, not dismissed, **and no specs yet** | Its own **Dismiss** → same `installNudgeDismissed` flag as #1 | Every time the empty Specs view is shown |
| 5 | Install banner — Create Spec (`src/features/spec-editor/installBanner.ts:14`) | "Install the spec-kit extension for the leaner `/speckit.companion.*` pipeline and capture." + **Install** / **Learn more** / × | Companion missing, `installPrompt` on, banner not dismissed | × → `speckit.installBannerDismissed`, a **separate** flag from #1/#4 | Every time the panel opens |
| 6 | Install banner — Activity panel (`webview/src/spec-viewer/components/ActivityPanel.tsx:28`) | **Identical to #5, word for word** | Same as #5, plus the Activity panel being enabled | Same × and same flag as #5 — dismissing either clears both | Every spec you open |
| 7 | Blocking modal on submit (`src/features/spec-editor/specEditorProvider.ts:125`) | "SpecKit Companion adds living specs, full lifecycle capture, a fast-path for small changes, and hands-off Auto. Install it to enable the full workflow — or continue with standard SpecKit." + **Install** / **Use SpecKit Instead** / Cancel | Submitting Create Spec with the Companion workflow selected and the extension missing | **None.** Escape cancels the spec | Every submit, indefinitely |
| 8 | "Re-run New Spec" toast (`src/features/spec-editor/specEditorProvider.ts:308`) | "Installing SpecKit Companion — re-run New Spec once it finishes to use the Companion workflow." | Choosing Install in #7 — the spec you were writing is abandoned | Auto-dismisses | Only after #7 |
| 9 | Fallback warning — Create Spec (`src/features/spec-editor/specEditorProvider.ts:105`) | "…which is not installed — creating this spec with the standard SpecKit flow instead." + **Install spec-kit Extension** | A Companion create downgrades to stock | **None** | Every downgraded create |
| 10 | Fallback warning — pipeline step (`src/features/specs/dispatchStep.ts:70`) | "…which is not installed — running the standard SpecKit flow instead." + **Install spec-kit Extension** | Every Companion step dispatch that falls back | **None**, and no per-session guard | Once per step — a four-step run raises it four times |
| 11 | Auto unavailable warning (`src/features/spec-editor/specEditorProvider.ts:152`) | "Auto needs the companion spec-kit extension… install it, then use Auto to build the whole spec hands-off." | Pressing Auto without the extension | **None** | Every Auto press |
| 12 | Resume unavailable warning (`src/features/specs/specCommands.ts:333`) | "Resume needs the companion spec-kit extension… install it, then resume the spec from where it left off." | Resume invoked without the extension (the inline icon is hidden, so mostly the command palette) | **None** | Every invocation |
| 13 | Specs title "…" menu item (`package.json:841`) | "Install Companion Extension" | `(detected \|\| cliInstalled) && !installed` | N/A — a menu entry | Passive |
| 14 | Upgrade… quick pick entry (`src/speckit/cliCommands.ts:51`) | "Update spec-kit Extension — Install or force-update the companion spec-kit extension (Turbo + Capture)" | User runs Upgrade…. Listed whether installed or not | N/A — user-initiated | Passive |
| 15 | Steering inline install icon (`package.json:718`) | Inline `$(desktop-download)` on the Companion header row | **Never.** The `when` needs `!companion.installed`, but the header node is only built when `isCompanionInstalled()` is true (`steeringExplorerProvider.ts:867`) | N/A — dead config | Never |

Three dismissal mechanisms with no relationship to each other:

- `speckit.installNudgeDismissed` (global state) — covers #1 and #4 only.
- `speckit.installBannerDismissed` (global state) — covers #5 and #6 only.
- `speckit.companion.installPrompt` (setting, default `true`) — covers #5 and #6 only. Its description says "The banner shows whenever the extension is missing and you haven't turned this off or dismissed it", which is true of the banners and false of everything else.

Nothing turns off #2, #3, or #7–#12.

## The honest read

**Four pitches before the user has typed a character.** Open a spec-kit project without the extension and you get, in this order: the badge (instant), the activation toast (seconds later), the Specs view welcome block or the pinned CTA row, and — the moment you click "Create your first spec" — the banner at the top of the Create Spec panel. Submit that spec and a fifth arrives as a *modal* that blocks the submit and can throw the draft away. That is five separate asks in the first minute of the first session, from a product the user has already chosen to install once.

**#5 and #6 are the same sentence twice.** Byte-for-byte identical copy, same buttons, same shared dismissal flag. Two render paths for one message. That is not two nudges, it is one nudge shipped from two files — worth collapsing into a single shared component rather than deleting.

**#9 and #10 are the same message rewritten.** "…creating this spec with the standard SpecKit flow instead" versus "…running the standard SpecKit flow instead". Same event class, same button, two hand-maintained strings. #10 has no per-run guard, so a Companion run without the extension raises it once per step.

**Three cannot be dismissed at all.** The badge (#2) and the pinned CTA row (#3) deliberately ignore both the dismissal flag and the setting, and the modal (#7) has no permanent opt-out and reappears on every submit. A user who clicked "Don't show again" on the activation toast still has the badge lit, the pinned row at the top of their tree, and the modal waiting on their next submit. "Don't show again" is not true, and that is the part that reads as aggressive rather than merely plentiful.

**Two are noise that should just go.** #15 is unreachable and should be deleted. #14's description still says "Turbo + Capture", a name the rest of the product retired.

**Verdict: yes, this is too aggressive — but the fix is small.** The volume is not the real problem; the un-dismissability is. The ambient surfaces (#2, #3, #13) are fine forever — a badge and a tree row are how VS Code says "there is something here", and they cost nothing. What crosses the line is stacking a session toast, a welcome block, a panel banner, *and* a blocking modal on top of those, none of which agree on what "dismissed" means.

**If I could keep one, I would keep the modal (#7)** — with the important change that "Use SpecKit Instead" should be remembered. It is the only nudge that fires at a moment where the user has actually asked for something the extension provides, it explains the trade honestly, and it offers a real alternative instead of just a link. Every other prompt is interrupting someone who has not yet expressed the need.

Concretely, if this were being trimmed: keep #7 (remembering the choice) and the ambient #2/#3; keep #5/#6 as one component behind their existing dismissal; drop the activation toast (#1) and the welcome block (#4) — between them and the badge, the same message is delivered three times on open; merge #9 into #10 and give it a once-per-run guard; delete #15.

## When you change one

Update the story in `webview/src/install-nudges/__stories__/InstallNudges.stories.tsx` and the table above in the same change. The story carries the source line for each surface, so a moved nudge shows up as a stale caption.
