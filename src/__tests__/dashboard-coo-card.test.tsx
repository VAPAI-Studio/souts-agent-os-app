/**
 * Phase 6 / Plan 06-05 — Task 1 RED scaffold for the dashboard COO briefing card.
 *
 * Asserts UI-SPEC §Surface 4 contract — the seven distinct render states the
 * `CooCard` Client Component must produce based on `run` shape:
 *
 *   1. state-no-run                    — no COO run today        → [Run now]
 *   2. state-running                   — queued | running         → spinner, no CTA
 *   3. state-awaiting_approval         — awaiting_approval        → [Go to Approvals Inbox]
 *   4. state-completed-posted          — completed + slack ok     → [Read report] + [View run]
 *   5. state-completed-not-posted      — completed + slack !=true → [Read report] + [View run]
 *   6. state-completed-drafts-pending  — completed + N drafts > 0 → adds [Review drafts] + Badge
 *   7. state-failed                    — failed                   → [Re-run] + [View run]
 *
 * RED until Task 2 ships:
 *   - src/app/agentos/dashboard/_components/CooCard.tsx
 *   - src/app/agentos/dashboard/_actions.ts
 *
 * Realtime subscription is mocked at the module level (no live WS during the
 * unit test). Mirrors the drafts-viewer test pattern for env + ssr stubs.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Server Actions module so the client component import does not blow
// up at test time (vitest doesn't resolve 'use server' modules).
vi.mock('@/app/agentos/dashboard/_actions', () => ({
  triggerCooRun: vi.fn(),
}));

// Mock the browser supabase client so useEffect realtime setup is a no-op.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'test-token' } } }),
    },
    realtime: { setAuth: () => undefined },
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      },
    }),
    removeChannel: () => undefined,
  }),
}));

import { CooCard, type CooRun } from '@/app/agentos/dashboard/_components/CooCard';

const COO_AGENT_ID = 'agent-coo-1234';
const RUN_ID = 'run-abcd1234';
const TODAY_ISO = '2026-05-06';
const VAULT_URL = 'https://example.supabase.co/storage/v1/object/sign/vault/x';

const baseProps = {
  cooAgentId: COO_AGENT_ID,
  vaultUrl: VAULT_URL,
  draftsPendingCount: 0,
  accessToken: 'test-token',
  todayIso: TODAY_ISO,
};

function makeRun(partial: Partial<CooRun>): CooRun {
  return {
    id: RUN_ID,
    agent_id: COO_AGENT_ID,
    status: 'completed',
    created_at: `${TODAY_ISO}T09:00:00+00:00`,
    output: { slack_posted: true },
    error_message: null,
    ...partial,
  };
}

describe('CooCard', () => {
  it('state-no-run: renders Run now CTA with coo-card-trigger-btn testid', () => {
    render(<CooCard {...baseProps} initialRun={null} vaultUrl={null} />);
    const card = screen.getByTestId('coo-card');
    expect(card).toBeInTheDocument();
    expect(card.getAttribute('data-coo-card-status')).toBe('no-run');
    expect(screen.getByTestId('coo-card-trigger-btn')).toBeInTheDocument();
    expect(screen.getByText('Run now')).toBeInTheDocument();
    expect(screen.getByText('No COO report yet today')).toBeInTheDocument();
  });

  it('state-running: renders Generating heading without CTA buttons', () => {
    const run = makeRun({ status: 'running', output: null });
    render(<CooCard {...baseProps} initialRun={run} vaultUrl={null} />);
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe('running');
    expect(screen.getByText(/Generating daily report/)).toBeInTheDocument();
    expect(screen.queryByTestId('coo-card-trigger-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coo-card-approvals-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coo-card-report-link')).not.toBeInTheDocument();
  });

  it('state-awaiting_approval: renders coo-card-approvals-link with Go to Approvals Inbox', () => {
    const run = makeRun({ status: 'awaiting_approval', output: null });
    render(<CooCard {...baseProps} initialRun={run} vaultUrl={null} />);
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe('awaiting_approval');
    expect(screen.getByTestId('coo-card-approvals-link')).toBeInTheDocument();
    expect(screen.getByText('Go to Approvals Inbox')).toBeInTheDocument();
  });

  it('state-completed-posted: renders coo-card-report-link AND coo-card-run-link', () => {
    const run = makeRun({
      status: 'completed',
      output: { slack_posted: true },
    });
    render(<CooCard {...baseProps} initialRun={run} />);
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe('completed-posted');
    expect(screen.getByTestId('coo-card-report-link')).toBeInTheDocument();
    expect(screen.getByTestId('coo-card-run-link')).toBeInTheDocument();
    expect(screen.getByText('Read report')).toBeInTheDocument();
    expect(screen.getByText('View run')).toBeInTheDocument();
  });

  it('state-completed-not-posted: shows the not-sent body copy + same buttons', () => {
    const run = makeRun({
      status: 'completed',
      output: { slack_posted: false },
    });
    render(<CooCard {...baseProps} initialRun={run} />);
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe('completed-not-posted');
    expect(screen.getByTestId('coo-card-report-link')).toBeInTheDocument();
    expect(screen.getByTestId('coo-card-run-link')).toBeInTheDocument();
    expect(
      screen.getByText(/Slack post was not sent/i),
    ).toBeInTheDocument();
  });

  it('state-completed-drafts-pending: renders Review drafts button + N drafts pending badge', () => {
    const run = makeRun({
      status: 'completed',
      output: { slack_posted: true },
    });
    render(
      <CooCard {...baseProps} initialRun={run} draftsPendingCount={3} />,
    );
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe(
      'completed-drafts-pending',
    );
    expect(screen.getByTestId('coo-card-drafts-link')).toBeInTheDocument();
    expect(screen.getByText('Review drafts')).toBeInTheDocument();
    expect(screen.getByText(/3 drafts pending/i)).toBeInTheDocument();
  });

  it('state-failed: renders coo-card-rerun-btn with Re-run label + error_message', () => {
    const run = makeRun({
      status: 'failed',
      output: null,
      error_message: 'preflight_failed: bot not in #ops',
    });
    render(<CooCard {...baseProps} initialRun={run} vaultUrl={null} />);
    const card = screen.getByTestId('coo-card');
    expect(card.getAttribute('data-coo-card-status')).toBe('failed');
    expect(screen.getByTestId('coo-card-rerun-btn')).toBeInTheDocument();
    expect(screen.getByText('Re-run')).toBeInTheDocument();
    expect(
      screen.getByText(/preflight_failed: bot not in #ops/),
    ).toBeInTheDocument();
  });
});
