'use client';
// Stub — fleshed out in Task 2 (08-05).
// This file is imported by agents/[id]/page.tsx for the Chat tab.
export function ChatInterface({
  agentId: _agentId,
  userId: _userId,
  initialLatestRunId: _initialLatestRunId,
}: {
  agentId: string;
  userId: string;
  initialLatestRunId: string | null;
}) {
  return (
    <div data-testid="chat-interface" className="text-text-muted text-[13px]">
      Loading chat…
    </div>
  );
}
