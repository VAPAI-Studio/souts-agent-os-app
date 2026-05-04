import * as React from 'react';
import { getAgentosClaims } from '@/lib/supabase/agentos';
import { SidebarNav } from './_nav/SidebarNav';

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

  return (
    <div
      data-app-role={claims.app_role}
      className="flex h-screen bg-surface text-text"
    >
      <aside
        aria-label="agentos sidebar"
        className="w-[220px] shrink-0 flex flex-col border-r border-border bg-surface-raised"
      >
        <SidebarNav email={claims.email} role={claims.app_role} />
      </aside>
      <main className="flex-1 overflow-y-auto p-xl">{children}</main>
    </div>
  );
}
