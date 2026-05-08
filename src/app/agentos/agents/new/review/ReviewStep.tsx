'use client';
/**
 * ReviewStep — Step 8 client orchestrator.
 *
 * Holds local state for sampleInput, currentRunId, lastTestRunCompleted.
 * Composes four child panes:
 *   - McpConnectionGate  (full-width top row — blocks Activate when MCP missing)
 *   - ConfigSummaryPane  (left column)
 *   - SampleInputPane + RunOutputPane  (center column)
 *   - (right column visual — RunOutputPane already renders cost/duration inline)
 *
 * CONTEXT.md / Phase 8 SC#2 / AGENT-11:
 *   Activate button is disabled until BOTH:
 *   (a) all required_mcp_servers are connected  (gateBlocked === false)
 *   (b) at least one live test run reaches status='completed'  (lastTestRunCompleted === true)
 *
 *   lastTestRunCompleted flips ONLY on status === 'completed'.
 *   Failed / cancelled / expired runs do NOT satisfy the gate — user must re-run.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useRunStatus, type AgentRunRow } from '@/lib/supabase/realtime';
import { activateDraft } from '../../_actions';
import { triggerTestRun, recheckMcpConnections } from './_actions';
import { ConfigSummaryPane } from './_components/ConfigSummaryPane';
import { SampleInputPane } from './_components/SampleInputPane';
import { RunOutputPane } from './_components/RunOutputPane';
import { McpConnectionGate } from './_components/McpConnectionGate';

/**
 * Wrapper that conditionally subscribes to run status.
 * Must call useRunStatus unconditionally (Rules of Hooks) so we use a
 * placeholder empty runId ('') when not yet dispatched; the hook only
 * subscribes to Realtime when runId is truthy — safe because the channel
 * filter `id=eq.` with empty string matches nothing.
 *
 * Returns null when runId is falsy (no active run yet).
 */
function useMaybeRunStatus(runId: string | null): AgentRunRow | null {
  const placeholder: AgentRunRow = { id: '', status: '', cost_usd: 0, output: null };
  const row = useRunStatus(runId ?? '', placeholder);
  if (!runId) return null;
  return row;
}

export function ReviewStep({
  draft,
  connectedServers,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
  connectedServers: string[];
}) {
  const router = useRouter();
  const [sampleInput, setSampleInput] = useState<string>('');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CONTEXT.md / Phase 8 SC#2 / AGENT-11: Activate is BLOCKED until at least one test run
  // completes. Set to true when a live run transitions to terminal-success status ('completed').
  const [lastTestRunCompleted, setLastTestRunCompleted] = useState<boolean>(false);

  const required: string[] = draft.required_mcp_servers ?? [];
  const missingServers = required.filter((s) => !connectedServers.includes(s));
  const gateBlocked = missingServers.length > 0;

  // Subscribe to the in-flight run's status so we can flip lastTestRunCompleted on success.
  // useMaybeRunStatus handles the null-runId case without violating Rules of Hooks.
  const liveStatus = useMaybeRunStatus(currentRunId);

  useEffect(() => {
    if (liveStatus?.status === 'completed') {
      setLastTestRunCompleted(true);
    }
  }, [liveStatus?.status]);

  async function handleRunTest() {
    if (!sampleInput.trim()) {
      setError('sample_input_required');
      return;
    }
    setError(null);
    setRunning(true);
    const result = await triggerTestRun(draft.id, sampleInput);
    setRunning(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrentRunId(result.data.id);
  }

  async function handleActivate() {
    if (gateBlocked || !lastTestRunCompleted) return;
    setActivating(true);
    const result = await activateDraft(draft.id);
    setActivating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="wizard-step-8">
      <McpConnectionGate
        requiredServers={required}
        connectedServers={connectedServers}
        missingServers={missingServers}
      />
      {gateBlocked && (
        <Button
          data-testid="recheck-mcp-btn"
          intent="ghost"
          size="sm"
          onClick={async () => {
            await recheckMcpConnections(draft.id);
            router.refresh();
          }}
        >
          Re-check connections
        </Button>
      )}
      <div className="grid lg:grid-cols-[1fr_2fr_1fr] gap-6">
        <ConfigSummaryPane draft={draft} />
        <div className="flex flex-col gap-4">
          <SampleInputPane
            department={draft.department}
            value={sampleInput}
            onChange={setSampleInput}
            onRun={handleRunTest}
            disabled={running}
          />
          <RunOutputPane runId={currentRunId} />
        </div>
        {/* Right column: RunOutputPane already renders cost/duration/tool-calls inline.
            Empty div preserves the three-column CSS grid layout. */}
        <div />
      </div>
      {error && (
        <p data-testid="review-error" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button asChild intent="ghost">
          <a
            href={`/agentos/agents/new/schedule?draft=${draft.id}`}
            data-testid="wizard-back-btn"
          >
            Back
          </a>
        </Button>
        {!gateBlocked && !lastTestRunCompleted && (
          <p
            data-testid="activate-needs-test-hint"
            className="text-xs text-muted-foreground self-center"
          >
            Run a test first — Activate enables once a test run completes.
          </p>
        )}
        <Button
          data-testid="activate-btn"
          intent="primary"
          onClick={handleActivate}
          disabled={gateBlocked || activating || !lastTestRunCompleted}
          title={
            gateBlocked
              ? 'Connect missing MCP servers before activating'
              : !lastTestRunCompleted
                ? 'Run at least one successful test before activating'
                : undefined
          }
        >
          {activating ? 'Activating…' : 'Activate agent'}
        </Button>
      </div>
    </div>
  );
}
