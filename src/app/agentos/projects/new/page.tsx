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
import { createProject } from '../_actions';

type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export default function NewProjectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const status = (formData.get('status') as ProjectStatus) || 'active';
      const description = String(formData.get('description') ?? '');
      const res = await createProject({
        name: String(formData.get('name') ?? ''),
        description: description || undefined,
        status,
      });
      if (!res.ok) setError(res.error);
      else router.push(`/agentos/projects/${res.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="new-project-page">
      <PageHeader title="New project" />
      <Card>
        <CardBody>
          <form action={onSubmit} className="flex flex-col gap-md">
            <FormField label="Name" htmlFor="name">
              <Input id="name" name="name" required data-testid="name-input" />
            </FormField>
            <FormField
              label="Description"
              htmlFor="description"
              hint="Optional. Markdown supported."
            >
              <Textarea
                id="description"
                name="description"
                rows={4}
                data-testid="description-textarea"
              />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue="active"
                data-testid="status-select"
              >
                <option value="active">active</option>
                <option value="on_hold">on_hold</option>
                <option value="completed">completed</option>
                <option value="archived">archived</option>
              </Select>
            </FormField>

            {error && (
              <span
                data-testid="action-error"
                className="text-destructive text-[13px]"
              >
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
                {isPending ? '...' : 'Create project'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
