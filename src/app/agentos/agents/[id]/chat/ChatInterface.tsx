'use client';
/**
 * ChatInterface — per-agent chat client component.
 *
 * Manages:
 *   - Local state: inputValue, currentRunId, currentUserText, historicalMessages,
 *     latestRunIdForThread, sending, error
 *   - On mount: loads historical chat runs for this (user, agent) pair from Supabase
 *   - Send: dispatches triggerChatRun(agentId, message, parentThreadId)
 *   - Linked-list parent_thread_id: parentThreadId = currentRunId ?? latestRunIdForThread
 *     (Pitfall 2 — NOT thread-anchor, points to previous run)
 *   - When run terminates (completed/failed/cancelled/expired): appends to historicalMessages
 *   - Clear: resets in-state thread; next message has parent_thread_id=null
 *
 * Realtime: LiveChatMessage (in ChatMessageList) subscribes to useRunStatus + useRunLogs
 * while currentRunId is set. Approval-gate state surfaces in chat bubble.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { useRunStatus } from '@/lib/supabase/realtime';
import { createClient } from '@/lib/supabase/client';
import { ChatMessageList, type HistoricalChatMessage } from './ChatMessageList';
import { triggerChatRun, clearConversation } from './_actions';
import {
  parseAgentMessageParts,
  type MessagePart,
} from '@/lib/chat/parseAgentMessage';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

export function ChatInterface({
  agentId,
  userId,
  initialLatestRunId,
}: {
  agentId: string;
  userId: string;
  initialLatestRunId: string | null;
}) {
  const [input, setInput] = useState('');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentUserText, setCurrentUserText] = useState<string | null>(null);
  const [historicalMessages, setHistoricalMessages] = useState<HistoricalChatMessage[]>([]);
  const [latestRunIdForThread, setLatestRunIdForThread] = useState<string | null>(
    initialLatestRunId,
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // On mount: load historical chat runs for this user+agent pair.
  // We hydrate both agent_runs.output (final text envelope) AND assistant
  // entries in run_logs (which carry tool_use blocks). Output alone is text-
  // only on completed chat runs — without run_logs the tool-call chips would
  // be invisible after reload.
  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data: runs } = await sb
        .schema('agentos')
        .from('agent_runs')
        .select('id, status, input, output, created_at, parent_thread_id')
        .eq('agent_id', agentId)
        .eq('triggered_by', userId)
        .eq('trigger_type', 'chat')
        .order('created_at', { ascending: true })
        .limit(50);

      if (!runs || runs.length === 0) return;

      // Batch-fetch assistant logs for all loaded runs in one round-trip.
      const runIds = runs.map((r) => r.id);
      const { data: logs } = await sb
        .schema('agentos')
        .from('run_logs')
        .select('run_id, content, sequence_number, message_type')
        .in('run_id', runIds)
        .eq('message_type', 'assistant')
        .order('sequence_number', { ascending: true });

      const partsByRun = new Map<string, MessagePart[]>();
      for (const log of logs ?? []) {
        const prev = partsByRun.get(log.run_id) ?? [];
        prev.push(...parseAgentMessageParts(log.content));
        partsByRun.set(log.run_id, prev);
      }

      setHistoricalMessages(
        runs.map((r) => {
          // Prefer reconstructed parts from run_logs (preserves tool_use chips).
          // Fall back to output (e.g. legacy rows pre-log retention) when no
          // assistant logs are present.
          const logParts = partsByRun.get(r.id) ?? [];
          const agentParts =
            logParts.length > 0 ? logParts : parseAgentMessageParts(r.output);
          return {
            runId: r.id,
            userText:
              ((r.input as Record<string, unknown>)?.prompt as string) ?? '',
            agentParts,
            status: r.status,
            createdAt: r.created_at,
          };
        }),
      );
      setLatestRunIdForThread(runs[runs.length - 1].id);
    })();
  }, [agentId, userId]);

  // Watch the in-flight run status via Realtime; when it terminates, append to history.
  const liveStatus = useRunStatus(
    currentRunId ?? 'noop',
    {
      id: currentRunId ?? 'noop',
      status: 'queued',
      cost_usd: 0,
      output: null,
    },
  );

  useEffect(() => {
    if (!currentRunId || !currentUserText) return;
    if (!liveStatus || !TERMINAL_STATUSES.has(liveStatus.status)) return;

    // Snapshot run_logs so the static bubble keeps the tool_use chips the
    // LiveChatMessage was already rendering. Falls back to liveStatus.output
    // when the logs query is empty (older agents, log-retention truncation).
    const snapshotRunId = currentRunId;
    const snapshotUserText = currentUserText;
    const snapshotStatus = liveStatus.status;
    const snapshotCompletedAt =
      (liveStatus.completed_at as string | null) ?? new Date().toISOString();
    const snapshotOutput = liveStatus.output;

    (async () => {
      const sb = createClient();
      const { data: logs } = await sb
        .schema('agentos')
        .from('run_logs')
        .select('content, sequence_number, message_type')
        .eq('run_id', snapshotRunId)
        .eq('message_type', 'assistant')
        .order('sequence_number', { ascending: true });

      const parts: MessagePart[] = (logs ?? []).flatMap((l) =>
        parseAgentMessageParts(l.content),
      );
      const agentParts =
        parts.length > 0 ? parts : parseAgentMessageParts(snapshotOutput);

      setHistoricalMessages((prev) => [
        ...prev,
        {
          runId: snapshotRunId,
          userText: snapshotUserText,
          agentParts,
          status: snapshotStatus,
          createdAt: snapshotCompletedAt,
        },
      ]);
      setLatestRunIdForThread(snapshotRunId);
      setCurrentRunId(null);
      setCurrentUserText(null);
    })();
  }, [liveStatus?.status, currentRunId, currentUserText]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);

    // Linked-list: parent is the most-recent run (NOT the first/anchor run — Pitfall 2).
    const parentThreadId = currentRunId ?? latestRunIdForThread;
    const result = await triggerChatRun(agentId, trimmed, parentThreadId);

    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrentRunId(result.data.id);
    setCurrentUserText(trimmed);
    setInput('');
  }

  async function handleClear() {
    await clearConversation(agentId);
    setHistoricalMessages([]);
    setLatestRunIdForThread(null);
    setCurrentRunId(null);
    setCurrentUserText(null);
    setError(null);
  }

  const hasContent = historicalMessages.length > 0 || !!currentRunId;

  return (
    <Card data-testid="chat-interface" className="flex flex-col gap-4 p-4 min-h-[400px]">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-[14px]">Chat</h3>
        <Button
          data-testid="clear-conversation-btn"
          intent="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!hasContent}
        >
          Clear conversation
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ChatMessageList
          historicalMessages={historicalMessages}
          currentRunId={currentRunId}
          currentUserText={currentUserText}
        />

        {!hasContent && (
          <p className="text-text-muted text-[13px]">
            Start a conversation with this agent. Each message creates a real run
            with full observability, approval gates, and cost tracking.
          </p>
        )}
      </div>

      {error && (
        <p data-testid="chat-error" className="text-destructive text-[12px]">
          {error}
        </p>
      )}

      <div className="flex gap-2 items-end mt-auto">
        <Textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent something…"
          rows={2}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending}
        />
        <Button
          data-testid="chat-send-btn"
          intent="primary"
          size="sm"
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </Card>
  );
}
