/**
 * Phase 6 / Plan 06-05 — Dashboard home page (`/agentos/dashboard`).
 *
 * Server Component. Fetches today's COO run + vault signed URL + pending
 * drafts count, then hands off to the client `CooCard` for the seven-state
 * Realtime-driven render.
 *
 * UI-SPEC §Surface 4 — Page layout: PageHeader title "Dashboard" + COO card
 * occupying the top full-width slot. No actions slot at MVP.
 *
 * Auth gate: dashboard is visible to all agentos roles
 * (admin / member / agent_owner / viewer). The page calls
 * `requireAgentosRole` which redirects the unprovisioned to /agentos/no-access.
 *
 * COO discovery: `agents.kind='supervisor' AND config->>'coo'='true'`. Until
 * Plan 06-04's seed migration is applied to live Supabase, the COO row does
 * NOT exist — the page renders a graceful "no COO seeded yet" state via the
 * card's `cooAgentId=null` branch (UI shows a [Run now] disabled with a
 * migration hint).
 */
import { createServerClient } from '@supabase/ssr';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { CooCard } from './_components/CooCard';
import {
  fetchCooAgentId,
  fetchTodaysCooRun,
  generateVaultSignedUrl,
  fetchPendingDraftsCount,
  todayIsoUtc,
} from './_data/coo';

function _serviceRoleClient() {
  // Inline service-role factory — Phase 4/06-02b plans noted
  // createServiceRoleClient is not exported from lib/supabase/server.ts;
  // compose with createServerClient + SERVICE_ROLE_KEY directly. Used here
  // for Storage signed-URL generation + sidecar download (RLS would block
  // the authenticated user JWT for vault Storage reads in this surface).
  return createServerClient(
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
}

export default async function DashboardPage() {
  await requireAgentosRole('/agentos/dashboard');

  // User-scoped client for the agents/agent_runs lookups (RLS enforced; the
  // policies set up in Plan 01-02 + 06-02 already permit any authenticated
  // role to SELECT these tables).
  const userSupabase = await createClient();
  const serviceSupabase = _serviceRoleClient();

  // Pull the access token so the client component can call setAuth before
  // subscribing — Phase 5 pitfall #10. Fall back to null and the component
  // re-resolves it from the browser session.
  const { data: sessionData } = await userSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;

  const cooAgentId = await fetchCooAgentId(userSupabase);
  const todayIso = todayIsoUtc();

  // No COO agent seeded yet — render the card in its no-run state with a
  // migration hint. Do NOT crash (hard acceptance from CLAUDE.md guidance).
  if (!cooAgentId) {
    return (
      <section className="flex flex-col gap-lg">
        <PageHeader title="Dashboard" />
        <CooCard
          cooAgentId={null}
          initialRun={null}
          vaultUrl={null}
          draftsPendingCount={0}
          accessToken={accessToken}
          todayIso={todayIso}
        />
      </section>
    );
  }

  const run = await fetchTodaysCooRun(userSupabase, cooAgentId);

  // Vault signed URL + drafts count only matter when there is a completed run.
  let vaultUrl: string | null = null;
  let draftsPendingCount = 0;
  if (run && run.status === 'completed') {
    vaultUrl = await generateVaultSignedUrl(serviceSupabase, todayIso);
    draftsPendingCount = await fetchPendingDraftsCount(
      serviceSupabase,
      run.id,
    );
  }

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader title="Dashboard" />
      <CooCard
        cooAgentId={cooAgentId}
        initialRun={run}
        vaultUrl={vaultUrl}
        draftsPendingCount={draftsPendingCount}
        accessToken={accessToken}
        todayIso={todayIso}
      />
    </section>
  );
}
