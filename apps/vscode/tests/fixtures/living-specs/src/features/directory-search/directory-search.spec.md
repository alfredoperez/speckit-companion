# Directory Search

## Purpose

The directory is how a Teamboard member finds a colleague. This capability owns what a search matches, how results are ordered, and which members a searcher is allowed to see, so that every search box in the product answers the same question the same way.

## Requirements

### A search matches name, role and team

A query MUST be matched against a member's display name, role and team name.

#### Scenario: a member searches for a team name

- **WHEN** the query equals a team's name
- **THEN** every active member of that team is returned

### Matching ignores case and accents

Matching SHALL ignore letter case and diacritics.

#### Scenario: a member types a name without its accent

- **WHEN** the query is "jose"
- **THEN** the member named "José" is returned

### Exact name matches rank first

Results MUST be ordered with exact display name matches first, then prefix matches, then the rest.

#### Scenario: two members share a first name

- **WHEN** the query is one member's full name
- **THEN** that member is the first result

### Deactivated members are left out by default

A search SHALL exclude deactivated members unless the searcher asks for them.

#### Scenario: a member searches for a colleague who left

- **WHEN** the include inactive filter is off
- **THEN** the colleague is not in the results

### Results never cross workspaces

A search MUST return only members of the searcher's workspace.

#### Scenario: the same name exists in two workspaces

- **WHEN** a member searches for it
- **THEN** only the member from their own workspace is returned

### An empty query returns the searcher's team

An empty query SHALL return the searcher's own team, ordered by name.

#### Scenario: the directory opens with no query

- **WHEN** the page loads
- **THEN** the searcher's teammates are listed alphabetically
