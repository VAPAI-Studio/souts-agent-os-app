'use client';

import * as React from 'react';
import { Card, CardBody } from '@/components/ui/Card';

type ToolInputProps = { tool_name: string; input: Record<string, unknown> };
const PREVIEW_CHAR_LIMIT = 200;

function clipText(text: string, limit = PREVIEW_CHAR_LIMIT): { preview: string; full_len: number } {
  const full_len = text.length;
  if (full_len <= limit) return { preview: text, full_len };
  return { preview: text.slice(0, limit) + '...', full_len };
}

function SlackPostPreview({ input }: { input: Record<string, unknown> }) {
  const channel = String(input.channel ?? '');
  const text = String(input.text ?? '');
  const { preview, full_len } = clipText(text);
  return (
    <div className="flex flex-col gap-xs" data-testid="tool-input-slack">
      <div className="text-[12px] text-text-muted">Channel</div>
      <div className="font-mono text-[13px]">{channel}</div>
      <div className="text-[12px] text-text-muted">Message ({full_len} chars)</div>
      <div className="font-sans text-[13px] whitespace-pre-wrap">{preview}</div>
    </div>
  );
}

function GmailSendPreview({ input }: { input: Record<string, unknown> }) {
  const to = Array.isArray(input.to) ? (input.to as string[]).join(', ') : String(input.to ?? '');
  const subject = String(input.subject ?? '');
  const body = String(input.body ?? '');
  const { preview, full_len } = clipText(body);
  return (
    <div className="flex flex-col gap-xs" data-testid="tool-input-gmail">
      <div className="text-[12px] text-text-muted">To</div>
      <div className="font-mono text-[13px]">{to}</div>
      <div className="text-[12px] text-text-muted">Subject</div>
      <div className="font-sans text-[13px]">{subject}</div>
      <div className="text-[12px] text-text-muted">Body ({full_len} chars)</div>
      <div className="font-sans text-[13px] whitespace-pre-wrap">{preview}</div>
    </div>
  );
}

function DriveNotionWritePreview({ input }: { input: Record<string, unknown> }) {
  const name = String(input.file_name ?? input.page_id ?? input.path ?? '');
  const content = String(input.content ?? '');
  const { preview, full_len } = clipText(content);
  return (
    <div className="flex flex-col gap-xs" data-testid="tool-input-write">
      <div className="text-[12px] text-text-muted">Target</div>
      <div className="font-mono text-[13px]">{name}</div>
      <div className="text-[12px] text-text-muted">Content ({full_len} chars)</div>
      <div className="font-sans text-[13px] whitespace-pre-wrap">{preview}</div>
    </div>
  );
}

function BashPreview({ input }: { input: Record<string, unknown> }) {
  const command = String(input.command ?? '');
  const cwd = String(input.cwd ?? '');
  return (
    <div className="flex flex-col gap-xs" data-testid="tool-input-bash">
      <div className="text-[12px] text-text-muted">Command</div>
      <div className="font-mono text-[13px] whitespace-pre-wrap">{command}</div>
      {cwd && (
        <>
          <div className="text-[12px] text-text-muted">Working dir</div>
          <div className="font-mono text-[12px]">{cwd}</div>
        </>
      )}
    </div>
  );
}

function FallbackJsonPreview({ input }: { input: Record<string, unknown> }) {
  return (
    <pre data-testid="tool-input-fallback" className="font-mono text-[12px] bg-surface p-sm rounded border border-border whitespace-pre-wrap">
      {JSON.stringify(input, null, 2)}
    </pre>
  );
}

export function ToolInputCard({ tool_name, input }: ToolInputProps) {
  return (
    <Card>
      <CardBody>
        {(() => {
          switch (tool_name) {
            case 'mcp__slack__post_message':
            case 'mcp__slack__post_thread':
              return <SlackPostPreview input={input} />;
            case 'mcp__gmail__send':
            case 'mcp__gmail__draft_send':
              return <GmailSendPreview input={input} />;
            case 'mcp__drive__write':
            case 'mcp__drive__edit':
            case 'mcp__notion__create_page':
            case 'mcp__notion__update_page':
            case 'mcp__notion__update_database':
              return <DriveNotionWritePreview input={input} />;
            case 'Bash':
              return <BashPreview input={input} />;
            default:
              return <FallbackJsonPreview input={input} />;
          }
        })()}
      </CardBody>
    </Card>
  );
}
