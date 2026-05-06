// Run Detail page — Server Component initial render with auth gate.
// Hands data off to RunDetailLive (Client Component) which subscribes via Supabase Realtime.
//
// Plan 03-04 / TASK-04 — full message log + tool calls + cost + cancel + re-run.
// Plan 03.1-04 — page chrome (PageHeader) wrapper only; RunDetailLive untouched.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { RunDetailLive } from './RunDetailLive';
import { PageHeader } from '@/components/ui/PageHeader';
import type { AgentRunRow, RunLogRow } from '@/lib/supabase/realtime';

interface DraftMetaEntry {
  discarded_at: string | null;
  sent_at: string | null;
}

async function _countPendingDrafts(runId: string): Promise<number> {
  // Service-role storage download — admin-or-member already gated above; this
  // is a read-only metadata lookup. Sidecar absence => 0 drafts.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // service-role client never sets cookies
          },
        },
      },
    );
    const { data: blob, error } = await supabase.storage
      .from('vault')
      .download(`drafts/${runId}/_meta.json`);
    if (error || !blob) return 0;
    const text = await blob.text();
    const meta = JSON.parse(text) as { drafts?: Record<string, DraftMetaEntry> };
    if (!meta.drafts) return 0;
    return Object.values(meta.drafts).filter(
      (d) => !d.discarded_at && !d.sent_at,
    ).length;
  } catch {
    return 0;
  }
}

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

  // Plan 06-02b: count pending drafts to render the run-drafts-badge.
  const pendingDraftsCount = await _countPendingDrafts(id);

  const runTitle = 'Run ' + id.slice(0, 8);
  const agentHref = agent ? `/agentos/agents/${agent.id}` : '#';
  const agentMeta = agent && (
    <>
      <span className="text-text-muted text-[12px]">Agent</span>
      <Link href={agentHref} className="text-accent hover:underline">
        {agent.name}
      </Link>
    </>
  );

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title={runTitle} meta={agentMeta} />
      <RunDetailLive
        runId={id}
        agent={(agent as AgentSummary | null) ?? null}
        initialRun={run as unknown as AgentRunRow}
        initialLogs={(logs ?? []) as unknown as RunLogRow[]}
        initialToolCalls={(toolCalls ?? []) as unknown as ToolCallRow[]}
        pendingDraftsCount={pendingDraftsCount}
      />
    </section>
  );
}
