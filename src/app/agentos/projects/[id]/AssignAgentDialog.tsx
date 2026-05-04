'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { assignAgentToProject } from '../_actions';

interface AvailableAgent {
  id: string;
  name: string;
  current_project_id: string | null;
}

export function AssignAgentDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AvailableAgent[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // Fetch agents not already in this project (RLS-respecting via API route).
    fetch('/agentos/projects/api/agents-available')
      .then((r) => r.json())
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]));
  }, [open]);

  function onAssign() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await assignAgentToProject(selected, projectId);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOpen(false);
        setSelected('');
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <Button
        intent="primary"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="open-assign-agent-btn"
      >
        Assign agent
      </Button>
    );
  }

  return (
    <Card
      role="dialog"
      aria-label="Assign agent to project"
      data-testid="assign-agent-dialog"
      className="absolute right-0 mt-md w-[400px] z-10 shadow-lg"
    >
      <CardBody>
        <h3 className="text-[16px] font-semibold mb-md">
          Assign agent to project
        </h3>
        <FormField label="Agent" htmlFor="agent-select">
          <Select
            id="agent-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            data-testid="agent-select"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option
                key={a.id}
                value={a.id}
                disabled={a.current_project_id === projectId}
              >
                {a.name}
                {a.current_project_id
                  ? ` (in ${a.current_project_id.slice(0, 8)})`
                  : ''}
              </option>
            ))}
          </Select>
        </FormField>
        {error && (
          <span
            data-testid="action-error"
            className="text-destructive text-[13px] block mt-sm"
          >
            Action failed: {error}. Try again or contact your admin.
          </span>
        )}
        <div className="flex gap-sm mt-md">
          <Button
            intent="primary"
            size="sm"
            onClick={onAssign}
            disabled={isPending || !selected}
            data-testid="confirm-assign-btn"
          >
            {isPending ? '...' : 'Assign'}
          </Button>
          <Button intent="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
