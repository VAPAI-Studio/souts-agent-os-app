import Link from 'next/link';
import { getAgentosClaims } from '@/lib/supabase/agentos';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default async function NoAccessPage() {
  const claims = await getAgentosClaims();
  return (
    <main
      className="max-w-[600px] mx-auto mt-2xl px-md"
      data-testid="no-access"
    >
      <Card>
        <CardBody className="flex flex-col gap-md">
          <h1 className="text-[16px] font-semibold">No access to AgentOS</h1>
          {claims ? (
            <>
              <p className="text-text-muted">
                You are signed in as{' '}
                <strong className="text-text">
                  {claims.email ?? claims.sub}
                </strong>
                , but you have not been granted an AgentOS role yet.
              </p>
              <p className="text-text-muted">
                Contact an admin to request access.
              </p>
              <form action="/auth/signout" method="post">
                <Button
                  type="submit"
                  intent="secondary"
                  size="sm"
                  data-testid="no-access-signout"
                >
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-text-muted">
                You must be signed in to access this area.
              </p>
              <p>
                <Link href="/login" className="text-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
