#!/usr/bin/env python3
"""The PASS/FAIL/WARN/INFO report shared by the check_* evals.

`add` takes either the legacy `bool | None` shorthand (`check_capture.py` and
`check_living_spec.py`: True/False/None → PASS/FAIL/INFO) or an explicit status
string (`check_quality.py`, the only caller that needs WARN). Both land in the
same `rows`/`to_text`/`to_dict` shape, so a caller reading `Report.to_dict()`
never has to know which eval produced it.

Stdlib only.
"""
from __future__ import annotations

_LEGACY_STATUS = {True: "PASS", False: "FAIL", None: "INFO"}
_STATUSES = ("PASS", "WARN", "FAIL", "INFO")


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []  # (status, id, detail)

    def add(self, status: bool | str | None, cid: str, detail: str) -> None:
        if not isinstance(status, str):
            status = _LEGACY_STATUS[status]
        # A status this class does not know would vanish from the tally and blow
        # up the render, so it is refused where it was written, not where it is read.
        if status not in _STATUSES:
            raise ValueError(f"unknown status {status!r} for {cid}; expected one of {_STATUSES}")
        self.rows.append((status, cid, detail))

    @property
    def failed(self) -> int:
        return sum(1 for s, _, _ in self.rows if s == "FAIL")

    @property
    def warned(self) -> int:
        return sum(1 for s, _, _ in self.rows if s == "WARN")

    def to_text(self) -> str:
        marks = {"PASS": "✓", "WARN": "!", "FAIL": "✗", "INFO": "·"}
        out = [f"  {marks[s]} [{s}] {c}: {d}" for s, c, d in self.rows]
        passes = sum(1 for s, _, _ in self.rows if s == "PASS")
        out.append("")
        out.append(f"  → {passes} pass / {self.warned} warn / {self.failed} fail / "
                   f"{sum(1 for s, _, _ in self.rows if s == 'INFO')} info")
        return "\n".join(out)

    def to_dict(self) -> dict:
        return {
            "checks": [{"status": s, "id": c, "detail": d} for s, c, d in self.rows],
            "failed": self.failed,
            "warned": self.warned,
        }
