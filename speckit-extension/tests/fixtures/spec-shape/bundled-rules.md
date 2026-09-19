# Bundled rules

## Requirements

### Installing the extension

The install MUST run the CLI's own add command. The target MUST live in one place. A first install MUST NOT pass the overwrite flag. An update MUST pass it. The probe SHOULD be retried on the next click.

#### Scenario: the user installs
- **WHEN** the install runs
- **THEN** the CLI's add command is used
