import Link from 'next/link';
import { login } from './actions';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          No account?{' '}
          <Link
            href="/signup"
            className="text-accent hover:underline underline-offset-2"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form action={login} className="flex flex-col gap-md">
        <input type="hidden" name="redirect" value={params.redirect ?? '/agentos'} />

        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            error={!!error}
          />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            error={!!error}
          />
        </FormField>

        <Button
          type="submit"
          intent="primary"
          size="md"
          className="mt-xs"
          data-testid="login-submit"
        >
          Sign in
        </Button>

        {error && (
          <p
            data-testid="login-error"
            role="alert"
            className="text-[12px] text-destructive font-sans"
          >
            {error}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
