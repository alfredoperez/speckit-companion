# Avatar Rendering

## Purpose

A member's avatar appears in the directory, on profiles and beside every comment. This capability owns how an avatar is drawn at each size and what shows when there is no photo, so the same member looks the same everywhere.

## Requirements

### The avatar asks for the smallest variant that fits

The component MUST request the smallest stored variant that covers its rendered size.

#### Scenario: an avatar renders at 32 pixels

- **WHEN** the image URL is built
- **THEN** it names the 64 pixel variant, not the original

### A member without a photo gets their initials

A member with no photo SHALL be drawn as their initials on a colour derived from their id.

#### Scenario: a new member appears in the directory

- **WHEN** the member has never uploaded a photo
- **THEN** their initials render on the same colour on every screen

### A failed image falls back to initials

An avatar whose image fails to load MUST fall back to the initials placeholder.

#### Scenario: the variant URL returns an error

- **WHEN** the image fails to load
- **THEN** the initials placeholder replaces it without a broken image icon

### Every avatar names its member

An avatar SHALL carry the member's display name as its accessible name.

#### Scenario: a screen reader reaches an avatar

- **WHEN** the avatar is announced
- **THEN** the member's display name is read
