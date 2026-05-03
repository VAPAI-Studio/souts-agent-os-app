// Helpers for reading the agentos role claim and gating server components / server actions.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AgentosRole = 'admin' | 'member' | 'agent_owner' | 'viewer';

export interface AgentosClaims {
  sub: string;
  app_role?: AgentosRole;
  email?: string;
}

/**
 * Reads verified JWT claims for the current request.
 * Uses getClaims() — validates JWT signature against JWKS. Do NOT use getSession() (cookies spoofable).
 */
export async function getAgentosClaims(): Promise<AgentosClaims | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return {
    sub: data.claims.sub as string,
    app_role: data.claims.app_role as AgentosRole | undefined,
    email: data.claims.email as string | undefined,
  };
}

/**
 * Server-component / server-action guard.
 * - No session -> redirect to /login?redirect=<currentPath>
 * - Session but no agentos role -> redirect to /agentos/no-access
 */
export async function requireAgentosRole(currentPath: string): Promise<AgentosClaims> {
  const claims = await getAgentosClaims();
  if (!claims) {
    redirect(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }
  if (!claims.app_role) {
    redirect('/agentos/no-access');
  }
  return claims;
}

/**
 * Server-component / server-action guard requiring admin role.
 */
export async function requireAdmin(currentPath: string): Promise<AgentosClaims> {
  const claims = await requireAgentosRole(currentPath);
  if (claims.app_role !== 'admin') {
    redirect('/agentos/no-access');
  }
  return claims;
}

/**
 * Server-action guard that allows admin OR the resource owner.
 * Used for updateAgent / EditAgentForm gating where the owner can edit
 * their own agent without being admin.
 */
export async function requireAdminOrOwner(
  currentPath: string,
  ownerId: string,
): Promise<AgentosClaims> {
  const claims = await requireAgentosRole(currentPath);
  if (claims.app_role === 'admin') return claims;
  if (claims.sub === ownerId) return claims;
  redirect('/agentos/no-access');
}
