import type { Meta, StoryObj } from "@storybook/preact";
import { InlineComment } from "./InlineComment";
import type { Refinement } from "../types";

const meta: Meta<typeof InlineComment> = {
  title: "Viewer/InlineComment",
  component: InlineComment,
};
export default meta;

type Story = StoryObj<typeof InlineComment>;

const noop = () => undefined;

function refinement(over: Partial<Refinement> = {}): Refinement {
  return {
    id: "ref-1",
    lineNum: 5,
    lineContent: "The user should be able to log in",
    comment: "Name the auth methods in scope for v1",
    lineType: "paragraph",
    status: "pending",
    ...over,
  };
}

/**
 * Injects the VS Code CSS variables the viewer's tokens resolve against, so the
 * annotation renders in Storybook the way it renders in the panel.
 */
const DocumentContextDecorator = (Story: () => JSX.Element) => (
  <div
    id="markdown-content"
    style={
      {
        "--bg-primary": "#1e1e1e",
        "--bg-secondary": "#252526",
        "--bg-hover": "rgba(255,255,255,0.05)",
        "--text-primary": "#cccccc",
        "--text-body": "#d0d0d0",
        "--text-secondary": "#9d9d9d",
        "--text-muted": "#8a8a8a",
        "--border": "#3c3c3c",
        "--border-accent": "rgba(14,99,156,0.5)",
        "--accent": "#0e639c",
        "--accent-subtle": "rgba(14,99,156,0.2)",
        "--error": "#f14c4c",
        "--error-subtle": "rgba(241,76,76,0.1)",
        "--space-1": "4px",
        "--space-2": "8px",
        "--space-3": "12px",
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

/** A document line with its comment slot — what the annotation actually sits in. */
function Line({ text, children }: { text: string; children?: JSX.Element | JSX.Element[] }) {
  return (
    <div class="line" style="position: relative; padding: 2px 0;">
      <div class="line-content" style="line-height: 1.6;">{text}</div>
      <div class="line-comment-slot">{children}</div>
    </div>
  );
}

/** The resting state: one quiet line under the line it annotates. */
export const PendingCollapsed: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="The authentication system must support multiple identity providers.">
      <InlineComment refinement={refinement()} mode="line" onDelete={noop} onEdit={noop} onRefine={noop} />
    </Line>
  ),
};

/**
 * Expanded — click the row (or focus it and press Enter) to reach the full text
 * and the three actions. Refine hands this document's pending comments to the AI.
 */
export const PendingExpanded: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="The authentication system must support multiple identity providers.">
      <InlineComment refinement={refinement()} mode="line" onDelete={noop} onEdit={noop} onRefine={noop} />
    </Line>
  ),
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector(".comment-disclosure") as HTMLButtonElement)?.click();
  },
};

/** Already handed to the AI: a muted rail, a check, and no Refine action. */
export const Applied: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="The authentication system must support multiple identity providers.">
      <InlineComment
        refinement={refinement({ status: "applied", comment: "Clarify which providers ship in v1" })}
        mode="line"
        onDelete={noop}
        onEdit={noop}
        onRefine={noop}
      />
    </Line>
  ),
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector(".comment-disclosure") as HTMLButtonElement)?.click();
  },
};

/** A completed or archived spec: the comment is readable, but nothing can change it. */
export const ReadOnly: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="The authentication system must support multiple identity providers.">
      <InlineComment
        refinement={refinement({ status: "applied" })}
        mode="line"
        readOnly
        onDelete={noop}
        onEdit={noop}
        onRefine={noop}
      />
    </Line>
  ),
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector(".comment-disclosure") as HTMLButtonElement)?.click();
  },
};

/** However long the comment, collapsed it costs exactly one line. */
export const LongTextTruncates: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="Password reset flows must complete within five minutes.">
      <InlineComment
        refinement={refinement({
          comment:
            "This needs to say what happens when the reset link expires mid-flow, whether the user can request a second link while the first is still live, how many attempts are allowed before the account locks, and which of those cases sends an email.",
        })}
        mode="line"
        onDelete={noop}
        onEdit={noop}
        onRefine={noop}
      />
    </Line>
  ),
};

/** The density case: several annotated lines still read as a document. */
export const SeveralOnOneDocument: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <div>
      <Line text="The authentication system must support multiple identity providers.">
        <InlineComment
          refinement={refinement({ id: "r1", comment: "Name the providers in scope for v1" })}
          mode="line"
          onDelete={noop}
          onEdit={noop}
          onRefine={noop}
        />
      </Line>
      <Line text="Sessions expire after 30 minutes of inactivity." />
      <Line text="Password reset flows must complete within five minutes.">
        <InlineComment
          refinement={refinement({ id: "r2", status: "applied", comment: "Say what happens when the link expires" })}
          mode="line"
          onDelete={noop}
          onEdit={noop}
          onRefine={noop}
        />
      </Line>
      <Line text="Failed logins are rate-limited per account.">
        <InlineComment
          refinement={refinement({ id: "r3", comment: "How many attempts before lockout?" })}
          mode="line"
          onDelete={noop}
          onEdit={noop}
          onRefine={noop}
        />
      </Line>
      <Line text="Audit events are written for every sign-in attempt." />
    </div>
  ),
};

/** Comment text is user data: markup in it stays literal characters. */
export const MarkupInCommentStaysLiteral: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <Line text="The authentication system must support multiple identity providers.">
      <InlineComment
        refinement={refinement({ comment: '"><img src=x onerror="alert(1)"> — should read as text' })}
        mode="line"
        onDelete={noop}
        onEdit={noop}
        onRefine={noop}
      />
    </Line>
  ),
};

/**
 * A task line: the annotation lives in the same slot below the checkbox row, so
 * the task text keeps the height it has with no comment on it (the row below).
 */
export const TaskLine: Story = {
  decorators: [DocumentContextDecorator],
  render: () => (
    <ul style="padding: 0; margin: 0; list-style: none;">
      <li
        class="task-item line"
        style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-2); padding: var(--space-1) 0; position: relative;"
      >
        <input type="checkbox" />
        <span class="task-text line-content">Implement the login form</span>
        <div class="line-comment-slot">
          <InlineComment
            refinement={refinement({ lineType: "task", comment: "OAuth providers too?" })}
            mode="line"
            onDelete={noop}
            onEdit={noop}
            onRefine={noop}
          />
        </div>
      </li>
      <li
        class="task-item line"
        style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-2); padding: var(--space-1) 0; position: relative;"
      >
        <input type="checkbox" />
        <span class="task-text line-content">Write unit tests for login validation</span>
        <div class="line-comment-slot"></div>
      </li>
    </ul>
  ),
};

/** Acceptance-scenario tables carry the same annotation, in a row. */
export const RowMode: Story = {
  decorators: [
    DocumentContextDecorator,
    // The viewer mounts a row comment into its own <tbody> after the scenario row.
    (Story) => (
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          <tr class="scenario-row">
            <td style="padding: 4px;">Given a signed-out user</td>
            <td style="padding: 4px;">When they submit valid credentials</td>
            <td style="padding: 4px;">Then they land on the dashboard</td>
            <td />
          </tr>
        </tbody>
        <tbody>
          <Story />
        </tbody>
      </table>
    ),
  ],
  render: () => (
    <InlineComment
      refinement={refinement({ lineType: "acceptance", comment: "Add the invalid-credentials case" })}
      mode="row"
      onDelete={noop}
      onEdit={noop}
      onRefine={noop}
    />
  ),
};
