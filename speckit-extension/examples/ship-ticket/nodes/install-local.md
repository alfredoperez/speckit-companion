---
id: install-local
kind: control
---
## Ship · reinstall + report

> **Scratch-only.** On a throwaway run, skip the real reinstall and just report.

1. Sync `main`: `git checkout main && git fetch origin && git pull --ff-only`.
2. Run `/install-local` so the workspace ends current, then drop the throwaway version bump: `git restore package.json package-lock.json .specify/`.
3. **If the branch touched `speckit-extension/**`,** the spec-kit extension also needs a `--dev` reinstall so the new `/speckit.companion.*` commands resolve:
   ```bash
   specify extension remove companion
   specify extension add ./speckit-extension --dev
   git restore .specify/   # gitignored dev-install copies — never commit these
   ```
4. Journal progress and finish:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step implement --status implemented --substep ship-install --kind complete --by ai
   ```
5. End with a tight summary: issue shipped, PR link, merged / in-review / blocked, new version, whether the spec-kit extension was reinstalled, and a 🖐️ manual-verification list.
