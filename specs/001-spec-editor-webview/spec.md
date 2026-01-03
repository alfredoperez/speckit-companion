# Feature Specification: Spec Editor Webview

**Feature Branch**: `001-spec-editor-webview`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "Add a webview-based spec editor with multi-line text input, image attachments, and temporary markdown file storage for cross-CLI compatibility"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Spec with Rich Text Editor (Priority: P1)

A developer wants to create a new specification but needs more space and better editing capabilities than VSCode's simple input box provides. They open the spec editor webview where they can write detailed multi-line requirements with full text editing capabilities, preview what will be sent to the AI CLI, and submit when ready.

**Why this priority**: This is the core value proposition - replacing the limited single-line input with a rich editing experience that allows developers to write comprehensive specifications.

**Independent Test**: Can be fully tested by opening the spec editor, typing multi-line text, and verifying the content is correctly captured and displayed. Delivers immediate value as an improved input mechanism.

**Acceptance Scenarios**:

1. **Given** a developer has the SpecKit extension installed, **When** they trigger "Create New Spec" command, **Then** a webview panel opens with a multi-line text editor
2. **Given** the spec editor webview is open, **When** the developer types multi-line text with formatting, **Then** the text is preserved with line breaks and formatting intact
3. **Given** the developer has entered spec content, **When** they click "Preview", **Then** they see exactly what will be sent to the AI CLI
4. **Given** the developer is satisfied with their spec, **When** they click "Submit", **Then** the spec is sent to the active AI CLI provider

---

### User Story 2 - Attach Reference Images (Priority: P2)

A developer needs to reference mockups, diagrams, or screenshots when describing their specification. They can attach images to the spec editor, which are then included as references when the spec is sent to AI CLI providers that support image input.

**Why this priority**: Visual references significantly improve spec clarity and reduce ambiguity, but the core text editing functionality must work first.

**Independent Test**: Can be tested by attaching an image to the spec editor and verifying it appears in the editor and is correctly referenced in the output.

**Acceptance Scenarios**:

1. **Given** the spec editor is open, **When** the developer clicks "Attach Image" or drags an image into the editor, **Then** the image is added to the spec and displayed as a thumbnail
2. **Given** images are attached, **When** the developer previews the spec, **Then** they see the images and their placement relative to the text
3. **Given** the developer submits a spec with images, **When** the AI CLI supports images, **Then** the images are included in the prompt
4. **Given** the developer submits a spec with images, **When** the AI CLI does not support images, **Then** the user is warned and images are omitted gracefully

---

### User Story 3 - Automatic Temporary File Management (Priority: P2)

To work across different CLI providers (Claude Code, Gemini CLI, GitHub Copilot CLI), the spec content is saved as a temporary markdown file. This file contains the full spec text with image references, allowing any CLI to read it via file reference. Once the specification workflow is complete, the temporary file is automatically cleaned up.

**Why this priority**: Cross-CLI compatibility is essential for the extension's value proposition, tied with image support as both enable broader usability.

**Independent Test**: Can be tested by submitting a spec and verifying a temp markdown file is created, then completing the workflow and verifying the file is deleted.

**Acceptance Scenarios**:

1. **Given** the developer submits a spec, **When** the submission is processed, **Then** a markdown file is created in a temporary location with the spec content
2. **Given** images are attached, **When** the temp file is created, **Then** images are either embedded (base64) or stored alongside with relative references
3. **Given** the spec workflow completes (or is cancelled), **When** the developer closes the spec or workflow ends, **Then** all temporary files (markdown and images) are automatically deleted
4. **Given** VSCode is closed unexpectedly, **When** the extension reloads, **Then** orphaned temp files from previous sessions are cleaned up

---

### User Story 4 - Reuse Previous Spec as Template (Priority: P3)

A developer wants to create a new spec based on a previous one. They can load a previous spec into the editor to use as a starting point, saving time when creating similar specifications.

**Why this priority**: Nice-to-have feature that improves productivity but is not essential for core functionality.

**Independent Test**: Can be tested by loading a previous spec file into the editor and verifying the content is editable.

**Acceptance Scenarios**:

1. **Given** the spec editor is open, **When** the developer clicks "Load Previous Spec", **Then** they can browse and select from existing spec files in the workspace
2. **Given** a previous spec is loaded, **When** displayed in the editor, **Then** the content is fully editable and can be modified before submission

---

### Edge Cases

- What happens when the user closes the webview without submitting? Content is preserved in a draft state and restored when reopened.
- How does the system handle very large images? Images are resized/compressed to a reasonable size limit (e.g., 2MB per image, 10MB total).
- What happens if the temp directory is not writable? Fall back to an alternate location or show a clear error message with remediation steps.
- How does the system handle unsupported image formats? Only accept common formats (PNG, JPG, GIF, WebP) and show clear error for others.
- What if the user has multiple spec editors open? Each editor instance manages its own temporary files independently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a webview panel with a multi-line text editor for spec content
- **FR-002**: System MUST preserve text formatting (line breaks, indentation) in the editor
- **FR-003**: System MUST provide a preview mode showing the exact content that will be sent to the AI CLI
- **FR-004**: System MUST allow users to attach images via file picker or drag-and-drop
- **FR-005**: System MUST display attached images as thumbnails in the editor
- **FR-006**: System MUST support PNG, JPG, GIF, and WebP image formats
- **FR-007**: System MUST save spec content as a temporary markdown file when submitted (using existing globalStorageUri infrastructure)
- **FR-008**: System MUST include image references in the temporary markdown file
- **FR-009**: System MUST automatically delete temporary files when the spec workflow completes
- **FR-010**: System MUST clean up orphaned temporary files from previous sessions on startup
- **FR-011**: System MUST preserve draft content when the webview is closed without submission
- **FR-012**: System MUST restore draft content when the webview is reopened
- **FR-013**: System MUST warn users when attached images cannot be sent to the selected AI CLI provider
- **FR-014**: System MUST allow users to load existing spec files as templates
- **FR-015**: System MUST provide clear submit and cancel actions in the editor

### Key Entities

- **SpecDraft**: Represents unsaved spec content being edited (text content, attached images, timestamp, associated workflow)
- **TempSpecFile**: A temporary markdown file generated from submitted spec (file path, associated images, creation time, parent spec workflow ID)
- **AttachedImage**: An image attached to a spec (file path or data URI, display name, file size, dimensions)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can create multi-line specifications with 10+ lines of content without usability issues
- **SC-002**: 95% of image attachments (under 5MB) are successfully added on first attempt
- **SC-003**: Temporary files are cleaned up within 5 seconds of workflow completion
- **SC-004**: Draft content is preserved and restored correctly 100% of the time when webview is closed and reopened
- **SC-005**: Preview accurately reflects submitted content 100% of the time (no formatting loss)
- **SC-006**: Spec submission works correctly with all supported AI CLI providers (Claude Code, Gemini CLI, GitHub Copilot CLI)

## Assumptions

- Users have a valid workspace open in VSCode (required for temp file storage)
- AI CLI providers are already configured and accessible via the existing provider infrastructure
- The existing webview infrastructure (used for workflow editor) can be extended for this feature
- **Temporary files will use the existing `context.globalStorageUri` mechanism** (e.g., `~/Library/Application Support/Cursor/User/globalStorage/alfredoperez.speckit-companion/prompt-{timestamp}.md`) - this infrastructure already exists in all CLI providers
- Image size limits (2MB per image, 10MB total) are reasonable defaults that can be adjusted via settings if needed
- Images can be stored alongside prompt files in the same globalStorage directory
