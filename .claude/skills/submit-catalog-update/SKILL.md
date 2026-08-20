---
name: submit-catalog-update
description: File the spec-kit community-catalog update for the `companion` extension as an Extension Submission ISSUE on github/spec-kit (never a PR — direct catalog PRs are rejected). Renders the issue body from the LIVE upstream issue-form template so our headings can't drift from theirs. Minor and major releases only. Use when the user says "/submit-catalog-update", "update the catalog", "file the catalog issue", "the catalog is stale", or right after /publish-speckit-ext cuts a minor or major spec-kit-extension release.
allowed-tools: Bash(gh *), Bash(curl *), Bash(python3:*), Bash(git *), Bash(unzip *), Bash(mkdir *), Bash(uname *), Bash(specify *), Read
---

# Submit a community-catalog update

The catalog entry for `companion` is version-pinned, so a release only reaches catalog users once the entry is bumped. This files that bump.

Deliberately no `Edit`/`Write`: this skill writes to a third-party repository and must not be able to mutate ours.

## Hard-won rules (do not skip)

1. **Never open a PR against `extensions/catalog.community.json`.** github/spec-kit#3937 was closed unmerged — *"Updates to extensions must use the extension submission issue template."* The publishing guide is explicit: *"Do not open a pull request directly to edit `extensions/catalog.community.json`."* Both first listings and version updates go through the **[Extension Submission] issue**. If you find yourself typing `gh pr create` against `github/spec-kit`, you are in the wrong workflow.
2. **Never hardcode the `###` headings.** GitHub serializes an issue form as `### <label>` / blank / value, and maintainers' validation parses that. `render_submission.py` fetches the live `.github/ISSUE_TEMPLATE/extension_submission.yml` and renders from its labels — including the `(optional)` suffixes. If it cannot fetch the template it aborts; it never falls back to a remembered shape, because that fallback is the failure this skill exists to prevent.
3. **The download URL is the version-pinned asset** — `…/releases/download/speckit-ext-v$V/companion-$V.zip`. Never `companion-latest/companion.zip`: the catalog requires the declared version to equal the downloaded bits. This issue body is the only place a pinned URL belongs, and it is generated into a scratch dir, never committed.
4. **Minor and major only.** A patch does not touch the catalog; patch users ride `companion-latest`. Compare against the catalog's *current pin*, not against `.0` — going 0.11.0 → 0.20.2 is a minor bump and correctly pins at the newest patch of the new line.
5. **Never rebuild the catalog JSON.** The script deep-copies the live entry and applies deltas, because that entry carries `verified`, `downloads`, `stars`, and `created_at` which exist nowhere in `extension.yml`. Rebuilding drops them and reads as a destructive edit.
6. **Do not pass `--label`.** We hold only `pull` on github/spec-kit; `gh issue create --label` errors for a user without triage rights and nothing gets filed. Maintainers apply `extension-submission` at triage — that is the documented flow.
7. **`--body-file`, never `--body`.** The body carries em dashes, backticks, `$`, and fenced blocks.

## Steps

1. **Resolve the version.** `V` = `extension.version` from `speckit-extension/extension.yml`. Everything keys off it; the script aborts if it disagrees with what you pass.

2. **Confirm the shape of the run.** Working tree clean and on `main`; `speckit-ext-v$V` exists as a release; the pinned asset returns 200 and unzips to a single `companion-$V/` whose manifest reports `$V`:
   ```bash
   git status --porcelain && git branch --show-current
   gh release view speckit-ext-v$V --json tagName
   curl -sIL -o /dev/null -w '%{http_code}\n' \
     https://github.com/alfredoperez/speckit-companion/releases/download/speckit-ext-v$V/companion-$V.zip
   ```

3. **Read the cadence verdict.** Fetch the live entry's `version`. If `$V` is only a patch ahead of it, **stop** and say patch fixes ride `companion-latest`. If the entry already carries `$V`, stop — nothing to submit. If there is no `companion` entry at all, this is a first listing, not an update: say so and confirm before continuing.

4. **Check for a duplicate before doing any work.** Two passes, because titles get reworded but field values do not:
   ```bash
   gh issue list --repo github/spec-kit --state all --limit 100 \
     --search 'in:title "[Extension]" "Companion" author:@me' --json number,title,state,url,body
   ```
   Then parse the value under the live template's `Version` heading out of each hit. Any issue — open or closed — already carrying `$V` means it is filed; stop. An **open** issue for an older version is still in triage, so comment on it rather than opening a second.

5. **Review the drift diff.** Run the renderer and read `report.json`'s `catalog_now` against `proposed`. Get explicit approval for anything that is not a version bump — `description`, `tags`, and `category` are editorial changes and must never ride along silently.

6. **Draft the two human fields.** `Key Features` is seeded from every `## [x.y.z]` section of `speckit-extension/CHANGELOG.md` strictly between the catalog's pin and `$V` — everything the catalog has never seen. Five to eight bullets, `**Bold lead** — what it means for a user`. Every bullet must trace to a changelog line or a shipped command; invent nothing. `Example Usage` is raw content with **no inner fence** (the template already wraps it in ```` ```markdown ````, and the accepted #2926 submission has no nested fence). `Testing Details` states what was actually run — `uname -sr`, `specify --version`, and the real scenarios.

7. **Attestation gate — ask once.** The script mechanically proves the manifest, README, LICENSE, release, command files, and id convention. It cannot prove: all commands execute without errors · documentation is complete and accurate · no security vulnerabilities identified · tested on at least one real project. List those four, plus a confirmation that Testing Details describes what actually happened, and require an explicit yes. Anything else aborts. Never tick an attestation the user did not give.

8. **Render.**
   ```bash
   python3 .claude/skills/submit-catalog-update/render_submission.py \
     --version $V --root . --category process --description "<catalog copy>" \
     --features-file $S/features.md --example-file $S/example.md \
     --testing-details-file $S/testing.md --context-file $S/context.md \
     --attest yes --auto-checks-passed yes \
     --out-body $S/body.md --out-title $S/title.txt --out-report $S/report.json
   ```
   `--category`/`--description` default to the live values; pass them only for a deliberate change. Exit 3 means the template grew a required field the script cannot fill — read the message, add a filler, re-run. Never work around a gate.

9. **Show the full body and title verbatim.** No summarizing. Confirm by eye: headings carry the `(optional)` suffixes; the catalog fence is `json` and preserves `verified`/`downloads`/`stars`/`created_at`; the download URL is pinned; every required checkbox is `[x]`. Cheap cross-check — the heading set should be identical to the accepted submission:
   ```bash
   diff <(gh issue view 2926 --repo github/spec-kit --json body --jq .body | grep '^### ' | sort) \
        <(grep '^### ' $S/body.md | sort)
   ```

10. **Re-check for duplicates**, then file:
    ```bash
    gh issue create --repo github/spec-kit \
      --title "$(cat $S/title.txt)" --body-file $S/body.md
    ```

11. **Verify what landed.** Diff the stored body against what you sent, normalizing trailing newlines — GitHub appends one, which is not mangling:
    ```bash
    diff <(sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' $S/body.md) \
         <(gh issue view <n> --repo github/spec-kit --json body --jq .body | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
    ```
    Any real difference means the create path mangled something.

12. **Report** the issue URL, the version transition, the template SHA rendered against, and any drift the report listed. Say plainly that maintainers apply `extension-submission` at triage, which starts automated validation — no label request, no follow-up PR — and that existing users are unaffected meanwhile because they update through `companion-latest`.
