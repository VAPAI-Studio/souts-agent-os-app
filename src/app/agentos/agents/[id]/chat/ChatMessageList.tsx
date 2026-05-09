'use client';
/**
 * ChatMessageList — renders historical and live chat messages.
 *
 * - Historical messages: static bubbles passed as props (loaded on mount by ChatInterface).
 * - Live message: when currentRunId is set, subscribes to useRunStatus + useRunLogs
 *   and renders the streaming agent response.
 *
 * Pitfall 3 (RESEARCH.md): sort logs client-side by created_at to handle
 * out-of-order Realtime delivery.
 *
 * Approval-gate state: renders testid={`chat-message-{n}-awaiting-approval`}
 * when run status is 'awaiting_approval'.
 */
import { useRunStatus, useRunLogs } from '@/lib/supabase/realtime';
import { parseAgentMessage } from '@/lib/chat/parseAgentMessage';

export interface HistoricalChatMessage {
  runId: string;
  userText: string;
  agentText: string;
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
    <ol className="flex flex-col gap-3" data-testid="chat-message-list">
      {historicalMessages.map((m, idx) => (
        <ChatMessageBubble
          key={m.runId}
          testid={`chat-message-${idx}`}
          userText={m.userText}
          agentText={m.agentText}
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

function ChatMessageBubble({
  userText,
  agentText,
  status,
  testid,
}: {
  userText: string;
  agentText: string;
  status: string;
  testid: string;
}) {
  return (
    <li data-testid={testid} className="flex flex-col gap-1">
      <div
        className="self-end max-w-[80%] bg-accent/10 p-2 rounded-md text-[13px] whitespace-pre-wrap"
        data-testid={`${testid}-user`}
      >
        {userText}
      </div>
      <div
        className="self-start max-w-[80%] bg-surface-raised border border-border p-2 rounded-md text-[13px] whitespace-pre-wrap leading-relaxed"
        data-testid={`${testid}-agent`}
      >
        {agentText ||
          (status === 'failed'
            ? '(run failed)'
            : status === 'cancelled'
              ? '(cancelled)'
              : status === 'expired'
                ? '(expired)'
                : '...')}
      </div>
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
  // useRunStatus signature: (runId: string, initial: AgentRunRow) — pass a minimal initial
  // We cast to the required shape; null fields are acceptable for an in-flight run.
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

  // Concatenate all 'assistant' log entries into a single agent reply string.
  // parseAgentMessage extracts text blocks and filters ThinkingBlock / tool_use
  // envelopes that the SDK emits — without it the user sees raw JSON.
  const agentText = sortedLogs
    .filter((l) => l.message_type === 'assistant')
    .map((l) => parseAgentMessage(l.content))
    .filter(Boolean)
    .join('\n\n');

  const currentStatus = statusRow?.status ?? 'queued';

  return (
    <li data-testid={testid} className="flex flex-col gap-1">
      <div
        className="self-end max-w-[80%] bg-accent/10 p-2 rounded-md text-[13px] whitespace-pre-wrap"
        data-testid={`${testid}-user`}
      >
        {userText}
      </div>
      <div
        className="self-start max-w-[80%] bg-surface-raised border border-border p-2 rounded-md text-[13px] whitespace-pre-wrap leading-relaxed"
        data-testid={`${testid}-agent`}
      >
        {agentText ||
          (currentStatus === 'queued' || currentStatus === 'dispatched'
            ? '...'
            : currentStatus ?? '...')}
      </div>
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
