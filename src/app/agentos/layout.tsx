import Link from 'next/link';
import { getAgentosClaims } from '@/lib/supabase/agentos';

export default async function AgentosLayout({ children }: { children: React.ReactNode }) {
  // Layout reads claims but does NOT enforce. Each page decides its own gate.
  // This avoids redirect loops on /agentos/no-access (which is reachable by users
  // with no app_role) while still showing role-conditioned nav for users that have one.
  const claims = await getAgentosClaims();

  if (!claims || !claims.app_role) {
    // Minimal chrome for the no-access surface — no nav, no role info.
    return (
      <div style={{ minHeight: '100vh' }}>
        <main style={{ padding: '2rem' }}>{children}</main>
      </div>
    );
  }

  return (
    <div data-app-role={claims.app_role} style={{ minHeight: '100vh' }}>
      <nav
        aria-label="agentos navigation"
        style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem',
          borderBottom: '1px solid #eee',
          alignItems: 'center',
        }}
      >
        <Link href="/agentos">Home</Link>
        {claims.app_role === 'admin' && (
          <Link href="/agentos/team" data-testid="nav-team">Team</Link>
        )}
        <span data-testid="role-badge" style={{ marginLeft: 'auto', fontSize: '0.875rem' }}>
          Signed in as <strong>{claims.email ?? claims.sub}</strong> · Role: <strong>{claims.app_role}</strong>
        </span>
        <form action="/auth/signout" method="post" style={{ display: 'inline' }}>
          <button type="submit" data-testid="logout-button">Sign out</button>
        </form>
      </nav>
      <main style={{ padding: '2rem' }}>{children}</main>
    </div>
  );
}
