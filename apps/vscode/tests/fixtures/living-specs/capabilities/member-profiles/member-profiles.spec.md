# Member Profiles

## Purpose

Every Teamboard member has one profile: a name, a role, a team and a short bio. This capability owns who may read a profile, who may change it, and what the rest of the product is allowed to assume about its fields. Without it, each screen would decide for itself what a member is.

## Requirements

### A member edits only their own profile

A profile update MUST be accepted only from the member it belongs to or from a workspace admin.

#### Scenario: a member opens another member's profile

- **WHEN** the viewer is neither the owner nor an admin
- **THEN** the profile renders read-only and the update endpoint refuses the change

### Display names are required and trimmed

A display name MUST contain at least one visible character and SHALL be stored without leading or trailing spaces.

#### Scenario: a member saves a name made of spaces

- **WHEN** the submitted name is empty after trimming
- **THEN** the save is rejected and the previous name is kept

### A profile always belongs to exactly one team

Every profile SHALL carry one team, and moving a member MUST replace the team rather than add a second one.

#### Scenario: an admin moves a member to another team

- **WHEN** the move is saved
- **THEN** the member appears under the new team only

### Role changes take effect on the next request

A changed role MUST apply to the member's next request without a new sign in.

#### Scenario: an admin removes a member's admin role

- **WHEN** the member loads any admin page afterwards
- **THEN** the page is refused

### Bios are plain text with a length limit

A bio SHALL be stored as plain text and MUST be rejected above 280 characters.

#### Scenario: a member pastes markup into the bio

- **WHEN** the bio is rendered on the profile page
- **THEN** the markup shows as literal text

### Deactivated members stay readable

A deactivated member's profile MUST remain readable to the workspace and SHALL be marked as inactive.

#### Scenario: a teammate opens a deactivated member's profile

- **WHEN** the profile loads
- **THEN** the fields render with an inactive label and no edit controls

### Profile reads never expose the email to other workspaces

The email field MUST be returned only to members of the same workspace.

#### Scenario: a guest from another workspace requests a profile

- **WHEN** the profile is returned
- **THEN** the email field is absent

### Concurrent edits do not overwrite each other

An update MUST carry the version it was based on, and a stale version SHALL be refused.

#### Scenario: two tabs save the same profile

- **WHEN** the second save arrives with the older version
- **THEN** it is refused and the member is asked to reload

### Every profile change is recorded

Each accepted update SHALL write who changed which field and when.

#### Scenario: an admin changes a member's team

- **WHEN** the change is saved
- **THEN** the audit entry names the admin, the field and the time
