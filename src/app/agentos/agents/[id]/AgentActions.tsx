'use client';
/**
 * AgentActions — Client Component bar of action buttons on the Agent Detail page.
 *
 * Buttons:
 *   - Trigger run     (Plan 03-04 / TASK-01)
 *   - Pause / Resume  (Plan 03-03 / AGENT-05)
 *   - Duplicate       (Plan 03-03 / AGENT-06)
 *   - Delete          (Plan 03-03 / AGENT-07, soft delete)
 *
 * Each button calls a Server Action exported from ../_actions and surfaces
 * `r.error` inline on failure.
 *
 * NOTE: this file is the conflict surface with parallel Plan 03-03. Both plans
 * append into this file. Keep button rendering flat and named so additions can
 * be slotted in without restructuring.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  triggerRun,
  pauseAgent,
  resumeAgent,
  duplicateAgent,
  softDeleteAgent,
} from '../_actions';
import { Button } from '@/components/ui/Button';

export interface AgentSummary {
  id: string;
  name: string;
  status: string; // 'active' | 'paused'
}

export function AgentActions({ agent }: { agent: AgentSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isPaused = agent.status === 'paused';

  return (
    <div
      data-testid="agent-actions"
      className="flex items-center gap-sm flex-wrap"
    >
      {/* Plan 03-04: Trigger Run */}
      <Button
        data-testid="trigger-run-btn"
        intent="primary"
        size="sm"
        disabled={isPending || isPaused}
        title={
          isPaused
            ? 'Agent is paused. Resume it before triggering a run.'
            : 'Trigger a run now'
        }
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await triggerRun(agent.id, {});
            if (!r.ok) {
              setError(r.error ?? 'trigger failed');
              return;
            }
            if (r.data?.id) router.push(`/agentos/runs/${r.data.id}`);
          })
        }
      >
        {isPending ? '...' : 'Trigger run'}
      </Button>

      {/* Plan 03-03: Pause / Resume */}
      {!isPaused ? (
        <Button
          data-testid="pause-btn"
          intent="secondary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await pauseAgent(agent.id);
              if (!r.ok) setError(r.error ?? 'pause failed');
            })
          }
        >
          Pause
        </Button>
      ) : (
        <Button
          data-testid="resume-btn"
          intent="secondary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await resumeAgent(agent.id);
              if (!r.ok) setError(r.error ?? 'resume failed');
            })
          }
        >
          Resume
        </Button>
      )}

      {/* Plan 03-03: Duplicate */}
      <Button
        data-testid="duplicate-btn"
        intent="secondary"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await duplicateAgent(agent.id);
            if (!r.ok) {
              setError(r.error ?? 'duplicate failed');
              return;
            }
            if (r.data?.id) router.push(`/agentos/agents/${r.data.id}`);
          })
        }
      >
        Duplicate
      </Button>

      {/* Plan 03-03: Soft delete */}
      <Button
        data-testid="delete-btn"
        intent="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => {
          const deleteConfirmString =
            'Delete agent "' + agent.name + '"? Run history is preserved.';
          if (!confirm(deleteConfirmString)) {
            return;
          }
          startTransition(async () => {
            setError(null);
            const r = await softDeleteAgent(agent.id);
            if (!r.ok) {
              setError(r.error ?? 'delete failed');
              return;
            }
            router.push('/agentos/agents');
          });
        }}
      >
        Delete
      </Button>

      {error && (
        <span
          className="text-destructive text-[12px]"
          data-testid="action-error"
        >
          {error}
        </span>
      )}
    </div>
  );
}
