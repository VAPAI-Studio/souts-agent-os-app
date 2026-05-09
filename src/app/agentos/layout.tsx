import * as React from 'react';
import { getAgentosClaims } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from './_nav/SidebarNav';
import { GlobalErrorBanner } from './_components/GlobalErrorBanner';

/**
 * AgentOS layout — Server Component.
 *
 * Auth contract (DO NOT change):
 *   - This layout READS claims via getAgentosClaims() (returns null when signed out
 *     or claims invalid). It does NOT enforce roles — each page keeps its own gate
 *     so the post-login redirect path stays accurate (RESEARCH.md Pitfall 4).
 *   - Users with NO app_role (signed in but not provisioned) get a minimal-chrome
 *     layout so /agentos/no-access can render without sidebar / role badge.
 *
 * Visual contract (UI-SPEC.md Layout Shell):
 *   - Fixed left sidebar 220px wide, full height, surface-raised background.
 *   - Wordmark + nav + session block — see SidebarNav.tsx.
 *   - Main content area: flex-1, vertical scroll, p-xl (32px) horizontal/vertical padding.
 */
export default async function AgentosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const claims = await getAgentosClaims();

  // Signed out OR signed in with no agentos role — minimal chrome
  // (no-access page renders here without sidebar/role-conditional nav).
  if (!claims || !claims.app_role) {
    return (
      <div className="min-h-screen bg-surface text-text">
        <main className="p-xl">{children}</main>
      </div>
    );
  }

  // Admin-only: count how many services are currently 'down' for the GlobalErrorBanner.
  // Fail-soft: any DB error yields downCount=0 (never breaks the layout).
  let downCount = 0;
  if (claims.app_role === 'admin') {
    try {
      const supabase = await createClient();
      const { count } = await supabase
        .schema('agentos')
        .from('system_health_state')
        .select('*', { count: 'exact', head: true })
        .eq('last_state', 'down');
      downCount = count ?? 0;
    } catch {
      downCount = 0;
    }
  }

  return (
    <div
      data-app-role={claims.app_role}
      className="flex flex-col h-screen bg-surface text-text"
    >
      {claims.app_role === 'admin' && downCount > 0 && (
        <GlobalErrorBanner initialDownCount={downCount} />
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside
          aria-label="agentos sidebar"
          className="w-[220px] shrink-0 flex flex-col border-r border-border bg-surface-raised"
        >
          <SidebarNav email={claims.email} role={claims.app_role} />
        </aside>
        <main className="flex-1 overflow-y-auto p-xl">{children}</main>
      </div>
    </div>
  );
}
