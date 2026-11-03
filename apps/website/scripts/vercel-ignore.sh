#!/usr/bin/env bash
# Vercel's ignore step: exit 0 skips the build, exit 1 builds. Any other exit fails the deploy, so a git error builds.
[ "$VERCEL_GIT_COMMIT_REF" != "main" ] && exit 0
[ -z "$VERCEL_GIT_PREVIOUS_SHA" ] && exit 1
if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ../../content/media/web ../../content/media/manifest.json ../../assets/icons/moss.svg; then
  exit 0
fi
exit 1
