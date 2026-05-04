'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type AgentosRole = 'admin' | 'member' | 'agent_owner' | 'viewer';

interface NavItem {
  label: string;
  href: string;
  testId: string;
  adminOnly?: boolean;
}

/**
 * Nav items locked for Phase 03.1 + extended in Plan 03-05.
 * - 'Runs' still points at /agentos/agents (run-detail pages are nested under agents).
 * - 'Logs' was added in Plan 03-05 once /agentos/logs shipped (filterable agent_runs).
 * - No "Coming soon" graveyards: only built routes appear here.
 */
const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { label: 'Agents', href: '/agentos/agents', testId: 'nav-agents' },
  { label: 'Vault', href: '/agentos/vault', testId: 'nav-vault' },
  { label: 'Projects', href: '/agentos/projects', testId: 'nav-projects' },
  { label: 'Team', href: '/agentos/team', testId: 'nav-team', adminOnly: true },
  { label: 'Runs', href: '/agentos/agents', testId: 'nav-runs' }, // placeholder href
  { label: 'Logs', href: '/agentos/logs', testId: 'nav-logs' },
];

interface SidebarNavProps {
  email?: string;
  role?: AgentosRole;
}

export function SidebarNav({ email, role }: SidebarNavProps) {
  const pathname = usePathname() ?? '';

  const isActive = (href: string) => {
    // Exact match or descendant route — but 'Runs' (placeholder href=/agentos/agents)
    // intentionally collides with 'Agents'; do not double-highlight. Only highlight
    // 'Agents' for /agentos/agents/*; 'Runs' will become active when /agentos/logs ships.
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const roleBadgeTone =
    role === 'admin' || role === 'agent_owner' ? 'accent' : 'neutral';

  return (
    <>
      {/* Wordmark */}
      <div className="px-md py-md flex items-baseline gap-2">
        <span className="font-mono font-medium text-[13px] text-text">
          AgentOS
        </span>
        <span className="text-[11px] text-text-muted font-mono">
          v0.1 · internal
        </span>
      </div>

      {/* Nav */}
      <nav
        aria-label="agentos navigation"
        className="flex-1 px-sm py-sm flex flex-col gap-0.5"
      >
        {NAV_ITEMS.map((item) => {
          if (item.adminOnly && role !== 'admin') return null;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                'group flex items-center px-sm py-1.5 text-[13px] font-sans rounded transition-colors',
                'hover:bg-surface',
                active
                  ? 'text-accent border-l-2 border-accent pl-[calc(var(--spacing-sm)-2px)]'
                  : 'text-text-muted hover:text-text border-l-2 border-transparent',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Session block */}
      <div className="p-md border-t border-border min-h-[64px] flex flex-col gap-1.5">
        {role && (
          <span
            data-testid="role-badge"
            className="flex items-center gap-1.5 text-[12px] text-text-muted font-sans"
          >
            <span className="truncate" title={email ?? ''}>{email}</span>
            <Badge tone={roleBadgeTone}>{role}</Badge>
          </span>
        )}
        <form action="/auth/signout" method="post">
          <Button
            type="submit"
            intent="ghost"
            size="sm"
            data-testid="logout-button"
            className="w-full justify-start"
          >
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
