# Implementation Plan: Status is a script, not a summary

## Summary

Add `--plain` to `status-context.py`: it drops the `RESOLUTION:` line and prints "No active spec found." on stdout when no spec resolves. Rewrite the status command body to run `status-context.py --plain` and print its output unchanged. Resume keeps the default output.

## Key Decisions

- **A flag, not a second script.** The resolver already builds the human lines; the flag only hides the machine line. Rejected: a new script.
- **Mark-complete stays as it is.** Its body is already one script call with no summary.
