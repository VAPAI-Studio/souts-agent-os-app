import Link from 'next/link';
import { signup } from './actions';
import { AuthShell } from '@/components/auth/AuthShell';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;

  return (
    <AuthShell
      title="Create account"
      subtitle="After sign-up an Admin must grant you a role before you can access AgentOS."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-accent hover:underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form action={signup} className="flex flex-col gap-md">
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

        <FormField
          label="Password"
          htmlFor="password"
          hint="Minimum 6 characters"
        >
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            error={!!error}
          />
        </FormField>

        <Button
          type="submit"
          intent="primary"
          size="md"
          className="mt-xs"
          data-testid="signup-submit"
        >
          Sign up
        </Button>

        {error && (
          <p
            data-testid="signup-error"
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
