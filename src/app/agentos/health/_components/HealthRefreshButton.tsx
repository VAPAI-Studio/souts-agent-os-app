'use client';
/**
 * Phase 9 / Plan 09-05 — HealthRefreshButton: Client Component.
 *
 * The ONLY client boundary on the Health page.
 * Calls the refreshHealthAction Server Action, then calls router.refresh()
 * to re-render the parent Server Component with a fresh snapshot.
 */
import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { refreshHealthAction } from '../_actions';

export function HealthRefreshButton() {
  const [isPending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      data-testid="health-refresh-button"
      intent="secondary"
      size="md"
      disabled={isPending}
      onClick={() =>
        start(async () => {
          await refreshHealthAction();
          router.refresh();
        })
      }
    >
      {isPending ? 'Refreshing…' : 'Refresh now'}
    </Button>
  );
}
