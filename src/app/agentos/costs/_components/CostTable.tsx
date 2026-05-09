'use client';
/**
 * Phase 9 / Plan 09-02 — Sortable dense cost table.
 *
 * Client-side sorting via useState. Click on column header to toggle sort.
 * Default: cost_usd DESC.
 *
 * Uses existing Table/THead/TBody/Tr/Th/Td primitives from Phase 03.1.
 * data-testid="costs-table" on the outer Table wrapper div.
 * data-testid={`costs-row-${row.agent_id}`} on each row.
 *
 * Empty state: renders a Card message when rows.length === 0.
 */
import * as React from 'react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { Card, CardBody } from '@/components/ui/Card';
import type { CostTableRow } from '../_data/costs';

type SortDir = 'asc' | 'desc';
type SortKey = keyof CostTableRow;

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'agent_name', label: 'Agent' },
  { key: 'agent_dept', label: 'Dept' },
  { key: 'project_name', label: 'Project' },
  { key: 'model_used', label: 'Model' },
  { key: 'runs_count', label: 'Runs' },
  { key: 'cost_usd', label: 'Cost' },
  { key: 'cost_per_run', label: 'Cost/Run' },
];

function sortRows(rows: CostTableRow[], sortBy: SortKey, dir: SortDir): CostTableRow[] {
  return [...rows].sort((a, b) => {
    const av = a[sortBy] as string | number | null;
    const bv = b[sortBy] as string | number | null;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const diff = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === 'asc' ? diff : -diff;
  });
}

export function CostTable({ rows }: { rows: CostTableRow[] }) {
  const [sortBy, setSortBy] = React.useState<SortKey>('cost_usd');
  const [dir, setDir] = React.useState<SortDir>('desc');

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-text-muted text-[13px]">No runs in this period.</p>
        </CardBody>
      </Card>
    );
  }

  const sorted = sortRows(rows, sortBy, dir);

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setDir('desc');
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (key !== sortBy) return null;
    return dir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <Table data-testid="costs-table" role="table">
      <THead>
        <Tr>
          {COLUMNS.map((col) => (
            <Th
              key={col.key}
              onClick={() => handleSort(col.key)}
              className="cursor-pointer select-none hover:text-text"
            >
              {col.label}
              {sortIndicator(col.key)}
            </Th>
          ))}
        </Tr>
      </THead>
      <TBody>
        {sorted.map((row) => (
          <Tr key={row.agent_id} data-testid={`costs-row-${row.agent_id}`}>
            <Td>{row.agent_name}</Td>
            <Td className="text-text-muted">{row.agent_dept ?? '—'}</Td>
            <Td className="text-text-muted">{row.project_name ?? '—'}</Td>
            <Td className="text-text-muted font-mono text-[12px]">{row.model_used ?? '—'}</Td>
            <Td>{row.runs_count}</Td>
            <Td className="tabular-nums">${row.cost_usd.toFixed(4)}</Td>
            <Td className="tabular-nums text-text-muted">${row.cost_per_run.toFixed(4)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
