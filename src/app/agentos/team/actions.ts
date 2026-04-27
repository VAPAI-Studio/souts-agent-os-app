'use server';

import { revalidatePath } from 'next/cache';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/agentos';

type AgentosRole = 'admin' | 'member' | 'agent_owner' | 'viewer';

function makeAdminClient() {
  // Service-role client — server-only. Used for admin.listUsers (auth.users is not in PostgREST).
  // The key never leaves the server (this file is 'use server').
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function isLastAdminError(error: { code?: string; message?: string }): boolean {
  return error.code === '23514' || (error.message ?? '').toLowerCase().includes('last admin');
}

export async function searchAuthUsers(emailSubstring: string) {
  await requireAdmin('/agentos/team');
  if (!emailSubstring || emailSubstring.length < 3) {
    return { users: [] as Array<{ id: string; email: string }> };
  }
  const admin = makeAdminClient();
  // listUsers paginates; for v1 we scan the first 1000 (the team is small)
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { error: error.message, users: [] };
  const q = emailSubstring.toLowerCase();
  const users = (data.users ?? [])
    .filter((u) => (u.email ?? '').toLowerCase().includes(q))
    .map((u) => ({ id: u.id, email: u.email ?? '(no email)' }));
  return { users };
}

export async function grantAgentosRole(input: { user_id: string; app_role: AgentosRole }) {
  const admin = await requireAdmin('/agentos/team');
  if (admin.sub === input.user_id) {
    return { error: 'You already have a role; cannot grant a role to yourself.' };
  }

  const supabase = await createClient();

  // Try INSERT; if a soft-deleted row exists, UPDATE it back to active instead.
  const { error: insertError } = await supabase
    .schema('agentos')
    .from('user_roles')
    .insert({
      user_id: input.user_id,
      app_role: input.app_role,
      granted_by: admin.sub,
    });

  if (insertError) {
    // 23505 = unique violation -> the user has an existing (possibly soft-deleted) row.
    if (insertError.code === '23505') {
      const { error: updateError } = await supabase
        .schema('agentos')
        .from('user_roles')
        .update({
          app_role: input.app_role,
          granted_by: admin.sub,
          granted_at: new Date().toISOString(),
          deleted_at: null,
        })
        .eq('user_id', input.user_id);
      if (updateError) return { error: updateError.message };
    } else {
      return { error: insertError.message };
    }
  }

  revalidatePath('/agentos/team');
  return { success: true };
}

export async function changeAgentosRole(input: { user_id: string; app_role: AgentosRole }) {
  const admin = await requireAdmin('/agentos/team');
  if (admin.sub === input.user_id) {
    return { error: 'Cannot change your own role. Have another Admin do it.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .schema('agentos')
    .from('user_roles')
    .update({ app_role: input.app_role })
    .eq('user_id', input.user_id)
    .is('deleted_at', null);

  if (error) {
    if (isLastAdminError(error)) {
      return { error: 'Cannot demote the last remaining Admin. Promote another user first.' };
    }
    return { error: error.message };
  }

  revalidatePath('/agentos/team');
  return { success: true };
}

export async function revokeAgentosRole(input: { user_id: string }) {
  const admin = await requireAdmin('/agentos/team');
  if (admin.sub === input.user_id) {
    return { error: 'Cannot revoke your own role. Have another Admin do it.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .schema('agentos')
    .from('user_roles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', input.user_id)
    .is('deleted_at', null);

  if (error) {
    if (isLastAdminError(error)) {
      return { error: 'Cannot revoke the last remaining Admin. Promote another user first.' };
    }
    return { error: error.message };
  }

  revalidatePath('/agentos/team');
  return { success: true };
}
