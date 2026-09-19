## Purpose

Scenarios whose keywords carry no emphasis. A person writing a spec by hand does this constantly, and it says exactly what the bold form says.

## Requirements

### A rule written without any emphasis

It MUST do the thing.

#### Scenario: plain keywords
- WHEN the thing is asked for
- THEN it is produced

#### Scenario: a plain GIVEN counts as the condition
- GIVEN the thing exists
- THEN it is produced

#### Scenario: a word that merely starts with a keyword is not one
- WHEN the thing is asked for
- THEN it is produced
- Whenever it is asked for again, the same holds
