// Run Detail page — Server Component initial render with auth gate.
// Hands data off to RunDetailLive (Client Component) which subscribes via Supabase Realtime.
//
// Plan 03-04 / TASK-04 — full message log + tool calls + cost + cancel + re-run.
import { notFound } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { RunDetailLive } from './RunDetailLive';
import type { AgentRunRow, RunLogRow } from '@/lib/supabase/realtime';

interface AgentSummary {
  id: string;
  name: string;
  department: string;
  model_tier: string;
}

interface ToolCallRow {
  id: string;
  tool_name: string;
  tool_input: unknown;
  tool_output: unknown;
  duration_ms: number | null;
  success: boolean | null;
  created_at: string;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgentosRole(`/agentos/runs/${id}`);
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .schema('agentos')
    .from('agent_runs')
    .select(
      'id, status, cost_usd, output, error_message, started_at, completed_at, agent_id, input, trigger_type, modal_container_id',
    )
    .eq('id', id)
    .single();

  if (error || !run) return notFound();

  const { data: agent } = await supabase
    .schema('agentos')
    .from('agents')
    .select('id, name, department, model_tier')
    .eq('id', run.agent_id)
    .single();

  const { data: logs } = await supabase
    .schema('agentos')
    .from('run_logs')
    .select('id, run_id, message_type, content, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  const { data: toolCalls } = await supabase
    .schema('agentos')
    .from('tool_call_logs')
    .select('id, tool_name, tool_input, tool_output, duration_ms, success, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true })
    .limit(200);

  return (
    <RunDetailLive
      runId={id}
      agent={(agent as AgentSummary | null) ?? null}
      initialRun={run as unknown as AgentRunRow}
      initialLogs={(logs ?? []) as unknown as RunLogRow[]}
      initialToolCalls={(toolCalls ?? []) as unknown as ToolCallRow[]}
    />
  );
}
