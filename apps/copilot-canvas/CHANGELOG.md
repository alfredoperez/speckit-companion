# Changelog — SpecKit Companion for the GitHub Copilot app

Changes to the **Copilot app canvas** are listed here. It is versioned on its own in `package.json`; the VS Code extension's changelog is at the repo root: [`../../CHANGELOG.md`](../../CHANGELOG.md).

## [Unreleased]

### Fixed

- **A button's command now runs its own steps on every model.** With some models, New spec and the run buttons sent a command the agent never loaded: it wrote the spec by hand and, on Auto, built the change with no plan or tasks. The message now names the file that holds the command's steps, and the run instructions say they add to the command instead of replacing it.
  <!-- area: copilot-app; issue: 817 -->

## [0.1.0] - 2026-09-30

First version.

### Highlights

#### A spec board for the GitHub Copilot app
Open the SpecKit Companion canvas beside the chat to see every spec with its pipeline, task progress and the same Overview the VS Code viewer shows, updating live as the agent works. Buttons run the next step, and New spec asks for a workflow (Companion, Spec Kit or Auto) the way VS Code does. Opening the board tells the agent to wait for your next instruction instead of starting work.
<!-- area: copilot-app; pr: 787 -->
