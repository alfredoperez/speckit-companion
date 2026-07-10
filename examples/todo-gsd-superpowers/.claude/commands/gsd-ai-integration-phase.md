---
name: gsd-ai-integration-phase
description: Generate an AI-SPEC.md design contract for phases that involve building AI systems.
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - mcp__context7__*
requires: [phase]
---
<objective>
Create an AI design contract (AI-SPEC.md) for a phase involving AI system development.
Orchestrates gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner.
Flow: Select Framework → Research Docs → Research Domain → Design Eval Strategy → Done
</objective>

<execution_context>
@/Users/alfredoperez/dev/GitHub/speckit-companion/examples/todo-gsd-superpowers/.claude/gsd-core/workflows/ai-integration-phase.md
@/Users/alfredoperez/dev/GitHub/speckit-companion/examples/todo-gsd-superpowers/.claude/gsd-core/references/ai-frameworks.md
@/Users/alfredoperez/dev/GitHub/speckit-companion/examples/todo-gsd-superpowers/.claude/gsd-core/references/ai-evals.md
</execution_context>

<context>
Phase number: $ARGUMENTS — optional, auto-detects next unplanned phase if omitted.
</context>

<process>
Execute end-to-end.
Preserve all workflow gates.
</process>
