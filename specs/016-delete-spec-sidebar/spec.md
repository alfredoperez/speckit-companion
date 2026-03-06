# Feature Spec: Delete Spec from Sidebar on Hover

**Feature**: Add an inline delete button that appears when hovering over a spec name in the sidebar.

## Problem

The only way to delete a spec is through the right-click context menu. This is not discoverable — users don't know it exists until they right-click.

## Goal

Show a trash icon button inline on the spec row when the user hovers over it, so delete is immediately visible and accessible.

## User Story

As a developer, when I hover over a spec name in the SpecKit sidebar, I see a trash icon button that I can click to delete the spec (with confirmation), so I don't have to right-click to discover the action.

## Acceptance Criteria

1. Hovering over a spec name row shows a trash `$(trash)` icon button inline
2. Clicking the button triggers the existing delete confirmation dialog
3. The delete action still appears in the right-click context menu
4. The icon is only shown for spec root items (not for spec documents like spec.md, plan.md, tasks.md)
