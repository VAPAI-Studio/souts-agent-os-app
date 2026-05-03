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
      style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      {/* Plan 03-04: Trigger Run */}
      <button
        data-testid="trigger-run-btn"
        disabled={isPending || isPaused}
        title={isPaused ? 'Agent is paused' : 'Trigger a run now'}
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
        Trigger run
      </button>

      {/* Plan 03-03: Pause / Resume */}
      {!isPaused ? (
        <button
          data-testid="pause-btn"
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
        </button>
      ) : (
        <button
          data-testid="resume-btn"
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
        </button>
      )}

      {/* Plan 03-03: Duplicate */}
      <button
        data-testid="duplicate-btn"
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
      </button>

      {/* Plan 03-03: Soft delete */}
      <button
        data-testid="delete-btn"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete agent "${agent.name}"? Run history is preserved.`)) {
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
      </button>

      {error && (
        <span style={{ color: 'red' }} data-testid="action-error">
          {error}
        </span>
      )}
    </div>
  );
}
