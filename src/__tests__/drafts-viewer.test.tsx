/**
 * Phase 6 / Plan 06-02b — Task 1 RED scaffold for the drafts viewer.
 *
 * Asserts UI-SPEC §Surface 3 contract — testids that the page + draft cards
 * must expose. Vitest is installed (see package.json devDeps).
 *
 * RED until Task 4 ships:
 *   - src/app/agentos/runs/[id]/drafts/page.tsx
 *   - src/app/agentos/runs/[id]/drafts/_components/DraftCard.tsx
 *   - src/app/agentos/runs/[id]/drafts/_actions.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Server Actions module so the client component imports do not blow up
// at test time (vitest doesn't resolve 'use server' modules).
vi.mock('@/app/agentos/runs/[id]/drafts/_actions', () => ({
  sendDraft: vi.fn(),
  discardDraft: vi.fn(),
}));

import { DraftCard } from '@/app/agentos/runs/[id]/drafts/_components/DraftCard';

const SAMPLE_DRAFT = {
  draft_id: 'd-1234',
  tool_name: 'mcp__slack__post_message',
  tool_input: { channel: 'C0', text: 'hello world' },
  created_at: '2026-05-06T12:00:00+00:00',
  seq: 1,
  status: 'pending' as const,
};

describe('DraftCard', () => {
  it('renders draft-card-{id} with all action testids when status=pending', () => {
    render(
      <DraftCard
        draft={SAMPLE_DRAFT}
        runId="run-abc"
      />,
    );
    expect(screen.getByTestId(`draft-card-${SAMPLE_DRAFT.draft_id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`draft-send-${SAMPLE_DRAFT.draft_id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`draft-edit-${SAMPLE_DRAFT.draft_id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`draft-discard-${SAMPLE_DRAFT.draft_id}`)).toBeInTheDocument();
  });

  it('shows the canonical button labels per UI-SPEC copywriting contract', () => {
    render(
      <DraftCard
        draft={SAMPLE_DRAFT}
        runId="run-abc"
      />,
    );
    expect(screen.getByText('Send message')).toBeInTheDocument();
    expect(screen.getByText('Edit & Send')).toBeInTheDocument();
    expect(screen.getByText('Discard')).toBeInTheDocument();
  });
});

describe('drafts-page', () => {
  // The page is a Server Component; we render it via a thin in-process call.
  // We do NOT mock Supabase Storage here (that lands in the e2e suite); we
  // only need the empty-state path to exercise the testids contract.
  it('renders the drafts-page testid + empty-state when no drafts', async () => {
    // Mock requireAdmin so the page does not redirect during test render.
    vi.doMock('@/lib/supabase/agentos', () => ({
      requireAdmin: vi.fn().mockResolvedValue({ sub: 'u1', app_role: 'admin' }),
    }));
    // Mock the supabase server client + storage download to return null (no drafts).
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        storage: {
          from: () => ({
            download: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
          }),
        },
      }),
    }));

    const mod = await import('@/app/agentos/runs/[id]/drafts/page');
    const PageDefault = mod.default;
    const ui = await PageDefault({ params: Promise.resolve({ id: 'run-abc' }) });
    render(ui);

    expect(screen.getByTestId('drafts-page')).toBeInTheDocument();
    expect(screen.getByTestId('drafts-empty-state')).toBeInTheDocument();
  });
});
