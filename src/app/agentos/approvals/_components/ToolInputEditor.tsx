'use client';

import * as React from 'react';
import { useState } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

type ToolEditorProps = {
  tool_name: string;
  input: Record<string, unknown>;
  onChange: (modified_input: Record<string, unknown>) => void;
};

// Phase 6.1 / Plan 06.1-02: Slack tool names refreshed to fixture-derived names.
// slack_send_message handles thread replies via thread_ts param; the canvas
// write tools share the same channel/text editor shape as send_message.
const SUPPORTED_EDIT_TOOLS = new Set([
  // Slack writes (live MCP fixture)
  'mcp__slack__slack_send_message',
  'mcp__slack__slack_schedule_message',
  'mcp__slack__slack_create_canvas',
  'mcp__slack__slack_update_canvas',
  // Slack draft
  'mcp__slack__slack_send_message_draft',
  // Phase 7 placeholders
  'mcp__gmail__send',
  'mcp__gmail__draft_send',
  'mcp__drive__write',
  'mcp__drive__edit',
  'mcp__notion__create_page',
  'mcp__notion__update_page',
  'mcp__notion__update_database',
  'Bash',
]);

export function isToolEditable(tool_name: string): boolean {
  return SUPPORTED_EDIT_TOOLS.has(tool_name);
}

export function ToolInputEditor({ tool_name, input, onChange }: ToolEditorProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...input });
  const update = (key: string, value: unknown) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onChange(next);
  };

  // Phase 6.1: slack_send_message + slack_send_message_draft + slack_schedule_message
  // share the channel/text editor shape (channel_id + text). Thread replies use the
  // same shape with an extra thread_ts param. Canvas writes have a markdown_body field
  // — also rendered as Channel + Body for now (operator can edit text content).
  if (
    tool_name === 'mcp__slack__slack_send_message' ||
    tool_name === 'mcp__slack__slack_send_message_draft' ||
    tool_name === 'mcp__slack__slack_schedule_message' ||
    tool_name === 'mcp__slack__slack_create_canvas' ||
    tool_name === 'mcp__slack__slack_update_canvas'
  ) {
    // The live MCP advertises `channel_id` (not `channel`) — read both for backwards
    // compat with any pre-Phase-6.1 approval rows still in the queue.
    const channelValue = String(draft.channel_id ?? draft.channel ?? '');
    // Canvas tools use `markdown_body`; message tools use `text`.
    const textValue = String(draft.text ?? draft.markdown_body ?? '');
    const textKey = (draft.markdown_body !== undefined) ? 'markdown_body' : 'text';
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-slack">
        <FormField label="Channel (read-only)" htmlFor="edit-slack-channel">
          <Input id="edit-slack-channel" value={channelValue} readOnly />
        </FormField>
        <FormField label="Message" htmlFor="edit-slack-text">
          <Textarea id="edit-slack-text" value={textValue} onChange={(e) => update(textKey, e.target.value)} rows={6} data-testid="edit-slack-text" />
        </FormField>
      </div>
    );
  }

  if (tool_name === 'mcp__gmail__send' || tool_name === 'mcp__gmail__draft_send') {
    const to = Array.isArray(draft.to) ? (draft.to as string[]).join(', ') : String(draft.to ?? '');
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-gmail">
        <FormField label="To (read-only)" htmlFor="edit-gmail-to">
          <Input id="edit-gmail-to" value={to} readOnly />
        </FormField>
        <FormField label="Subject" htmlFor="edit-gmail-subject">
          <Input id="edit-gmail-subject" value={String(draft.subject ?? '')} onChange={(e) => update('subject', e.target.value)} data-testid="edit-gmail-subject" />
        </FormField>
        <FormField label="Body" htmlFor="edit-gmail-body">
          <Textarea id="edit-gmail-body" value={String(draft.body ?? '')} onChange={(e) => update('body', e.target.value)} rows={10} data-testid="edit-gmail-body" />
        </FormField>
      </div>
    );
  }

  if (
    tool_name === 'mcp__drive__write' || tool_name === 'mcp__drive__edit' ||
    tool_name === 'mcp__notion__create_page' || tool_name === 'mcp__notion__update_page' ||
    tool_name === 'mcp__notion__update_database'
  ) {
    const target = String(draft.file_name ?? draft.page_id ?? draft.path ?? '');
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-write">
        <FormField label="Target (read-only)" htmlFor="edit-write-target">
          <Input id="edit-write-target" value={target} readOnly />
        </FormField>
        <FormField label="Content" htmlFor="edit-write-content">
          <Textarea id="edit-write-content" value={String(draft.content ?? '')} onChange={(e) => update('content', e.target.value)} rows={12} data-testid="edit-write-content" />
        </FormField>
      </div>
    );
  }

  if (tool_name === 'Bash') {
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-bash">
        <FormField label="Working dir (read-only)" htmlFor="edit-bash-cwd">
          <Input id="edit-bash-cwd" value={String(draft.cwd ?? '')} readOnly />
        </FormField>
        <FormField label="Command" htmlFor="edit-bash-command">
          <Input id="edit-bash-command" value={String(draft.command ?? '')} onChange={(e) => update('command', e.target.value)} data-testid="edit-bash-command" />
        </FormField>
      </div>
    );
  }

  return (
    <div className="text-[13px] text-text-muted" data-testid="tool-editor-unavailable">
      Edit-and-approve is not available for this tool. Use Approve or Reject.
    </div>
  );
}
