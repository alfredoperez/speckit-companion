# Wait for the Shell — Living Spec

## Purpose

A terminal opened for a command is not ready the moment it appears: the user's startup files run first, and some of them ask a question, such as oh-my-zsh's "Would you like to update? [Y/n]". Whatever is typed into that question becomes its answer, so `claude` runs as `laude` and the step never starts. This is how every command the extension types into a terminal waits for the shell, for as long as the person takes, and how they can send it themselves.

## Requirements

### Nothing is typed into a shell that is not at its prompt
<!-- touches: apps/vscode/src/core/utils/terminalUtils.ts, apps/vscode/src/ai-providers/aiProvider.ts, apps/vscode/src/ai-providers/cliTerminalProvider.ts, apps/vscode/src/ai-providers/claudeCodeProvider.ts, apps/vscode/src/ai-providers/geminiCliProvider.ts, apps/vscode/src/ai-providers/wibeyCliProvider.ts -->

Every command the extension runs in a terminal SHALL wait until the shell is at its prompt. In bash, zsh, fish or PowerShell with shell integration on, nothing SHALL be typed until integration activates, however long that takes, and the command SHALL then run through integration.

#### Scenario: the shell asks to update before its first prompt
- **WHEN** Plan is dispatched and the new terminal's shell is waiting on "Would you like to update? [Y/n]"
- **THEN** nothing is typed until the user answers, and then the whole `claude …` line runs

#### Scenario: the user answers after more than a minute
- **WHEN** Run Setup opens the SpecKit - Constitution terminal on the same question and the user answers it ninety seconds later
- **THEN** nothing was typed in the meantime, and the constitution command runs whole the moment the shell reaches its prompt

### A waiting shell offers a Run button
<!-- touches: apps/vscode/src/core/utils/terminalUtils.ts -->

While a shell that reports readiness keeps a command waiting, a notice SHALL appear after a couple of seconds saying, in one short sentence, that the terminal is waiting for an answer, with a **Run** button that types the command at once. A Run item naming the terminal SHALL stay in the status bar until the wait ends, so a dismissed or unseen notice never strands the command. A hidden terminal SHALL be shown alongside the notice so its question can be answered.

#### Scenario: the user clicks Run
- **WHEN** the notice is up and the user clicks **Run**
- **THEN** the command is typed into the terminal at once, and is not run a second time if the shell reports ready afterwards

#### Scenario: the user dismissed the notice
- **WHEN** the notice was closed and the shell still holds the command
- **THEN** the status bar still offers Run, and it disappears once the command has run

### A terminal closed before its shell is ready fails the dispatch
<!-- touches: apps/vscode/src/core/utils/terminalUtils.ts -->

Closing the terminal while its shell still holds the command SHALL fail the dispatch with nothing typed, so a step started for it is put back, and its prompt files SHALL still be removed.

#### Scenario: the user closes the waiting terminal
- **WHEN** Plan's terminal is closed before the shell reached its prompt
- **THEN** no command is typed, and Plan is no longer shown as running

### A shell that cannot report it is ready gets the command after a short wait
<!-- touches: apps/vscode/src/core/utils/terminalUtils.ts -->

Any shell other than bash, zsh, fish or PowerShell, any shell with integration turned off, and an editor without the shell integration API SHALL get the command typed after a few seconds, with no notice.

#### Scenario: shell integration is turned off
- **WHEN** `terminal.integrated.shellIntegration.enabled` is false
- **THEN** the command is typed after a few seconds, and no exit code is available for it

### A second command waits for the first
<!-- touches: apps/vscode/src/core/utils/terminalUtils.ts -->

A second command for the same terminal SHALL wait, for a few seconds at most, for the first to finish, since integration interrupts a running command.

#### Scenario: two commands in one terminal
- **WHEN** a checkpoint commits and then opens a pull request in the same terminal
- **THEN** the pull request command starts only once the commit has finished, or after a few seconds if it never reports finishing

## Uncovered

- A notice whose shell became ready on its own stays in the notification centre, because the editor cannot close it; clicking Run on it then does nothing.
