# Install nudges

Every place the VS Code extension asks you to install the companion spec-kit extension, in one list, with an honest read on whether it is too much. The three out-of-date surfaces at the end are their siblings: same slots, same install command, shown only when the extension is installed but behind the version this build ships.

To look at them: `SB_PORT=6031 npm run storybook`, then **Install nudges → Every surface**. Each story draws one surface and captions it with its source line; the last story stacks the ones a fresh, uninstalled workspace actually meets.

## The inventory

Eleven surfaces. Nine can fire; two are passive entries. Three were removed — the activation toast (#1), the welcome-block pitch (#4) and the dead Steering icon (#15) — and the two fallback warnings (#9, #10) became one. Three more, listed after them, fire only when the installed extension is out of date.

| # | Surface | Copy | Trigger | Dismissal | Recurs |
|---|---------|------|---------|-----------|--------|
| ~~1~~ | ~~Activation notification~~ | **Removed.** The badge and the pinned CTA row already say this, so the toast was the third delivery of one message before the user had done anything | — | — | Never |
| 2 | Activity-bar badge (`src/extension.ts:301`) | Blue `1` badge, tooltip "Install SpecKit Companion" | Companion missing | **None.** Ignores the dismissal flag *and* the `speckit.companion.installPrompt` setting | Permanent, always on screen |
| 3 | Pinned CTA row in Specs (`src/features/specs/specExplorerProvider.ts:133`) | "Get Companion — living specs, capture, fast-path" | Companion missing and at least one spec exists | **None.** Ignores the dismissal flag and the setting | Permanent, first row of the tree |
| ~~4~~ | ~~viewsWelcome install block~~ | **Removed.** There is one welcome block now, with no install pitch in it — the two variants differed only by the pitch | — | — | Never |
| 5 | Install banner — Create Spec (`src/features/spec-editor/installBanner.ts:14`) | "Install the spec-kit extension for the leaner `/speckit.companion.*` pipeline and capture." + **Install** / **Learn more** / × | Companion missing, `installPrompt` on, banner not dismissed | × → `speckit.installBannerDismissed`, a **separate** flag from #1/#4 | Every time the panel opens |
| 6 | Install banner — Activity panel (`webview/src/spec-viewer/components/ActivityPanel.tsx`) | **The same component as #5**, rendered from the exported `INSTALL_BANNER_BODY` rather than a hand-kept copy of it | Same as #5, plus the Activity panel being enabled | Same × and same flag as #5 — dismissing either clears both | Every spec you open |
| 7 | Blocking modal on submit (`src/features/spec-editor/specEditorProvider.ts`) | "SpecKit Companion adds living specs, full lifecycle capture, a fast-path for small changes, and hands-off Auto. Install it to enable the full workflow — or continue with standard SpecKit." + **Install** / **Use SpecKit Instead** / Cancel | Submitting Create Spec with the Companion workflow selected and the extension missing | **"Use SpecKit Instead" is remembered** (`speckit.companionDeclinedAtCreate`) and the modal never opens again. Escape still cancels the spec without answering | Once |
| 8 | "Re-run New Spec" toast (`src/features/spec-editor/specEditorProvider.ts:308`) | "Installing SpecKit Companion — re-run New Spec once it finishes to use the Companion workflow." | Choosing Install in #7 — the spec you were writing is abandoned | Auto-dismisses | Only after #7 |
| 9+10 | Fallback warning, one string (`src/features/specs/dispatchStep.ts`) | "The SpecKit Companion workflow needs the companion spec-kit extension, which is not installed — running the standard SpecKit flow instead." + **Install spec-kit Extension** | A Companion create or step dispatch that downgrades to stock. Both surfaces raise this one sentence through `warnCompanionFallback()` | Guarded for the session: whether the extension is installed is one fact about the workspace | **Once per session**, not once per step |
| 11 | Auto unavailable warning (`src/features/spec-editor/specEditorProvider.ts:152`) | "Auto needs the companion spec-kit extension… install it, then use Auto to build the whole spec hands-off." | Pressing Auto without the extension | **None** | Every Auto press |
| 12 | Resume unavailable warning (`src/features/specs/specCommands.ts:333`) | "Resume needs the companion spec-kit extension… install it, then resume the spec from where it left off." | Resume invoked without the extension (the inline icon is hidden, so mostly the command palette) | **None** | Every invocation |
| 13 | Command palette entry | "Install Companion Extension" | `(detected \|\| cliInstalled) && !installed`. The Specs "…" overflow menu that used to hold it is gone; the entry moved to the palette | N/A — user-initiated | Passive |
| 14 | Upgrade… quick pick entry (`src/speckit/cliCommands.ts`) | "Update spec-kit Extension — Install or force-update the companion spec-kit extension" | User runs Upgrade…. Listed whether installed or not | N/A — user-initiated | Passive |
| ~~15~~ | ~~Steering inline install icon~~ | **Removed.** It could never render: the `when` needed `!companion.installed`, but the header node is only built when `isCompanionInstalled()` is true | — | — | Never |

Out of date, not missing. The extension compares the version bundled in its own install (`speckit-extension/extension.yml` ships inside the `.vsix`) against the one in the installed manifest, `.specify/extensions/companion/extension.yml` (falling back to `.specify/extensions/.registry`, which lags a `--dev` link), locally and with no network call. The gap is resolved once at activation and again whenever either version file changes, and every surface reads that one answer. An unreadable version on either side reads as current: nothing here ever fires on a guess. A workspace with no extension at all keeps the install surfaces above and never sees these.

| # | Surface | Copy | Trigger | Dismissal | Recurs |
|---|---------|------|---------|-----------|--------|
| 16 | Status-bar item (`src/speckit/companionUpdateNudge.ts`) | Warning background, `$(arrow-circle-up) SpecKit commands out of date`; click runs the update | Installed and behind the bundled version, `installPrompt` on | Turning off `speckit.companion.installPrompt`; otherwise disappears when the versions match, re-checked by the same watcher that flips `speckit.companion.installed` | Always on screen while the gap exists |
| 17 | Update banner — Create Spec + Activity panel (`src/features/spec-editor/installBanner.ts`, `ActivityPanel.tsx`) | "SpecKit commands are 0.20.2, this extension expects 0.21.0." + **Update** / × | Installed and behind, `installPrompt` on, not dismissed for this expected version. Takes the install banner's slot: one or the other, never both | × → `speckit.companionUpdateSkippedVersion` = the expected version the banner itself was showing, so the next release asks again | Every panel open, until dismissed or updated |
| 18 | Activation notification (`src/speckit/companionUpdateNudge.ts`) | Same sentence + "Update the spec-kit extension to get the matching commands." + **Update** / **Skip this version** | Opening a workspace that is installed and behind, `installPrompt` on, the first time for that expected version (`speckit.companionUpdateNotifiedFor`, written once the toast is answered or closed, never before) | **Skip this version** → the same `speckit.companionUpdateSkippedVersion` the banner × writes | Once per expected version |

Three dismissal mechanisms with no relationship to each other:

- ~~`speckit.installNudgeDismissed`~~ — **gone.** It covered #1 and #4; with both removed nothing wrote it and nothing read it, so the flag, its context key and the dismiss command that set it were deleted.
- `speckit.installBannerDismissed` (global state) — covers #5 and #6 only.
- `speckit.companion.installPrompt` (setting, default `true`) — covers #5 and #6, and all three out-of-date surfaces (#16–#18). Its description says "The banner shows whenever the extension is missing and you haven't turned this off or dismissed it", which is true of the banners and false of everything else.

The out-of-date surfaces keep two keys on purpose. `speckit.companionUpdateSkippedVersion` is the user saying no to a version: **Skip this version** on the toast and × on the banner both write it, and it silences the banner and the toast alike. `speckit.companionUpdateNotifiedFor` only records that the toast was resolved for a version, so it never fires twice. The one intended difference: closing the toast without choosing writes the second key and not the first, so the banner stays.

Nothing turns off #2 or #3, and that is deliberate: a badge and a tree row are how VS Code says "there is something here". #7 is now answered once and remembered; #9+#10 is guarded for the session.

## The honest read

**A fresh uninstalled workspace now delivers two asks, not five.** The activity-bar badge on open, and the pinned CTA row in the Specs tree. Both are ambient, both are permanent, and neither interrupts anything. Everything else now fires only when the user has asked for something the extension provides.

**What changed, and why**

- **The activation toast is gone.** Between it, the badge and the pinned row, the same message arrived three times before the user had done anything.
- **The welcome block's install pitch is gone.** Its two variants differed only by that pitch, so there is one welcome block now and the empty state reads as a welcome rather than an ad.
- **The two banners are one component.** They were byte-for-byte identical copy in two files, kept in step by hand. The Preact panel renders the exported `INSTALL_BANNER_BODY` now.
- **The two fallback warnings are one sentence, raised once per session.** A four-step Companion run without the extension used to raise it four times. Whether the extension is installed is one fact about the workspace, so it is stated once.
- **The modal remembers "Use SpecKit Instead".** It is the one nudge that fires when the user has actually asked for something the extension provides, which is what earns it a modal — but a modal that reappears after being answered is not asking.
- **The dead Steering icon is deleted**, along with the retired "Turbo + Capture" name in the Upgrade… quick pick.

**What deliberately stays.** The badge (#2) and the pinned CTA row (#3) still ignore the dismissal flag and the setting. That is the right call for ambient affordances: they cost nothing, they never interrupt, and they are how the product says the extension exists at all. The claim that used to be false — that "Don't show again" turns things off — is now true of everything that interrupts.

## When you change one

Update the story in `webview/src/install-nudges/__stories__/InstallNudges.stories.tsx` and the table above in the same change. The story carries the source line for each surface, so a moved nudge shows up as a stale caption.
