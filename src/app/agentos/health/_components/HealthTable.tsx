/**
 * Phase 9 / Plan 09-05 — HealthTable: Server Component rendering 8 service rows.
 *
 * IMPORTANT: This is a Server Component. There is NO client directive.
 * Live-update behavior comes from HealthRefreshButton calling router.refresh(),
 * which re-renders this component on the server with fresh initialServices.
 * No client-side state, no useEffect — purely a server render.
 */
import * as React from 'react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { HealthStatePill } from './HealthStatePill';
import type { ServiceProbe } from '../_data/snapshot';

interface HealthTableProps {
  initialServices: ServiceProbe[];
}

const SERVICE_LABELS: Record<string, string> = {
  modal: 'Modal',
  supabase: 'Supabase',
  slack: 'Slack (MCP)',
  slack_bot: 'Slack Bot',
  gmail: 'Gmail (MCP)',
  drive: 'Google Drive (MCP)',
  calendar: 'Google Calendar (MCP)',
  notion: 'Notion (MCP)',
};

function formatMs(ms: number): string {
  if (ms === 0) return '—';
  return `${ms} ms`;
}

function formatLastChanged(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function HealthTable({ initialServices }: HealthTableProps) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Service</Th>
          <Th>Status</Th>
          <Th>Last response</Th>
          <Th>Last changed</Th>
          <Th>Last error</Th>
        </Tr>
      </THead>
      <TBody>
        {initialServices.map((probe) => (
          <Tr key={probe.service} data-testid={`health-row-${probe.service}`}>
            <Td className="font-medium">
              {SERVICE_LABELS[probe.service] ?? probe.service}
            </Td>
            <Td>
              <HealthStatePill state={probe.state} />
            </Td>
            <Td className="text-text-muted">
              {formatMs(probe.ms)}
            </Td>
            <Td className="text-text-muted">
              {formatLastChanged(probe.last_changed_at)}
            </Td>
            <Td className="text-text-muted max-w-[240px] truncate" title={probe.error ?? ''}>
              {probe.error ?? '—'}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
