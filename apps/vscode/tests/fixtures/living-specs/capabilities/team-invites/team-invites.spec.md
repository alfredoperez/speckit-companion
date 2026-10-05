# Team Invites

## Purpose

A workspace grows by invitation. This capability owns how an invite is issued, how long it lasts, and what happens when it is accepted, so that joining a team works the same way from every screen that offers it.

## Requirements

### Only admins issue invites

An invite MUST be created only by a workspace admin.

#### Scenario: a regular member opens the invite form

- **WHEN** the form is submitted
- **THEN** the request is refused and no invite is stored

### An invite expires after seven days

An invite SHALL stop working seven days after it was issued.

#### Scenario: an invite link is opened on day eight

- **WHEN** the link is followed
- **THEN** the page says the invite expired and offers to ask for a new one

### An invite is accepted once

An accepted invite MUST NOT be usable a second time.

#### Scenario: an accepted link is opened again

- **WHEN** the link is followed
- **THEN** the visitor is sent to sign in and no second membership is created

### Revoking an invite takes effect at once

A revoked invite SHALL be refused from the moment it is revoked.

#### Scenario: an admin revokes a pending invite

- **WHEN** the invited person follows the link afterwards
- **THEN** the page says the invite is no longer valid
