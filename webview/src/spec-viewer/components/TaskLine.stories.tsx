/**
 * TaskLine stories — spec 112-task-line-rendering-polish
 *
 * Covers:
 *   - Single-line task: idle vs. hover  (US1: no content shift on hover)
 *   - Wrapping task:    idle vs. hover  (US2: no trailing gap; US1: no shift)
 *   - Paragraph baseline               (gap / height comparison reference)
 *
 * All stories use DocumentContextDecorator to inject CSS variable overrides
 * so VS Code theme tokens resolve in the browser-based Storybook environment.
 * The task-item HTML structure mirrors what renderer.ts emits exactly.
 */

import type { Meta, StoryObj } from "@storybook/preact";

// Storybook requires a default export with a component reference.
// These stories render raw HTML structures, so we use a lightweight stub.
const TaskLineStub = () => null;

const meta: Meta<typeof TaskLineStub> = {
  title: "Viewer/TaskLine",
  component: TaskLineStub,
};
export default meta;

type Story = StoryObj<typeof TaskLineStub>;

// ============================================================
// DocumentContextDecorator
// Injects minimal VS Code CSS-variable overrides so theme vars
// resolve inside the browser-based Storybook environment.
// Mirrors the decorator in InlineComment.stories.tsx exactly.
// ============================================================

const DocumentContextDecorator = (Story: () => JSX.Element) => (
  <div
    id="markdown-content"
    style={
      {
        "--bg-primary": "#1e1e1e",
        "--bg-secondary": "#252526",
        "--bg-hover": "rgba(255,255,255,0.05)",
        "--bg-checkbox": "#1e1e1e",
        "--text-primary": "#cccccc",
        "--text-secondary": "#9d9d9d",
        "--border": "#3c3c3c",
        "--border-checkbox": "#6b6b6b",
        "--accent": "#0e639c",
        "--accent-subtle": "rgba(14,99,156,0.2)",
        "--accent-glow": "0 0 0 1px rgba(14,99,156,0.4)",
        "--success": "#4ec9b0",
        "--space-1": "4px",
        "--space-2": "8px",
        "--space-4": "16px",
        "--radius-sm": "3px",
        "--transition-fast": "100ms ease",
        "--header-title": "#ffffff",
        padding: "16px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        background: "#1e1e1e",
        color: "#cccccc",
        maxWidth: "420px",
      } as React.CSSProperties
    }
  >
    <Story />
  </div>
);

// Simulated hover state applied as inline styles.
// Mirrors the _tasks.css :hover rule exactly so the story is a
// pixel-accurate representation of the hovered state.
const hoverStyle: React.CSSProperties = {
  background: "var(--bg-hover)",
  marginLeft: "calc(-1 * var(--space-2))",
  marginRight: "calc(-1 * var(--space-2))",
  paddingTop: "var(--space-1)",
  paddingBottom: "var(--space-1)",
  paddingLeft: "var(--space-2)",
  paddingRight: "24px", // preserve + button slot (spec 112 fix)
  borderRadius: "var(--radius-sm)",
};

// Shared comment icon SVG (matches renderer.ts COMMENT_ICON_SVG)
const CommentIconSVG = () => (
  <svg width="14" height="14" viewBox="0 0 24 24">
    <path
      fill="none"
      stroke="#ffffff"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
      d="M14 6h8m-4-4v8M6.099 19.5q-1.949-.192-2.927-1.172C2 17.157 2 15.271 2 11.5V11c0-3.771 0-5.657 1.172-6.828S6.229 3 10 3h1.5m-5 15c-.205 1.002-1.122 3.166-.184 3.865c.49.357 1.271-.024 2.834-.786c1.096-.535 2.206-1.148 3.405-1.424c.438-.1.885-.143 1.445-.155c3.771 0 5.657 0 6.828-1.172C21.947 17.21 21.998 15.44 22 12M8 14h6M8 9h3"
      color="currentColor"
    />
  </svg>
);

// Base task-item styles (mirrors li.task-item idle CSS)
const taskItemBaseStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: "var(--space-2)",
  padding: "var(--space-1) 0",
  paddingRight: "24px",
  margin: 0,
  position: "relative",
  listStyle: "none",
  fontSize: "inherit",
  lineHeight: "1.5",
};

