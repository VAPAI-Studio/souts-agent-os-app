import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { AgentActions } from './AgentActions';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const claims = await requireAgentosRole(`/agentos/agents/${id}`);
  const supabase = await createClient();

  const { data: agent, error } = await supabase
    .schema('agentos')
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !agent) return notFound();

  const { data: recentRuns } = await supabase
    .schema('agentos')
    .from('agent_runs')
    .select(
      'id, status, cost_usd, started_at, completed_at, trigger_type',
    )
    .eq('agent_id', id)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(20);

  const isAdmin = claims.app_role === 'admin';
  const isOwner = claims.sub === agent.owner_id;
  const canEdit = isAdmin || isOwner;

  return (
    <section>
      <header
        style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <h1 data-testid="agent-name">{agent.name}</h1>
        <span
          data-testid="agent-status-badge"
          style={{
            padding: '0.25rem 0.5rem',
            background: agent.status === 'paused' ? '#fa6' : '#6f6',
          }}
        >
          {agent.status}
        </span>
        {agent.deleted_at && (
          <span style={{ color: 'red' }}>(deleted)</span>
        )}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          {canEdit && (
            <Link
              href={`/agentos/agents/${id}/edit`}
              data-testid="edit-link"
            >
              Edit
            </Link>
          )}
          {isAdmin && !agent.deleted_at && <AgentActions agent={agent} />}
        </div>
      </header>

      <h2>Configuration</h2>
      <dl data-testid="agent-config">
        <dt>Department</dt>
        <dd>{agent.department}</dd>
        <dt>Autonomy level</dt>
        <dd>{agent.autonomy_level}</dd>
        <dt>Model tier</dt>
        <dd>{agent.model_tier}</dd>
        <dt>max_turns</dt>
        <dd>{agent.max_turns}</dd>
        <dt>Budget cap (USD)</dt>
        <dd>{agent.budget_cap_usd}</dd>
        <dt>Sensitive tools</dt>
        <dd>
          {(agent.config?.sensitive_tools ?? []).join(', ') || '(none)'}
        </dd>
        <dt>Denylist globs</dt>
        <dd>
          {(agent.config?.denylist_globs ?? []).join(', ') || '(none)'}
        </dd>
        <dt>System prompt</dt>
        <dd>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{agent.system_prompt}</pre>
        </dd>
      </dl>

      <h2>Recent runs</h2>
      <table
        data-testid="recent-runs-table"
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Trigger</th>
            <th style={{ padding: '0.5rem' }}>Cost</th>
            <th style={{ padding: '0.5rem' }}>Started</th>
            <th style={{ padding: '0.5rem' }}>Ended</th>
            <th style={{ padding: '0.5rem' }}>Run</th>
          </tr>
        </thead>
        <tbody>
          {(recentRuns ?? []).map((r) => (
            <tr
              key={r.id}
              data-testid={`run-row-${r.id}`}
              style={{ borderBottom: '1px solid #eee' }}
            >
              <td style={{ padding: '0.5rem' }}>{r.status}</td>
              <td style={{ padding: '0.5rem' }}>{r.trigger_type}</td>
              <td style={{ padding: '0.5rem' }}>
                ${Number(r.cost_usd ?? 0).toFixed(4)}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {r.started_at
                  ? new Date(r.started_at).toLocaleString()
                  : '-'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {r.completed_at
                  ? new Date(r.completed_at).toLocaleString()
                  : '-'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/agentos/runs/${r.id}`}>open</Link>
              </td>
            </tr>
          ))}
          {(recentRuns ?? []).length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: '1rem', textAlign: 'center' }}>
                No runs yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
