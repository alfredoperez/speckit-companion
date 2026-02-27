# Spec: Spec Create CTA Button Cleanup

**Branch**: 001-spec-create-cta | **Date**: 2026-02-27

## Summary

The "Create Spec" window currently shows a "Submit to AI" button and a "Preview" button in the footer. The submit button should be relabeled to just "Submit" (it already has primary styling), and the Preview button should be removed to simplify the CTA.

## Requirements

- **R001** (MUST): Rename the submit button label from "Submit to AI" to "Submit"
- **R002** (MUST): Remove the Preview button from the footer
- **R003** (MUST): Remove the preview button event listener from the webview script

## Scenarios

### Submit button is the clear CTA

**When** the user opens the Create Spec window
**Then** only "Cancel" and "Submit" buttons appear in the footer, with Submit styled as the primary action

### No preview button

**When** the user inspects the footer
**Then** there is no Preview button visible or functional

## Out of Scope

- Removing server-side `handlePreview` logic from the provider (dead code cleanup, not required)
- Changes to keyboard hints or other footer elements