// Custom checkbox styles (mirror li.task-item input[type="checkbox"] CSS).
// margin-top tracks the label line-height so the box centers on the first
// text line at any font size — matches _tasks.css, not a fixed pixel.
const checkboxStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  width: "16px",
  height: "16px",
  minWidth: "16px",
  margin: "calc((1.4em - 16px) / 2) 0 0 0",
  border: "2px solid var(--border-checkbox)",
  borderRadius: "50%",
  background: "var(--bg-checkbox)",
  flexShrink: 0,
};

// Mirrors li.task-item .task-text — tighter line-height than the row.
const taskTextStyle: React.CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  lineHeight: "1.4",
};

// ============================================================
// US1 / SC-001: Zero layout shift on hover
// ============================================================

/**
 * Single-line task — idle state.
 * Baseline for comparing against the hover story.
 */
export const TaskLineSingleLineIdle: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>
          Implement login form with email and password fields
        </span>
        <div class="line-comment-slot"></div>
      </li>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>
          Write unit tests for form validation
        </span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

/**
 * Single-line task — hover state.
 * The task text bounding box must be identical to TaskLineSingleLineIdle —
 * zero horizontal or vertical shift. SC-001.
 */
export const TaskLineSingleLineHover: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li
        class="task-item line"
        style={{ ...taskItemBaseStyle, ...hoverStyle }}
      >
        <button
          class="line-add-btn"
          style={{
            opacity: 1,
            position: "absolute",
            right: 0,
            top: "2px",
            width: "18px",
            height: "18px",
            border: "1px solid var(--success)",
            background: "var(--success)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>
          Implement login form with email and password fields
        </span>
        <div class="line-comment-slot"></div>
      </li>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>
          Write unit tests for form validation
        </span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

// ============================================================
// US1 + US2 / SC-001 + SC-002: Wrapping tasks
// ============================================================

// Long description with multiple code spans — forces wrapping at 420 px
const WRAPPING_TEXT =
  "Configure `webpack.config.js` to bundle `webview/src/spec-viewer/` with `ts-loader`, set `output.path` to `dist/webview/`, enable `source-map` in development mode, and add `CopyPlugin` for static assets";

/**
 * Wrapping task — idle state.
 * The vertical gap below the task must equal the gap below a single-line task.
 * SC-002: no trailing phantom flex row from the empty comment slot.
 */
export const TaskLineWrappingIdle: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>{WRAPPING_TEXT}</span>
        <div class="line-comment-slot"></div>
      </li>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>Short single-line task below</span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

/**
 * Wrapping task — hover state.
 * The task text must not shift when the hover background + button appear.
 * Comparing visually against TaskLineWrappingIdle verifies SC-001 + SC-002.
 */
export const TaskLineWrappingHover: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li
        class="task-item line"
        style={{ ...taskItemBaseStyle, ...hoverStyle }}
      >
        <button
          class="line-add-btn"
          style={{
            opacity: 1,
            position: "absolute",
            right: 0,
            top: "2px",
            width: "18px",
            height: "18px",
            border: "1px solid var(--success)",
            background: "var(--success)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>{WRAPPING_TEXT}</span>
        <div class="line-comment-slot"></div>
      </li>
      <li class="task-item line" style={taskItemBaseStyle}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <input type="checkbox" style={checkboxStyle} />
        <span class="task-text line-content" style={taskTextStyle}>Short single-line task below</span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

// ============================================================
// Paragraph baseline — gap comparison reference
// ============================================================

/**
 * Paragraph line — idle state.
 * The gap below a paragraph should match the gap below a single-line task.
 * Use this as the baseline when comparing spacing across content types.
 * SC-002.
 */
export const ParagraphLineBaseline: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <div>
      <div class="line" style={{ position: "relative" }}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <div class="line-content">
          <p style={{ margin: 0 }}>
            The authentication system must support multiple identity providers.
          </p>
        </div>
        <div class="line-comment-slot"></div>
      </div>
      <div class="line" style={{ position: "relative" }}>
        <button
          class="line-add-btn"
          style={{ opacity: 0, position: "absolute", right: 0, top: "2px" }}
          title="Add comment"
        >
          <CommentIconSVG />
        </button>
        <div class="line-content">
          <p style={{ margin: 0 }}>
            Each provider must be configured via environment variables.
          </p>
        </div>
        <div class="line-comment-slot"></div>
      </div>
    </div>
  ),
};
