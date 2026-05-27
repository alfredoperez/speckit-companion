import type { Meta, StoryObj } from "@storybook/preact";
import { InlineComment } from "./InlineComment";

const meta: Meta<typeof InlineComment> = {
  title: "Viewer/InlineComment",
  component: InlineComment,
};
export default meta;

type Story = StoryObj<typeof InlineComment>;

const mockRefinement = {
  id: "ref-1",
  lineNum: 5,
  lineContent: "The user should be able to login",
  comment: "This should specify which auth methods are supported",
  lineType: "paragraph" as const,
};

export const LineMode: Story = {
  args: {
    refinement: mockRefinement,
    mode: "line",
    onDelete: (id: string) => console.log("delete", id),
  },
};

export const RowMode: Story = {
  decorators: [
    (Story) => (
      <table>
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
  args: {
    refinement: {
      ...mockRefinement,
      lineType: "acceptance" as const,
      comment: "Add error case for invalid credentials",
    },
    mode: "row",
    onDelete: (id: string) => console.log("delete", id),
  },
};

// ============================================================
// Height-parity stories (fix 110-fix-comment-line-height)
// Wrap content in #markdown-content so scoped CSS rules apply.
// ============================================================

/**
 * Injects minimal VS Code CSS-variable overrides so theme vars resolve
 * inside the browser-based Storybook environment.
 */
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
        "--radius-sm": "3px",
        "--transition-fast": "100ms ease",
        "--header-title": "#ffffff",
        padding: "16px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        background: "#1e1e1e",
        color: "#cccccc",
      } as React.CSSProperties
    }
  >
    <Story />
  </div>
);

const taskRefinement = {
  id: "ref-task-1",
  lineNum: 3,
  lineContent: "- [ ] Implement login form with email and password fields",
  comment: "Should also handle OAuth providers",
  lineType: "task" as const,
};

const paragraphRefinement = {
  id: "ref-para-1",
  lineNum: 8,
  lineContent:
    "The authentication system must support multiple identity providers.",
  comment: "Clarify which providers are in scope for v1",
  lineType: "paragraph" as const,
};

/**
 * Task line WITH a comment. The task-text row height should be identical to
 * TaskLineWithoutComment — height parity is the success criterion for US1/US2.
 */
export const TaskLineWithComment: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li
        class="task-item line"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-1) 0",
          position: "relative",
        }}
      >
        <input type="checkbox" />
        <span class="task-text line-content">
          Implement login form with email and password fields
        </span>
        <div class="line-comment-slot">
          <InlineComment
            refinement={taskRefinement}
            mode="line"
            onDelete={(id) => console.log("delete", id)}
          />
        </div>
      </li>
      <li
        class="task-item line"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-1) 0",
          position: "relative",
        }}
      >
        <input type="checkbox" />
        <span class="task-text line-content">
          Write unit tests for login validation (no comment — height baseline)
        </span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

/**
 * Task line WITHOUT any comment.
 * Baseline — compare row height against TaskLineWithComment.
 */
export const TaskLineWithoutComment: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
      <li
        class="task-item line"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-1) 0",
          position: "relative",
        }}
      >
        <input type="checkbox" />
        <span class="task-text line-content">
          Implement login form with email and password fields
        </span>
        <div class="line-comment-slot"></div>
      </li>
      <li
        class="task-item line"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          padding: "var(--space-1) 0",
          position: "relative",
        }}
      >
        <input type="checkbox" />
        <span class="task-text line-content">
          Write unit tests for login validation
        </span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

/**
 * Paragraph line WITH a comment.
 * The text row height should be identical to ParagraphLineWithoutComment.
 */
export const ParagraphLineWithComment: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <div>
      <div class="line" style={{ position: "relative" }}>
        <div class="line-content">
          The authentication system must support multiple identity providers.
        </div>
        <div class="line-comment-slot">
          <InlineComment
            refinement={paragraphRefinement}
            mode="line"
            onDelete={(id) => console.log("delete", id)}
          />
        </div>
      </div>
      <div class="line" style={{ position: "relative" }}>
        <div class="line-content">
          Password reset flows must be completed within 5 minutes (no comment —
          height baseline).
        </div>
        <div class="line-comment-slot"></div>
      </div>
    </div>
  ),
};

/**
 * Paragraph line WITHOUT any comment.
 * Baseline — compare row height against ParagraphLineWithComment.
 */
export const ParagraphLineWithoutComment: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <div>
      <div class="line" style={{ position: "relative" }}>
        <div class="line-content">
          The authentication system must support multiple identity providers.
        </div>
        <div class="line-comment-slot"></div>
      </div>
      <div class="line" style={{ position: "relative" }}>
        <div class="line-content">
          Password reset flows must be completed within 5 minutes.
        </div>
        <div class="line-comment-slot"></div>
      </div>
    </div>
  ),
};
