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

const SUPPORTED_EDIT_TOOLS = new Set([
  'mcp__slack__post_message',
  'mcp__slack__post_thread',
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

  if (tool_name === 'mcp__slack__post_message' || tool_name === 'mcp__slack__post_thread') {
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-slack">
        <FormField label="Channel (read-only)"><Input value={String(draft.channel ?? '')} readOnly /></FormField>
        <FormField label="Message">
          <Textarea value={String(draft.text ?? '')} onChange={(e) => update('text', e.target.value)} rows={6} data-testid="edit-slack-text" />
        </FormField>
      </div>
    );
  }

  if (tool_name === 'mcp__gmail__send' || tool_name === 'mcp__gmail__draft_send') {
    const to = Array.isArray(draft.to) ? (draft.to as string[]).join(', ') : String(draft.to ?? '');
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-gmail">
        <FormField label="To (read-only)"><Input value={to} readOnly /></FormField>
        <FormField label="Subject"><Input value={String(draft.subject ?? '')} onChange={(e) => update('subject', e.target.value)} data-testid="edit-gmail-subject" /></FormField>
        <FormField label="Body">
          <Textarea value={String(draft.body ?? '')} onChange={(e) => update('body', e.target.value)} rows={10} data-testid="edit-gmail-body" />
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
        <FormField label="Target (read-only)"><Input value={target} readOnly /></FormField>
        <FormField label="Content">
          <Textarea value={String(draft.content ?? '')} onChange={(e) => update('content', e.target.value)} rows={12} data-testid="edit-write-content" />
        </FormField>
      </div>
    );
  }

  if (tool_name === 'Bash') {
    return (
      <div className="flex flex-col gap-md" data-testid="tool-editor-bash">
        <FormField label="Working dir (read-only)"><Input value={String(draft.cwd ?? '')} readOnly /></FormField>
        <FormField label="Command"><Input value={String(draft.command ?? '')} onChange={(e) => update('command', e.target.value)} data-testid="edit-bash-command" /></FormField>
      </div>
    );
  }

  return (
    <div className="text-[13px] text-text-muted" data-testid="tool-editor-unavailable">
      Edit-and-approve is not available for this tool. Use Approve or Reject.
    </div>
  );
}
