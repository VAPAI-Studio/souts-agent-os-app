import { getAgentosClaims } from '@/lib/supabase/agentos';

export default async function NoAccessPage() {
  const claims = await getAgentosClaims();
  return (
    <main style={{ maxWidth: 600, margin: '4rem auto', padding: '0 1rem' }} data-testid="no-access">
      <h1>No access to souts-agent-os</h1>
      {claims ? (
        <>
          <p>
            You are signed in as <strong>{claims.email ?? claims.sub}</strong>, but you have not been granted an
            agentos role yet.
          </p>
          <p>Contact an Admin to request access.</p>
          <form action="/auth/signout" method="post">
            <button type="submit" data-testid="no-access-signout">Sign out</button>
          </form>
        </>
      ) : (
        <>
          <p>You must be signed in to access this area.</p>
          <p>
            <a href="/login">Sign in</a>
          </p>
        </>
      )}
    </main>
  );
}
