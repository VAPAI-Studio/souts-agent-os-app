'use client';
/**
 * ChatMessageList — renders historical and live chat messages.
 *
 * - Historical messages: structured parts (text + tool_use) passed as props.
 * - Live message: when currentRunId is set, subscribes to useRunStatus +
 *   useRunLogs and renders the streaming agent response as it arrives.
 *
 * Rendering:
 *   - User bubble: right-aligned, accent background.
 *   - Agent bubble: left-aligned, surface-raised. Markdown rendered via
 *     @uiw/react-markdown-preview (already in node_modules transitively).
 *   - Tool calls: rendered inline between text parts as collapsible chips.
 *
 * Pitfall 3 (RESEARCH.md): sort logs client-side by created_at to handle
 * out-of-order Realtime delivery.
 */
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRunStatus, useRunLogs } from '@/lib/supabase/realtime';
import { parseAgentMessageParts, type MessagePart } from '@/lib/chat/parseAgentMessage';

// react-markdown-preview pulls window — needs ssr:false (matches VaultFileEditor pattern).
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), {
  ssr: false,
});

export interface HistoricalChatMessage {
  runId: string;
  userText: string;
  agentParts: MessagePart[];
  status: string;
  createdAt: string;
}

export function ChatMessageList({
  historicalMessages,
  currentRunId,
  currentUserText,
}: {
  historicalMessages: HistoricalChatMessage[];
  currentRunId: string | null;
  currentUserText: string | null;
}) {
  return (
    <ol
      className="flex flex-col gap-6"
      data-testid="chat-message-list"
    >
      {historicalMessages.map((m, idx) => (
        <ChatMessageBubble
          key={m.runId}
          testid={`chat-message-${idx}`}
          userText={m.userText}
          agentParts={m.agentParts}
          status={m.status}
        />
      ))}
      {currentRunId && currentUserText && (
        <LiveChatMessage
          runId={currentRunId}
          userText={currentUserText}
          testid={`chat-message-${historicalMessages.length}`}
        />
      )}
    </ol>
  );
}

function UserBubble({ text, testid }: { text: string; testid: string }) {
  return (
    <div
      className="self-end max-w-[80%] bg-accent/10 px-3 py-2 rounded-lg text-[13px] whitespace-pre-wrap"
      data-testid={testid}
    >
      {text}
    </div>
  );
}

function ToolUseChip({
  name,
  input,
  testid,
}: {
  name: string;
  input: unknown;
  testid: string;
}) {
  const [open, setOpen] = useState(false);
  const displayName = name.replace(/^mcp__/, '').replace(/__/g, '.');
  return (
    <div
      className="self-start max-w-[80%] text-[12px] font-mono text-text-muted border border-border rounded-md bg-surface"
      data-testid={testid}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-2 py-1 flex items-center gap-2 hover:bg-surface-raised rounded-md"
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span>tool</span>
        <span className="text-text">{displayName}</span>
      </button>
      {open && (
        <pre className="px-2 pb-2 m-0 text-[11px] whitespace-pre-wrap break-all overflow-x-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AgentBubble({
  parts,
  fallback,
  testid,
}: {
  parts: MessagePart[];
  fallback: string;
  testid: string;
}) {
  const hasContent = parts.length > 0;

  if (!hasContent) {
    return (
      <div
        className="self-start max-w-[80%] bg-surface-raised border border-border px-3 py-2 rounded-lg text-[13px] text-text-muted"
        data-testid={testid}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-start gap-2 self-start w-full"
      data-testid={testid}
    >
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <div
            key={i}
            className="max-w-[80%] bg-surface-raised border border-border px-3 py-2 rounded-lg text-[13px] leading-relaxed"
            data-color-mode="light"
          >
            <MarkdownPreview
              source={p.text}
              wrapperElement={{ 'data-color-mode': 'light' }}
              style={{ background: 'transparent', fontSize: 13 }}
            />
          </div>
        ) : (
          <ToolUseChip
            key={i}
            name={p.name}
            input={p.input}
            testid={`${testid}-tool-${i}`}
          />
        ),
      )}
    </div>
  );
}

function ChatMessageBubble({
  userText,
  agentParts,
  status,
  testid,
}: {
  userText: string;
  agentParts: MessagePart[];
  status: string;
  testid: string;
}) {
  const fallback =
    status === 'failed'
      ? '(run failed)'
      : status === 'cancelled'
        ? '(cancelled)'
        : status === 'expired'
          ? '(expired)'
          : '...';

  return (
    <li data-testid={testid} className="flex flex-col gap-2">
      <UserBubble text={userText} testid={`${testid}-user`} />
      <AgentBubble parts={agentParts} fallback={fallback} testid={`${testid}-agent`} />
      {status === 'awaiting_approval' && (
        <p
          className="text-[11px] text-warning self-start"
          data-testid={`${testid}-awaiting-approval`}
        >
          Awaiting approval — check the Approvals Inbox.
        </p>
      )}
    </li>
  );
}

function LiveChatMessage({
  runId,
  userText,
  testid,
}: {
  runId: string;
  userText: string;
  testid: string;
}) {
  const statusRow = useRunStatus(runId, {
    id: runId,
    status: 'queued',
    cost_usd: 0,
    output: null,
  });
  const logs = useRunLogs(runId, []);

  // Pitfall 3: sort logs client-side by created_at to handle out-of-order Realtime delivery.
  const sortedLogs = [...logs].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  // Flatten all assistant log entries into ordered MessagePart[].
  const agentParts: MessagePart[] = sortedLogs
    .filter((l) => l.message_type === 'assistant')
    .flatMap((l) => parseAgentMessageParts(l.content));

  const currentStatus = statusRow?.status ?? 'queued';

  const fallback =
    currentStatus === 'queued' || currentStatus === 'dispatched'
      ? '...'
      : currentStatus ?? '...';

  return (
    <li data-testid={testid} className="flex flex-col gap-2">
      <UserBubble text={userText} testid={`${testid}-user`} />
      <AgentBubble parts={agentParts} fallback={fallback} testid={`${testid}-agent`} />
      {currentStatus === 'awaiting_approval' && (
        <p
          className="text-[11px] text-warning self-start"
          data-testid={`${testid}-awaiting-approval`}
        >
          Awaiting approval — check the Approvals Inbox.
        </p>
      )}
    </li>
  );
}
