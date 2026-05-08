'use server';
/**
 * Chat-specific Server Actions for the per-agent Chat tab.
 *
 * triggerChatRun — dispatches a chat message as a new agent_runs row with
 *   trigger_type='chat' and the linked-list parent_thread_id pointing to the
 *   previous run in the conversation (NOT the first/anchor run — Pitfall 2).
 *
 * clearConversation — audit-logs the user's intent to clear the thread; no
 *   DB rows are deleted (audit history is preserved). The thread "reset" is
 *   purely a client-side state update (latestRunIdForThread = null).
 */
import { createClient } from '@/lib/supabase/server';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { triggerRun } from '../../_actions';

export async function triggerChatRun(
  agentId: string,
  message: string,
  parentThreadId: string | null,
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  if (!message?.trim()) return { ok: false, error: 'message_required' };
  if (message.length > 5000) return { ok: false, error: 'message_too_long' };

  const claims = await requireAgentosRole(`/agentos/agents/${agentId}`);

  // Confirm agent exists, is activated, and is not deleted.
  const sb = await createClient();
  const { data: agent } = await sb
    .schema('agentos')
    .from('agents')
    .select('id, is_draft, deleted_at, status')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent || agent.deleted_at)
    return { ok: false, error: 'agent_not_found' };
  if (agent.is_draft) return { ok: false, error: 'cannot_chat_with_draft' };
  if (agent.status === 'paused') return { ok: false, error: 'agent_paused' };

  // Suppress unused variable warning — claims is used to ensure auth guard ran.
  void claims;

  return triggerRun(agentId, { prompt: message }, {
    trigger_type: 'chat',
    parent_thread_id: parentThreadId,
  });
}

/**
 * "Clear conversation" — does NOT delete past runs (audit history preserved).
 * Effect is purely client-side: the next chat message will have parent_thread_id=null.
 * This server action writes an audit row so the clear intent is traceable.
 */
export async function clearConversation(
  agentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claims = await requireAgentosRole(`/agentos/agents/${agentId}`);
  const sb = await createClient();

  // Best-effort audit log — swallow on failure.
  try {
    await sb.schema('agentos').from('audit_logs').insert({
      user_id: claims.sub,
      action: 'agent_config_update', // reuse existing enum value
      target_table: 'agents',
      target_id: agentId,
      before_value: null,
      after_value: { event: 'chat_thread_cleared' },
    });
  } catch {
    // swallow — audit failure should not break UX
  }

  return { ok: true };
}
