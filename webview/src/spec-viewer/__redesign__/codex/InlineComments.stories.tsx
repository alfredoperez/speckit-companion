import type { ComponentChildren } from 'preact';
import type { Meta, StoryObj } from '@storybook/preact';
import { useState } from 'preact/hooks';
import './codex.css';

interface Comment { id: number; anchor: string; text: string; }
const initial: Comment[] = [
  { id: 1, anchor: 'FR-004', text: 'Should this include renamed capability files, or only added and modified rows?' },
  { id: 2, anchor: 'Acceptance scenario 2', text: 'Add the oversized-file degraded path to this scenario.' },
];

interface ComposerProps {
  value: string;
  onInput: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isReply: boolean;
}

function Composer({ value, onInput, onCancel, onSubmit, isReply }: ComposerProps) {
  const [preview, setPreview] = useState(false);
  return (
    <div class="cx-comment-composer">
      <div class="cx-comment-tabs" role="tablist" aria-label="Comment editor mode">
        <button class={!preview ? 'is-active' : ''} role="tab" aria-selected={!preview} onClick={() => setPreview(false)}>Write</button>
        <button class={preview ? 'is-active' : ''} role="tab" aria-selected={preview} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview
        ? <div class="cx-comment-preview">{value || 'Nothing to preview.'}</div>
        : <textarea value={value} onInput={(event) => onInput(event.currentTarget.value)} placeholder="Leave a comment" aria-label="Comment text" autoFocus />}
      <div class="cx-comment-actions"><span>Markdown supported</span><button class="cx-btn cx-btn--ghost" onClick={onCancel}>Cancel</button><button class="cx-btn cx-btn--primary" onClick={onSubmit} disabled={!value.trim()}>{isReply ? 'Add reply' : 'Add comment'}</button></div>
    </div>
  );
}

function Thread({ comments, onReply, onResolve }: { comments: Comment[]; onReply: () => void; onResolve: () => void }) {
  return (
    <div class="cx-review-thread">
      {comments.map((comment, index) => <article class="cx-thread-comment" key={comment.id}>
        <header><span class="cx-avatar" aria-hidden="true">AP</span><strong>Alfredo Perez</strong><span>commented just now</span><button title="Comment options" aria-label="Comment options">···</button></header>
        <p>{comment.text}</p>
        {index === comments.length - 1 && <footer><button onClick={onReply}>Reply</button><button class="cx-resolve-btn" onClick={onResolve}>Resolve conversation</button></footer>}
      </article>)}
    </div>
  );
}

interface ReviewLineProps {
  anchor: string;
  label: string;
  children: ComponentChildren;
  comments: Comment[];
  pinned: boolean;
  composerOpen: boolean;
  draft: string;
  onPin: () => void;
  onCompose: () => void;
  onDraft: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onResolve: () => void;
}

function ReviewLine({ anchor, label, children, comments, pinned, composerOpen, draft, onPin, onCompose, onDraft, onCancel, onSubmit, onResolve }: ReviewLineProps) {
  const hasThread = comments.length > 0;
  return (
    <div class={`cx-review-line${hasThread ? ' has-comment' : ''}${pinned || composerOpen ? ' is-thread-open' : ''}`}>
      <button class="cx-review-add" title={`Add comment on ${anchor}`} aria-label={`Add comment on ${anchor}`} onClick={onCompose}>+</button>
      <div class="cx-review-line-copy"><strong>{label}</strong> {children}</div>
      {hasThread && <button class="cx-thread-trigger" title={`${comments.length} comment${comments.length === 1 ? '' : 's'}`} aria-label={`Show ${comments.length} comment${comments.length === 1 ? '' : 's'} on ${anchor}`} aria-expanded={pinned} onClick={onPin}><span aria-hidden="true">▱</span>{comments.length}</button>}
      {hasThread && <Thread comments={comments} onReply={onCompose} onResolve={onResolve} />}
      {composerOpen && <Composer value={draft} onInput={onDraft} onCancel={onCancel} onSubmit={onSubmit} isReply={hasThread} />}
    </div>
  );
}

