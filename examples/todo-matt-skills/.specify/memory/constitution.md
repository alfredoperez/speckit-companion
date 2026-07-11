<!--
SYNC IMPACT REPORT
==================
Version change: (new) → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (5): Type Safety First, Component-First Architecture,
    Test-First Development, Simplicity, Code Quality Standards
  - Technology Standards section
  - Development Workflow section
  - Governance section
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (no changes needed - Constitution Check section already present)
  - .specify/templates/spec-template.md ✅ (no changes needed - user stories aligned with TDD principle)
  - .specify/templates/tasks-template.md ✅ (no changes needed - test-first workflow documented)
  - .specify/templates/checklist-template.md ✅ (no changes needed - general template)
  - .specify/templates/agent-file-template.md ✅ (no changes needed - placeholder template)
Follow-up TODOs: None
==================
-->

# Todo Test App Constitution

## Core Principles

### I. Type Safety First

All code MUST leverage TypeScript's type system to prevent runtime errors and improve developer experience.

- TypeScript strict mode MUST be enabled (`"strict": true` in tsconfig.json)
- No use of `any` type unless explicitly justified in code comments
- All function parameters and return types MUST be explicitly typed
- Props interfaces MUST be defined for all React components
- Type assertions (`as`) SHOULD be avoided; prefer type guards instead

**Rationale**: TypeScript's compile-time type checking catches bugs before they reach users and provides better IDE support for refactoring.

### II. Component-First Architecture

The codebase MUST be organized around reusable, isolated React components.

- Each component MUST have a single, well-defined responsibility
- Components MUST be independently testable without requiring parent context
- Shared state MUST be lifted to the appropriate parent or managed via hooks
- Component props MUST be the primary interface for data flow
- Side effects MUST be isolated in custom hooks or dedicated service modules

**Rationale**: Component isolation enables parallel development, simplifies testing, and improves code maintainability.

### III. Test-First Development (TDD)

Tests MUST be written before implementation code following the Red-Green-Refactor cycle.

- **Red**: Write a failing test that defines expected behavior
- **Green**: Write the minimum code necessary to pass the test
- **Refactor**: Improve code quality while keeping tests passing

This principle is NON-NEGOTIABLE for:
- New features (as defined in spec.md user stories)
- Bug fixes (regression test required)
- API contract changes

**Rationale**: TDD ensures code correctness from the start and creates a safety net for future changes.

### IV. Simplicity (YAGNI)

Code MUST be as simple as possible while meeting current requirements.

- MUST NOT implement features "for the future" - solve today's problems
- MUST NOT add abstractions until a pattern repeats at least three times
- MUST prefer duplication over premature abstraction
- MUST avoid over-engineering configuration or extensibility
- External dependencies SHOULD be minimized; prefer built-in solutions

**Rationale**: Simple code is easier to understand, debug, and modify. Unnecessary complexity creates maintenance burden.

### V. Code Quality Standards

All code MUST maintain consistent quality and follow established patterns.

- Code MUST pass linting (ESLint) without warnings
- Code MUST be formatted consistently (Prettier)
- Functions SHOULD be small (under 30 lines) and focused
- Magic numbers and strings MUST be extracted to named constants
- Error handling MUST be explicit; silent failures are forbidden

**Rationale**: Consistent code quality reduces cognitive load and makes the codebase accessible to all contributors.

## Technology Standards

**Stack Requirements**:
- **Language**: TypeScript 5.x with strict mode
- **Framework**: React 18+ with functional components and hooks
- **Build Tool**: Vite
- **Package Manager**: npm
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier

**Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)

**Performance Targets**:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle size: < 200KB gzipped for initial load

## Development Workflow

**Feature Implementation**:
1. Review feature spec in `.specify/specs/{feature}/spec.md`
2. Write failing tests for acceptance criteria
3. Implement minimum viable solution
4. Refactor while maintaining green tests
5. Update relevant documentation

**Code Review Requirements**:
- All changes MUST pass CI checks (lint, type-check, tests)
- Changes MUST be reviewed before merge
- Reviewers MUST verify adherence to constitution principles

**Branch Strategy**:
- `main`: Production-ready code
- `feature/{name}`: Feature development branches
- All features branch from and merge to `main`

## Governance

This constitution supersedes all informal practices and serves as the authoritative source for development standards.

**Amendment Process**:
1. Propose amendment with rationale
2. Document impact on existing code
3. Update affected templates and documentation
4. Version bump following semantic versioning:
   - MAJOR: Principle removal or incompatible redefinition
   - MINOR: New principle or material expansion
   - PATCH: Clarifications or typo fixes

**Compliance**:
- All pull requests MUST be verified against constitution principles
- Violations MUST be documented and justified in Complexity Tracking section of plan.md
- Periodic reviews SHOULD assess codebase alignment

**Version**: 1.0.0 | **Ratified**: 2025-12-02 | **Last Amended**: 2025-12-02
