'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props { initialIds: string[] }

/**
 * Subscribe to agentos.approval_requests row events. INSERT (status=pending) -> router.refresh().
 * UPDATE-out-of-pending -> router.refresh(). Realtime delivers row deltas, not enriched JOINs;
 * router.refresh() triggers the Server Component to re-run its agents!inner SELECT.
 *
 * Plan 03-04 deviation #2: setAuth(access_token) BEFORE .subscribe() — without it RLS evaluates
 * as anon and zero events arrive.
 */
export function ApprovalRealtimeList({ initialIds }: Props) {
  const knownIdsRef = useRef<Set<string>>(new Set(initialIds));
  const sbRef = useRef(createClient());
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    const sb = sbRef.current;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (cancelled) return;
      // CRITICAL: setAuth BEFORE subscribe — Plan 03-04 deviation #2.
      if (session?.access_token) {
        sb.realtime.setAuth(session.access_token);
      }
      channel = sb
        .channel('approvals-pending')
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'agentos', table: 'approval_requests', filter: 'status=eq.pending' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const newId = String(payload?.new?.id ?? '');
            if (newId && !knownIdsRef.current.has(newId)) {
              knownIdsRef.current.add(newId);
              router.refresh();
              setTick((t) => t + 1);
            }
          },
        )
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          { event: 'UPDATE', schema: 'agentos', table: 'approval_requests' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const newRow = payload?.new ?? {};
            const oldRow = payload?.old ?? {};
            if (oldRow.status === 'pending' && newRow.status !== 'pending') {
              knownIdsRef.current.delete(String(newRow.id));
              router.refresh();
              setTick((t) => t + 1);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [router]);

  return <div data-testid="approvals-realtime-mount" className="hidden" aria-hidden="true" />;
}
