'use client';
/**
 * Phase 6 / Plan 06-02b — Draft card for the drafts viewer.
 *
 * Renders a single persisted draft with three actions when status='pending':
 *   [Send message] — fires sendDraft Server Action (proxies to orchestrator)
 *   [Edit & Send]  — opens an inline JSON editor, then dispatches sendDraft with
 *                    the modified input
 *   [Discard]      — shows inline confirmation (no browser confirm()), then
 *                    fires discardDraft Server Action
 *
 * Per UI-SPEC §Surface 3 lines 305-321. Uses Plan 03.1 primitives only — no
 * inline style attributes and no hex literals.
 */
import * as React from 'react';
import { useState, useTransition } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { sendDraft, discardDraft } from '../_actions';

export type DraftStatus = 'pending' | 'sent' | 'discarded';

export interface DraftRecord {
  draft_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  created_at: string;
  seq: number;
  status: DraftStatus;
  send_run_id?: string | null;
}

const PREVIEW_LINE_CAP = 8;

function statusToTone(status: DraftStatus): 'neutral' | 'success' | 'destructive' {
  switch (status) {
    case 'sent':
      return 'success';
    case 'discarded':
      return 'destructive';
    default:
      return 'neutral';
  }
}

function statusToLabel(status: DraftStatus): string {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'discarded':
      return 'Discarded';
    default:
      return 'Pending';
  }
}

function ToolInputPreview({ input }: { input: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = JSON.stringify(input, null, 2);
  const lines = formatted.split('\n');
  const isLong = lines.length > PREVIEW_LINE_CAP;
  const visible = expanded || !isLong ? formatted : lines.slice(0, PREVIEW_LINE_CAP).join('\n');

  return (
    <div className="flex flex-col gap-xs">
      <pre className="font-mono text-[13px] bg-surface p-sm rounded border border-border whitespace-pre-wrap m-0">
        {visible}
        {isLong && !expanded && '\n...'}
      </pre>
      {isLong && (
        <Button
          intent="ghost"
          size="sm"
          type="button"
          className="self-start"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}

export function DraftCard({
  draft,
  runId,
}: {
  draft: DraftRecord;
  runId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editorText, setEditorText] = useState(() =>
    JSON.stringify(draft.tool_input, null, 2),
  );
  const [editorError, setEditorError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [requiresApprovalNote, setRequiresApprovalNote] = useState(false);
  const [localStatus, setLocalStatus] = useState<DraftStatus>(draft.status);

  const status = localStatus;
  const isPendingStatus = status === 'pending';

  function onSendClick(modifiedInput?: Record<string, unknown>) {
    setError(null);
    setRequiresApprovalNote(false);
    startTransition(async () => {
      const r = await sendDraft(runId, draft.draft_id, modifiedInput);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLocalStatus('sent');
      setEditing(false);
      // If the new run is awaiting approval, we cannot detect it from this
      // response (orchestrator returns immediately after enqueue). Show the
      // generic "approval may be required" note when modifiedInput indicates
      // a write tool — best-effort.
      // The accurate signal would be polling the new run; deferred to a future plan.
    });
  }

  function onEditSendClick() {
    setEditorError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editorText) as Record<string, unknown>;
    } catch (e) {
      setEditorError(
        e instanceof Error ? e.message : 'Invalid JSON in editor',
      );
      return;
    }
    onSendClick(parsed);
  }

  function onDiscardConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await discardDraft(runId, draft.draft_id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLocalStatus('discarded');
      setConfirmingDiscard(false);
    });
  }

  return (
    <Card data-testid={`draft-card-${draft.draft_id}`}>
      <CardHeader>
        <Badge tone="neutral" className="font-mono">
          {draft.tool_name}
        </Badge>
        <span className="text-text-muted text-[13px] font-mono">
          #{draft.seq}
        </span>
        <span className="text-text-muted text-[13px] font-mono">
          {new Date(draft.created_at).toLocaleString()}
        </span>
        <span className="ml-auto">
          <Badge tone={statusToTone(status)}>{statusToLabel(status)}</Badge>
        </span>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-md">
          <ToolInputPreview input={draft.tool_input} />

          {editing && isPendingStatus && (
            <div className="flex flex-col gap-sm">
              <label
                htmlFor={`draft-editor-${draft.draft_id}`}
                className="text-[12px] text-text-muted font-sans"
              >
                Edit tool input (JSON)
              </label>
              <Textarea
                id={`draft-editor-${draft.draft_id}`}
                rows={8}
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="font-mono text-[13px]"
              />
              {editorError && (
                <span className="text-[12px] text-destructive font-sans">
                  {editorError}
                </span>
              )}
              <div className="flex gap-sm">
                <Button
                  intent="primary"
                  size="sm"
                  type="button"
                  disabled={isPending}
                  onClick={onEditSendClick}
                >
                  Send edited
                </Button>
                <Button
                  intent="ghost"
                  size="sm"
                  type="button"
                  disabled={isPending}
                  onClick={() => setEditing(false)}
                >
                  Cancel edit
                </Button>
              </div>
            </div>
          )}

          {confirmingDiscard && isPendingStatus && (
            <div
              role="alert"
              className="flex items-center gap-sm border border-border rounded p-sm bg-surface"
            >
              <span className="text-[13px] text-text">
                Discard this draft? It will be marked as discarded but not deleted.
              </span>
              <Button
                intent="destructive"
                size="sm"
                type="button"
                disabled={isPending}
                onClick={onDiscardConfirm}
              >
                Confirm discard
              </Button>
              <Button
                intent="ghost"
                size="sm"
                type="button"
                disabled={isPending}
                onClick={() => setConfirmingDiscard(false)}
              >
                Keep draft
              </Button>
            </div>
          )}

          {requiresApprovalNote && (
            <p className="text-[13px] text-warning">
              This action requires approval. An approval request has been created.
            </p>
          )}

          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}

          {isPendingStatus && !editing && !confirmingDiscard && (
            <div className="flex gap-sm">
              <Button
                intent="primary"
                size="sm"
                type="button"
                data-testid={`draft-send-${draft.draft_id}`}
                disabled={isPending}
                onClick={() => onSendClick()}
              >
                Send message
              </Button>
              <Button
                intent="secondary"
                size="sm"
                type="button"
                data-testid={`draft-edit-${draft.draft_id}`}
                disabled={isPending}
                onClick={() => setEditing(true)}
              >
                Edit & Send
              </Button>
              <Button
                intent="ghost"
                size="sm"
                type="button"
                data-testid={`draft-discard-${draft.draft_id}`}
                disabled={isPending}
                onClick={() => setConfirmingDiscard(true)}
                className="text-destructive"
              >
                Discard
              </Button>
            </div>
          )}

          {status === 'sent' && draft.send_run_id && (
            <p className="text-[13px] text-text-muted">
              Sent as run{' '}
              <a
                href={`/agentos/runs/${draft.send_run_id}`}
                className="text-accent underline font-mono"
              >
                {draft.send_run_id.slice(0, 8)}
              </a>
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
