import { requireAgentosRole } from '@/lib/supabase/agentos';

export default async function AgentosHome() {
  const claims = await requireAgentosRole('/agentos');
  return (
    <section>
      <h1 data-testid="agentos-home-heading">souts-agent-os</h1>
      <p>
        Welcome, <strong>{claims.email ?? claims.sub}</strong>. Your role is <strong>{claims.app_role}</strong>.
      </p>
      <p>The full dashboard ships in a later phase. For now, this page exists to verify the auth guard.</p>
    </section>
  );
}
