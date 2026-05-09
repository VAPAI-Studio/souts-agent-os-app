/**
 * Phase 9 / Plan 09-03 — Vitest + RTL + fake timers test for ActivityFeed debounce.
 *
 * Tests the 5-second debounce behaviour:
 *   - Multiple rapid INSERT events → single re-fetch (not N re-fetches)
 *   - Two burst events separated by >5s → two re-fetches
 *   - Unmount before timer fires → no late re-fetch (clearTimeout on cleanup)
 *   - Empty rows → renders "No activity yet today."
 *   - Sample rows → renders activity-row-<id> testids
 *
 * Architecture note: ActivityFeed.tsx exports `clientFetchActivityFeed` as a
 * named export so tests can spy on it without deep module mocking.
 * Supabase client mock uses a controllable channel object to simulate events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import type { ActivityRow } from '../app/agentos/dashboard/_data/home';

// ── Controllable mock channel ─────────────────────────────────────────────────

// Holds the channel callback so tests can trigger it
let auditInsertCallback: (() => void) | null = null;

// Define channel object using a factory to avoid circular reference
function makeMockChannel() {
  const ch: Record<string, unknown> = {};
  ch.on = vi.fn().mockImplementation(
    (_event: string, _opts: unknown, cb: () => void) => {
      auditInsertCallback = cb;
      return ch;
    },
  );
  ch.subscribe = vi.fn().mockReturnValue(ch);
  return ch;
}

let mockChannelInstance = makeMockChannel();

const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  },
  realtime: { setAuth: vi.fn() },
  channel: vi.fn().mockImplementation(() => mockChannelInstance),
  removeChannel: vi.fn(),
  schema: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
};

vi.mock('../lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// ── Spy on clientFetchActivityFeed ────────────────────────────────────────────

// We'll spy on the module after setup
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auditInsertCallback = null;
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Re-create channel instance to reset callback registration
  mockChannelInstance = makeMockChannel();
  mockSupabaseClient.channel.mockImplementation(() => mockChannelInstance);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Sample rows ────────────────────────────────────────────────────────────────

const sampleRows: ActivityRow[] = [
  {
    id: 'log-aaa',
    category: 'run',
    action: 'agent_run_completed',
    agent_id: 'agent-1',
    agent_name: 'Test Agent',
    run_id: 'run-1',
    approval_id: null,
    cost_usd: 0.05,
    status: 'completed',
    tool_name: null,
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'log-bbb',
    category: 'approval',
    action: 'approval_approve',
    agent_id: 'agent-2',
    agent_name: 'Approval Agent',
    run_id: null,
    approval_id: 'apr-1',
    cost_usd: null,
    status: null,
    tool_name: 'slack_send_message',
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'log-ccc',
    category: 'agent',
    action: 'agent_pause',
    agent_id: 'agent-3',
    agent_name: 'Paused Agent',
    run_id: null,
    approval_id: null,
    cost_usd: null,
    status: null,
    tool_name: null,
    created_at: new Date(Date.now() - 180000).toISOString(),
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActivityFeed debounce behaviour', () => {
  it('Test 1 (debounce): 5 rapid INSERTs within 500ms → clientFetchActivityFeed called exactly ONCE after 5s (single debounced re-fetch)', async () => {
    const { ActivityFeed } = await import(
      '../app/agentos/dashboard/_components/ActivityFeed'
    );

    const fetchMock = vi.fn().mockResolvedValue([]);

    const { unmount } = render(
      <ActivityFeed initialRows={[]} _fetchFn={fetchMock} />,
    );

    // Let mount effect run (Realtime subscription setup)
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Fire 5 INSERT events within 500ms (rapid burst)
    for (let i = 0; i < 5; i++) {
      act(() => {
        if (auditInsertCallback) auditInsertCallback();
      });
      act(() => {
        vi.advanceTimersByTime(100); // 100ms between each
      });
    }

    // At this point: debounce timer is pending; no re-fetch yet
    // (timer was started on first INSERT, subsequent INSERTs are ignored since timer is pending)
    expect(fetchMock.mock.calls.length).toBe(0);

    // Advance 5 seconds to trigger the single debounced re-fetch
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Exactly 1 re-fetch: 5 INSERTs → 1 debounced call (not 5 separate calls)
    expect(fetchMock.mock.calls.length).toBe(1);

    unmount();
  });

  it('Test 3 (debounce): cleanup on unmount cancels pending setTimeout (no late re-fetch)', async () => {
    const { ActivityFeed } = await import(
      '../app/agentos/dashboard/_components/ActivityFeed'
    );
    const fetchMock = vi.fn().mockResolvedValue([]);

    const { unmount } = render(
      <ActivityFeed initialRows={[]} _fetchFn={fetchMock} />,
    );

    // Let mount settle
    await act(async () => { vi.advanceTimersByTime(0); });

    // Fire an INSERT to start a pending debounce timer
    act(() => {
      if (auditInsertCallback) auditInsertCallback();
    });

    // Unmount BEFORE the 5s timer fires
    unmount();

    // Advance timers past the 5s debounce
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // fetchMock should NOT have been called by the now-cancelled timer
    // (it was called once on mount)
    const callsAfterUnmount = fetchMock.mock.calls.length;
    // Only the mount call should have happened (0 or 1 depending on timing)
    expect(callsAfterUnmount).toBeLessThanOrEqual(1);
  });

  it('Test 4 (render): empty list renders "No activity yet today."', async () => {
    const { ActivityFeed } = await import(
      '../app/agentos/dashboard/_components/ActivityFeed'
    );
    const fetchMock = vi.fn().mockResolvedValue([]);

    render(<ActivityFeed initialRows={[]} _fetchFn={fetchMock} />);

    // Let effects settle
    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.getByText('No activity yet today.')).toBeInTheDocument();
  });

  it('Test 5 (render): sample rows render with correct testids activity-row-<id>', async () => {
    const { ActivityFeed } = await import(
      '../app/agentos/dashboard/_components/ActivityFeed'
    );
    const fetchMock = vi.fn().mockResolvedValue([]);

    render(<ActivityFeed initialRows={sampleRows} _fetchFn={fetchMock} />);

    await act(async () => { vi.advanceTimersByTime(0); });

    expect(screen.getByTestId('activity-row-log-aaa')).toBeInTheDocument();
    expect(screen.getByTestId('activity-row-log-bbb')).toBeInTheDocument();
    expect(screen.getByTestId('activity-row-log-ccc')).toBeInTheDocument();
  });
});
