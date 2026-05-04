'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { createVaultFile } from '../_actions';

type Scope = 'company' | 'project' | 'agent';

export default function NewVaultFilePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope>('company');

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createVaultFile({
        path: String(formData.get('path') ?? ''),
        name: String(formData.get('name') ?? ''),
        scope: (formData.get('scope') as Scope) ?? 'company',
        project_id: (formData.get('project_id') as string) || null,
        agent_id: (formData.get('agent_id') as string) || null,
        content: String(formData.get('content') ?? ''),
        is_sensitive: formData.get('is_sensitive') === 'on',
      });
      if (!res.ok) setError(res.error);
      else router.push(`/agentos/vault/${res.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="new-vault-page">
      <PageHeader title="New vault file" />
      <Card>
        <CardBody>
          <form action={onSubmit} className="flex flex-col gap-md">
            <FormField label="Path" htmlFor="path" hint="Must start with /">
              <Input
                id="path"
                name="path"
                required
                placeholder="/reports/2026-05-04.md"
                data-testid="path-input"
              />
            </FormField>
            <FormField label="Name" htmlFor="name">
              <Input id="name" name="name" required data-testid="name-input" />
            </FormField>
            <FormField label="Scope" htmlFor="scope">
              <Select
                id="scope"
                name="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                data-testid="scope-select"
              >
                <option value="company">Company</option>
                <option value="project">Project</option>
                <option value="agent">Agent</option>
              </Select>
            </FormField>
            {scope === 'project' && (
              <FormField label="Project ID" htmlFor="project_id">
                <Input
                  id="project_id"
                  name="project_id"
                  required
                  data-testid="project-id-input"
                />
              </FormField>
            )}
            {scope === 'agent' && (
              <FormField label="Agent ID" htmlFor="agent_id">
                <Input
                  id="agent_id"
                  name="agent_id"
                  required
                  data-testid="agent-id-input"
                />
              </FormField>
            )}
            <FormField label="Content (Markdown)" htmlFor="content">
              <Textarea
                id="content"
                name="content"
                rows={20}
                data-testid="content-textarea"
              />
            </FormField>
            <FormField label="Sensitivity" htmlFor="is_sensitive">
              <label className="flex items-center gap-sm text-[13px]">
                <input
                  type="checkbox"
                  id="is_sensitive"
                  name="is_sensitive"
                  data-testid="sensitive-checkbox"
                />
                Mark as sensitive (excluded from external model calls)
              </label>
            </FormField>

            {error && (
              <span data-testid="action-error" className="text-destructive text-[13px]">
                Action failed: {error}. Try again or contact your admin.
              </span>
            )}

            <div className="flex gap-sm">
              <Button
                type="submit"
                intent="primary"
                disabled={isPending}
                data-testid="submit-btn"
              >
                {isPending ? '...' : 'Create file'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
