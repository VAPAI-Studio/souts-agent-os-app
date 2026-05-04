import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { revokeAgentosRole } from './actions';
import { AddMemberDialog } from './AddMemberDialog';
import { RoleSelect } from './RoleSelect';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

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
    <section className="flex flex-col gap-lg">
      <PageHeader title="Team" actions={<AddMemberDialog />} />
      {error ? (
        <p data-testid="team-load-error" className="text-destructive">
          Failed to load team: {error.message}. Refresh the page or check your connection.
        </p>
      ) : (
        <Table data-testid="team-table">
          <THead>
            <Tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Granted at</Th>
              <Th>Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {(roles ?? []).map((r) => {
              const revokeTestId = 'revoke-' + r.user_id;
              return (
                <Tr key={r.id} data-testid={`team-row-${r.user_id}`}>
                  <Td>{emailMap.get(r.user_id) ?? r.user_id}</Td>
                  <Td>
                    {r.user_id === admin.sub ? (
                      <span>{r.app_role} (you)</span>
                    ) : (
                      <RoleSelect userId={r.user_id} currentRole={r.app_role as Role} />
                    )}
                  </Td>
                  <Td className="font-mono text-text-muted">
                    {new Date(r.granted_at).toLocaleString()}
                  </Td>
                  <Td>
                    {r.user_id !== admin.sub && (
                      <form
                        action={async () => {
                          'use server';
                          await revokeAgentosRole({ user_id: r.user_id });
                        }}
                      >
                        <Button
                          type="submit"
                          intent="destructive"
                          size="sm"
                          data-testid={revokeTestId}
                        >
                          Revoke
                        </Button>
                      </form>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </section>
  );
}
