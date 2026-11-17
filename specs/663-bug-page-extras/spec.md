# Feature Specification: The bug page shows the whole folder and real times

**Source**: #930 (w40, w38)

## User Scenarios & Testing

### User Story 1 - Every report in a bug folder has a tab (Priority: P3)

`evidence.md` and any other markdown an agent wrote in a bug folder get their own tab after Test, evidence first. A Source that is a URL becomes a Tracker link; any other Source stays text.

**Acceptance Scenarios**:

1. **Given** a bug folder with `evidence.md` and `notes-from-agent.md`, **When** the page opens, **Then** both appear as tabs, evidence first.
2. **Given** `Source: https://…/issues/88`, **When** the Story renders, **Then** the facts line ends with a Tracker link; `pasted text` or a script URL stays text.

### User Story 2 - Same-day steps show times and durations (Priority: P3)

When a report header carries only a day, each Story step shows the time its file was written on this machine and how long after the previous step, labelled as a machine time. A header with a full timestamp wins.

**Acceptance Scenarios**:

1. **Given** three reports dated the same day and written 39 s and 2 min apart, **When** the Story renders, **Then** steps read "Oct 1, 2026, 10:04 AM · 39s later · time from this machine".
2. **Given** a header with a full timestamp, **When** the Story renders, **Then** that step uses it and has no machine label.

## Requirements

- **FR-001**: A bug folder's other `.md` files MUST appear as tabs after the known reports, evidence first; idea folders are unchanged.
- **FR-002**: A Source that is an http(s) URL passing `safeUrl` MUST render as a Tracker link; anything else stays text.
- **FR-003**: A day-only header MUST fall back to the file's write time, show the step's time and its gap from the previous step, and say the time is from this machine; a full timestamp in the header wins.
