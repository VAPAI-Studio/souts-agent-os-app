'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/Badge';

interface Props {
  initialCount?: number;
}

/**
 * Sidebar badge showing pending approval count. Subscribes to agentos.approval_requests
 * with filter status=eq.pending. INSERT increments; UPDATE-out-of-pending decrements.
 *
 * Plan 03-04 deviation #2: setAuth(access_token) BEFORE .subscribe().
 */
export function PendingBadge({ initialCount = 0 }: Props) {
  const [count, setCount] = useState<number>(initialCount);
  const sbRef = useRef(createClient());

  useEffect(() => {
    const sb = sbRef.current;
    let channel: ReturnType<typeof sb.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Re-read initial count (handles client navigation when initialCount stale)
      const { data: { session } } = await sb.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        // CRITICAL: setAuth BEFORE subscribe
        sb.realtime.setAuth(session.access_token);
      }

      const { count: liveCount } = await sb
        .schema('agentos')
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (cancelled) return;
      if (typeof liveCount === 'number') setCount(liveCount);

      channel = sb
        .channel('approvals-pending-count')
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          { event: 'INSERT', schema: 'agentos', table: 'approval_requests', filter: 'status=eq.pending' },
          () => setCount((c) => c + 1),
        )
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'postgres_changes' as any,
          { event: 'UPDATE', schema: 'agentos', table: 'approval_requests' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const oldRow = payload?.old ?? {};
            const newRow = payload?.new ?? {};
            if (oldRow.status === 'pending' && newRow.status !== 'pending') {
              setCount((c) => Math.max(0, c - 1));
            }
            if (oldRow.status !== 'pending' && newRow.status === 'pending') {
              setCount((c) => c + 1);
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, []);

  if (count === 0) return null;

  return (
    <Badge tone="warning" data-testid="pending-approvals-badge">
      {count}
    </Badge>
  );
}
