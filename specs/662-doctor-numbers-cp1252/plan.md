# Implementation Plan: Doctor flags shared spec numbers; status survives a legacy console

## Summary

`check_numbering` in `doctor_checks.py` groups the spec folders beside the one being checked by their leading number (one to seven digits), reports groups of two or more, and runs once per specs folder per run like `check_agents`. It joins `CHECKS` in `doctor.py`. In `status-context.py`, the `RESOLUTION` JSON is ASCII-escaped, and `_console_safe` swaps the arrow and dash for ASCII and sets `errors="replace"` when stdout cannot encode them.

## Key Decisions

- **Seven digits or fewer is a sequence number.** A date or timestamp prefix has eight or more.
- **Swap only when the console cannot encode.** UTF-8 output is unchanged.
