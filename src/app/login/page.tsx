import { login } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Sign in</h1>
      <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input type="hidden" name="redirect" value={params.redirect ?? '/agentos'} />
        <label>
          Email
          <input id="email" name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit" data-testid="login-submit">Sign in</button>
      </form>
      {params.error && (
        <p data-testid="login-error" style={{ color: 'red', marginTop: '1rem' }}>
          {decodeURIComponent(params.error)}
        </p>
      )}
      <p style={{ marginTop: '2rem' }}>
        No account? <a href="/signup">Sign up</a>
      </p>
    </main>
  );
}
