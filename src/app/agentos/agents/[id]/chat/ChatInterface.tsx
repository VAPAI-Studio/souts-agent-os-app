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

      if (runs && runs.length > 0) {
        setHistoricalMessages(
          runs.map((r) => ({
            runId: r.id,
            userText:
              ((r.input as Record<string, unknown>)?.prompt as string) ?? '',
            agentText:
              typeof r.output === 'string'
                ? r.output
                : r.output
                  ? JSON.stringify(r.output)
                  : '',
            status: r.status,
            createdAt: r.created_at,
          })),
        );
        setLatestRunIdForThread(runs[runs.length - 1].id);
      }
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

    setHistoricalMessages((prev) => [
      ...prev,
      {
        runId: currentRunId,
        userText: currentUserText,
        agentText:
          typeof liveStatus.output === 'string'
            ? liveStatus.output
            : liveStatus.output
              ? JSON.stringify(liveStatus.output)
              : '',
        status: liveStatus.status,
        createdAt:
          (liveStatus.completed_at as string | null) ?? new Date().toISOString(),
      },
    ]);
    setLatestRunIdForThread(currentRunId);
    setCurrentRunId(null);
    setCurrentUserText(null);
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
