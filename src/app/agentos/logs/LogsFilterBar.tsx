'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const STATUSES = [
  '',
  'queued',
  'dispatched',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const;

const TOOLS = ['', 'Read', 'Write', 'Edit', 'Bash', 'Python', 'Glob', 'Grep'] as const;

interface LogsFilterBarProps {
  agents: { id: string; name: string }[];
  initial: {
    agent_id?: string;
    from_date?: string;
    to_date?: string;
    status?: string;
    tool_name?: string;
  };
}

export function LogsFilterBar({ agents, initial }: LogsFilterBarProps) {
  const router = useRouter();
  const [agentId, setAgentId] = React.useState(initial.agent_id ?? '');
  const [fromDate, setFromDate] = React.useState(initial.from_date ?? '');
  const [toDate, setToDate] = React.useState(initial.to_date ?? '');
  const [status, setStatus] = React.useState(initial.status ?? '');
  const [toolName, setToolName] = React.useState(initial.tool_name ?? '');

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const out = new URLSearchParams();
    if (agentId) out.set('agent_id', agentId);
    if (fromDate) out.set('from_date', fromDate);
    if (toDate) out.set('to_date', toDate);
    if (status) out.set('status', status);
    if (toolName) out.set('tool_name', toolName);
    router.push(`/agentos/logs?${out.toString()}`);
  }

  function reset() {
    setAgentId('');
    setFromDate('');
    setToDate('');
    setStatus('');
    setToolName('');
    router.push('/agentos/logs');
  }

  return (
    <form
      onSubmit={applyFilters}
      data-testid="logs-filter-bar"
      className="flex flex-wrap items-end gap-sm"
    >
      <FormField label="Agent" htmlFor="filter-agent" className="min-w-[180px]">
        <Select
          id="filter-agent"
          name="agent_id"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          data-testid="filter-agent"
        >
          <option value="">All</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="From" htmlFor="filter-from">
        <Input
          id="filter-from"
          name="from_date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          data-testid="filter-from"
        />
      </FormField>

      <FormField label="To" htmlFor="filter-to">
        <Input
          id="filter-to"
          name="to_date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          data-testid="filter-to"
        />
      </FormField>

      <FormField label="Status" htmlFor="filter-status">
        <Select
          id="filter-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          data-testid="filter-status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'All'}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Tool" htmlFor="filter-tool">
        <Select
          id="filter-tool"
          name="tool_name"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          data-testid="filter-tool"
        >
          {TOOLS.map((t) => (
            <option key={t} value={t}>
              {t || 'All'}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="flex gap-xs">
        <Button
          type="submit"
          intent="primary"
          size="sm"
          data-testid="apply-filters"
        >
          Apply
        </Button>
        <Button
          type="button"
          intent="secondary"
          size="sm"
          onClick={reset}
          data-testid="reset-filters"
        >
          Reset
        </Button>
      </div>
    </form>
  );
}
