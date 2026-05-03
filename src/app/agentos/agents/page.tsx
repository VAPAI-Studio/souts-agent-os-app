import Link from 'next/link';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';

export default async function AgentsListPage() {
  const claims = await requireAgentosRole('/agentos/agents');
  const supabase = await createClient();

  // RLS in Plan 01-02 already filters by role: admin sees all, others see what
  // they're entitled to. We just filter out soft-deleted rows.
  const { data: agents, error } = await supabase
    .schema('agentos')
    .from('agents')
    .select(
      'id, name, department, status, autonomy_level, model_tier, owner_id, updated_at, created_at',
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return (
      <p data-testid="agents-load-error">
        Failed to load agents: {error.message}
      </p>
    );
  }

  // Resolve owner emails (auth.users not in PostgREST; service-role lookup like team/page.tsx)
  const ownerIds = (agents ?? []).map((a) => a.owner_id);
  const emailMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: usersData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const u of usersData?.users ?? []) {
      if (ownerIds.includes(u.id)) emailMap.set(u.id, u.email ?? '(no email)');
    }
  }

  return (
    <section>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h1>Agents</h1>
        {claims.app_role === 'admin' && (
          <Link
            href="/agentos/agents/new"
            data-testid="new-agent-link"
            style={{ marginLeft: 'auto' }}
          >
            + New agent
          </Link>
        )}
      </header>

      <table
        data-testid="agents-table"
        style={{ borderCollapse: 'collapse', width: '100%' }}
      >
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Name</th>
            <th style={{ padding: '0.5rem' }}>Department</th>
            <th style={{ padding: '0.5rem' }}>Status</th>
            <th style={{ padding: '0.5rem' }}>Autonomy</th>
            <th style={{ padding: '0.5rem' }}>Model</th>
            <th style={{ padding: '0.5rem' }}>Owner</th>
            <th style={{ padding: '0.5rem' }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {(agents ?? []).map((a) => (
            <tr
              key={a.id}
              data-testid={`agent-row-${a.id}`}
              style={{ borderBottom: '1px solid #eee' }}
            >
              <td style={{ padding: '0.5rem' }}>
                <Link href={`/agentos/agents/${a.id}`}>{a.name}</Link>
              </td>
              <td style={{ padding: '0.5rem' }}>{a.department}</td>
              <td
                style={{ padding: '0.5rem' }}
                data-testid={`agent-status-${a.id}`}
              >
                {a.status}
              </td>
              <td style={{ padding: '0.5rem' }}>{a.autonomy_level}</td>
              <td style={{ padding: '0.5rem' }}>{a.model_tier}</td>
              <td style={{ padding: '0.5rem' }}>
                {emailMap.get(a.owner_id) ?? a.owner_id}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {new Date(a.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
          {(agents ?? []).length === 0 && (
            <tr>
              <td
                colSpan={7}
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  color: '#888',
                }}
              >
                No agents yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
