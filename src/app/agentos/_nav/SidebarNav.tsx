'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PendingBadge } from '@/app/agentos/approvals/_components/PendingBadge';

type AgentosRole = 'admin' | 'member' | 'agent_owner' | 'viewer';

interface NavItem {
  label: string;
  href: string;
  testId: string;
  adminOnly?: boolean;
}

/**
 * Nav items.
 *
 * Order: morning-routine landing first (Dashboard), then operational
 * surfaces (Approvals, Agents), then knowledge (Vault, Projects),
 * then platform (Costs, Logs), then admin (Tools, Team, Health, Settings).
 *
 * The original "Runs" placeholder was removed (2026-05-09) — it pointed
 * at /agentos/agents which collided with the Agents item, AND
 * /agentos/logs already provides the filterable runs view that Runs
 * was meant to become.
 */
const NAV_ITEMS: ReadonlyArray<NavItem> = [
  // Plan 06-05: Dashboard home page surfacing the COO daily-report briefing card.
  { label: 'Dashboard', href: '/agentos/dashboard', testId: 'nav-dashboard' },
  { label: 'Approvals', href: '/agentos/approvals', testId: 'nav-approvals', adminOnly: true },
  { label: 'Agents', href: '/agentos/agents', testId: 'nav-agents' },
  { label: 'Vault', href: '/agentos/vault', testId: 'nav-vault' },
  { label: 'Projects', href: '/agentos/projects', testId: 'nav-projects' },
  // Plan 09-02: Cost analytics dashboard — all agentos roles can view.
  { label: 'Costs', href: '/agentos/costs', testId: 'nav-costs' },
  { label: 'Logs', href: '/agentos/logs', testId: 'nav-logs' },
  // Plan 06-02: Tool Registry — admin-only catalog of integrations + per-tool defaults.
  { label: 'Tools', href: '/agentos/tools', testId: 'nav-tools', adminOnly: true },
  { label: 'Team', href: '/agentos/team', testId: 'nav-team', adminOnly: true },
  // Plan 09-05: Admin-only Health page showing 8 service rows + state pills.
  { label: 'Health', href: '/agentos/health', testId: 'nav-health', adminOnly: true },
  // Plan 09-04: Admin-only Settings page for org-wide configuration (daily threshold etc.).
  { label: 'Settings', href: '/agentos/settings', testId: 'nav-settings', adminOnly: true },
];

interface SidebarNavProps {
  email?: string;
  role?: AgentosRole;
}

export function SidebarNav({ email, role }: SidebarNavProps) {
  const pathname = usePathname() ?? '';

  const isActive = (href: string) => {
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
              <span className="flex-1">{item.label}</span>
              {item.testId === 'nav-approvals' && <PendingBadge />}
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
