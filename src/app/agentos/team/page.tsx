import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { revokeAgentosRole } from './actions';
import { AddMemberDialog } from './AddMemberDialog';
import { RoleSelect } from './RoleSelect';

type Role = 'admin' | 'member' | 'agent_owner' | 'viewer';

export default async function TeamPage() {
  const admin = await requireAdmin('/agentos/team');
  const supabase = await createClient();

  const { data: roles, error } = await supabase
    .schema('agentos')
    .from('user_roles')
    .select('id, user_id, app_role, granted_at, granted_by')
    .is('deleted_at', null)
    .order('granted_at', { ascending: false });

  if (error) {
    return <p data-testid="team-load-error">Failed to load team: {error.message}</p>;
  }

  // Resolve emails by joining to auth.users (not in PostgREST -> use service-role client)
  const userIds = (roles ?? []).map((r) => r.user_id);
  const emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: usersData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (userIds.includes(u.id)) emailMap.set(u.id, u.email ?? '(no email)');
    }
  }

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1>Team</h1>
        <AddMemberDialog />
      </header>

      <table data-testid="team-table" style={{ marginTop: '1.5rem', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '0.5rem' }}>Email</th>
            <th style={{ padding: '0.5rem' }}>Role</th>
            <th style={{ padding: '0.5rem' }}>Granted at</th>
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(roles ?? []).map((r) => (
            <tr key={r.id} data-testid={`team-row-${r.user_id}`} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{emailMap.get(r.user_id) ?? r.user_id}</td>
              <td style={{ padding: '0.5rem' }}>
                {r.user_id === admin.sub ? (
                  <span>{r.app_role} (you)</span>
                ) : (
                  <RoleSelect userId={r.user_id} currentRole={r.app_role as Role} />
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{new Date(r.granted_at).toLocaleString()}</td>
              <td style={{ padding: '0.5rem' }}>
                {r.user_id !== admin.sub && (
                  <form
                    action={async () => {
                      'use server';
                      await revokeAgentosRole({ user_id: r.user_id });
                    }}
                  >
                    <button type="submit" data-testid={`revoke-${r.user_id}`}>
                      Revoke
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
