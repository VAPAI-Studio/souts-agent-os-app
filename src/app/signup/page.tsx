import { signup } from './actions';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Sign up</h1>
      <p>
        Create an account. After sign-up you will not have access to souts-agent-os until an Admin grants you a role.
      </p>
      <form action={signup} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Email
          <input id="email" name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
        </label>
        <button type="submit" data-testid="signup-submit">Sign up</button>
      </form>
      {params.error && (
        <p data-testid="signup-error" style={{ color: 'red', marginTop: '1rem' }}>
          {decodeURIComponent(params.error)}
        </p>
      )}
      <p style={{ marginTop: '2rem' }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </main>
  );
}