function InlineComments({ initialPinned = null, initialComposer = null }: { initialPinned?: string | null; initialComposer?: string | null }) {
  const [comments, setComments] = useState(initial);
  const [composerAnchor, setComposerAnchor] = useState<string | null>(initialComposer);
  const [pinnedAnchor, setPinnedAnchor] = useState<string | null>(initialPinned ?? initialComposer);
  const [draft, setDraft] = useState('');
  const addDraft = () => {
    if (!draft.trim() || !composerAnchor) return;
    setComments([...comments, { id: Date.now(), anchor: composerAnchor, text: draft.trim() }]);
    setPinnedAnchor(composerAnchor);
    setDraft(''); setComposerAnchor(null);
  };
  const line = (anchor: string, label: string, children: ComponentChildren) => (
    <ReviewLine
      anchor={anchor} label={label} comments={comments.filter(comment => comment.anchor === anchor)}
      pinned={pinnedAnchor === anchor} composerOpen={composerAnchor === anchor} draft={composerAnchor === anchor ? draft : ''}
      onPin={() => setPinnedAnchor(pinnedAnchor === anchor ? null : anchor)}
      onCompose={() => { setComposerAnchor(anchor); setPinnedAnchor(anchor); setDraft(''); }}
      onDraft={setDraft} onCancel={() => setComposerAnchor(null)} onSubmit={addDraft}
      onResolve={() => { setComments(comments.filter(comment => comment.anchor !== anchor)); setPinnedAnchor(null); setComposerAnchor(null); }}
    >{children}</ReviewLine>
  );
  return (
    <div class="codex-redesign cx-page cx-story-pad">
      <header style="max-width:1100px;margin:0 auto 28px"><p class="cx-eyebrow">DOCUMENT REVIEW</p><h1 class="cx-display">Comments stay attached to the spec.</h1><p class="cx-lede">Hover a line to comment. Existing threads preview in place, while the review queue keeps every pending note discoverable.</p></header>
      <div class="cx-review-shell" style="max-width:1100px;margin:0 auto">
        <main class="cx-card cx-review-doc">
          <span class="cx-card-label">Specification / Requirements</span>
          <h2 style="margin:0 0 18px">Functional requirements</h2>
          {line('FR-001', 'FR-001', 'The viewer must load capability content through the existing resolution rules.')}
          {line('FR-002', 'FR-002', 'Capability resolution must reuse the Spec Explorer configuration path.')}
          {line('FR-003', 'FR-003', 'The Activity panel must render readable requirement rows without opening raw files.')}
          {line('FR-004', 'FR-004', 'Fold-back status must remain visible with per-kind delta counts.')}
          <h2 style="margin:34px 0 18px">Acceptance scenarios</h2>
          {line('Acceptance scenario 2', 'Scenario 2', 'Given unavailable content, the viewer shows a quiet degraded state without blocking Activity.')}
        </main>
        <aside class="cx-review-summary">
          <h2>Review queue <span class="cx-badge">{comments.length}</span></h2><p>Pending comments are persisted by document and anchor.</p>
          {comments.map(comment => <button class="cx-review-note" key={comment.id} onClick={() => setPinnedAnchor(comment.anchor)}><strong>{comment.anchor}</strong><span>{comment.text}</span></button>)}
          <button class="cx-btn cx-btn--primary" style="width:100%;margin-top:14px" disabled={comments.length === 0}>Refine with {comments.length} comments</button>
        </aside>
      </div>
    </div>
  );
}

const meta: Meta<typeof InlineComments> = { title: 'Redesign/Codex/Inline Comments', component: InlineComments, parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj<typeof InlineComments>;
export const ReviewQueue: Story = {};
export const OpenThread: Story = { name: 'Pinned GitHub-style thread', args: { initialPinned: 'FR-004' } };
export const CommentComposer: Story = { name: 'GitHub-style composer', args: { initialComposer: 'FR-003' } };
