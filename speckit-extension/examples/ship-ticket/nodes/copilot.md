---
id: copilot
kind: control
---
## Ship · Copilot review (best-effort)

1. Request Copilot via the REST `requested_reviewers` API (the `gh pr edit --add-reviewer` form does not work):
   ```bash
   gh api -X POST "repos/<owner>/<repo>/pulls/<PR>/requested_reviewers" \
     -f "reviewers[]=copilot-pull-request-reviewer[bot]" >/dev/null 2>&1 \
     && echo "[copilot] requested" || echo "[copilot] unavailable — proceeding on /code-review only"
   ```
2. If requested, wait then poll (~4–5 min to first comment): `sleep 300`, then poll every ~90s for up to ~12 min for comments whose author matches Copilot.
3. Address actionable comments (fix, commit, push, re-run `npm test`), then **reply to and resolve each thread**. If nothing lands in ~10 min, log "Copilot timed out; relying on /code-review" and proceed. Copilot's absence is not an error.
4. Journal progress:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step implement --status implemented --substep ship-copilot --kind complete --by ai
   ```
