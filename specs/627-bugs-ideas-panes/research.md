# Research: Bugs and Ideas panes

## One reader for both

**Decision**: A `ReportSet` descriptor (directory, ordered kinds, labels, title prefixes, panel prefix, fallback badge) with generic read and path functions. `bugReports.ts` keeps its exports and becomes a thin layer over it.

**Rationale**: `bugReports.ts` is already that shape with the constants inlined. Ideas need the same thing with five kinds.

**Alternatives considered**: Copying `bugReports.ts` for ideas. Two readers would drift.

## Keying on the directory, not the kind

**Decision**: Path helpers match on the set's directory.

**Rationale**: A bug report kind is called `assessment`, and the ideas directory is called `assessments`. Matching on names would confuse the two.

## The vocabulary on a row

**Decision**: Each field is matched against the values Spec Kit's own command files define, compared case-insensitively, and anything else is dropped.

**Rationale**: These values come from files a person or an assistant wrote. The reader passes raw text through today.

**Alternatives considered**: Showing raw text, truncated.

## One provider, two configurations

**Decision**: `ProcessPaneProvider` takes a config: the set, how to read items, the ordered groups and which group an item belongs to, the row's secondary text and icon, the extension id, the install label and the empty text.

**Rationale**: The two panes differ only in data.

## Install and empty rows are tree rows

**Decision**: When there is nothing to list, the provider returns one row: the install row if the extension folder is absent, an information row otherwise.

**Rationale**: The decision was a row in the pane. Living Specs uses welcome content, which needs context keys and cannot coexist with rows; one row is simpler and reads the same.

**Alternatives considered**: `viewsWelcome` with two context keys per pane.

## Is the extension installed

**Decision**: A probe that returns present, absent or unknown. Only "not found" is absent. Unknown is treated as present, so no install row is offered for a folder that could not be read.

**Rationale**: Offering an install for something that may already be there is the worse mistake.

## Installing

**Decision**: `runSpecifyExtensionAdd(id, root)` starts a visible terminal with the project folder as its working directory option and runs `specify extension add <id>`. The id comes from a two-value list.

**Rationale**: The companion installer is tied to companion's version probe and `--force` logic. The working-directory option, not a `cd`, is what keeps a folder name out of the command.

## Opening an idea

**Decision**: The viewer's bug path becomes a report path: panel state names the set, and the title prefix, the fallback badge, the default kind and the path checks come from the set. The read-only message allow-list is unchanged.

**Rationale**: Everything the bug panel switches off should be off for an idea too.

## Watching

**Decision**: One helper wires a watcher for a set's directory and refreshes its pane and any open report panel. A second watcher on the two extension folders refreshes both panes so an install row clears.

## The Specs tree

**Decision**: Bugs are removed from its root, its filter and its empty check. Its tests for bugs move to the new provider's tests.

**Rationale**: With bugs gone, the Specs welcome shows when there are no specs, which is what it says.
