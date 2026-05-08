'use client';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type TabKey = 'overview' | 'chat' | 'runs' | 'logs' | 'edit';

export function AgentTabs({
  agentId,
  currentTab,
  isDraft,
  canEdit,
}: {
  agentId: string;
  currentTab: TabKey;
  isDraft: boolean;
  canEdit: boolean;
}) {
  const baseHref = `/agentos/agents/${agentId}`;
  const tabs: Array<{
    key: TabKey;
    label: string;
    href: string;
    testid: string;
    show: boolean;
  }> = [
    {
      key: 'overview',
      label: 'Overview',
      href: `${baseHref}?tab=overview`,
      testid: 'overview-tab',
      show: true,
    },
    {
      key: 'chat',
      label: 'Chat',
      href: `${baseHref}?tab=chat`,
      testid: 'chat-tab',
      show: !isDraft,
    },
    {
      key: 'runs',
      label: 'Runs',
      href: `${baseHref}?tab=runs`,
      testid: 'runs-tab',
      show: true,
    },
    {
      key: 'logs',
      label: 'Logs',
      href: `${baseHref}?tab=logs`,
      testid: 'logs-tab',
      show: true,
    },
    {
      key: 'edit',
      label: 'Edit',
      href: `${baseHref}/edit`,
      testid: 'edit-tab-link',
      show: canEdit,
    },
  ];

  return (
    <nav
      aria-label="Agent tabs"
      data-testid="agent-tabs"
      className="flex items-center gap-1 border-b border-border"
    >
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <Link
            key={t.key}
            href={t.href}
            data-testid={t.testid}
            aria-current={currentTab === t.key ? 'page' : undefined}
            className={cn(
              'px-4 py-2 text-sm border-b-2 -mb-px',
              currentTab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {t.label}
          </Link>
        ))}
    </nav>
  );
}
