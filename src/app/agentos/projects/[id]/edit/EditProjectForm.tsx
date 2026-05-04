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
import { updateProject, softDeleteProject } from '../../_actions';

type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  };
}

export function EditProjectForm({ project }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateProject(project.id, {
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        status: formData.get('status') as ProjectStatus,
      });
      if (!res.ok) setError(res.error);
      else router.push(`/agentos/projects/${project.id}`);
    });
  }

  function onDelete() {
    if (
      !confirm(
        `Delete project "${project.name}"? Agents and vault entries are preserved.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await softDeleteProject(project.id);
      if (!res.ok) setError(res.error);
      else router.push('/agentos/projects');
    });
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="edit-project-page">
      <PageHeader title={`Edit ${project.name}`} />
      <Card>
        <CardBody>
          <form action={onSubmit} className="flex flex-col gap-md">
            <FormField label="Name" htmlFor="name">
              <Input
                id="name"
                name="name"
                defaultValue={project.name}
                required
                data-testid="name-input"
              />
            </FormField>
            <FormField label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={project.description ?? ''}
                data-testid="description-textarea"
              />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select
                id="status"
                name="status"
                defaultValue={project.status}
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
                {isPending ? '...' : 'Save changes'}
              </Button>
              <Button
                type="button"
                intent="destructive"
                onClick={onDelete}
                disabled={isPending}
                data-testid="delete-project-btn"
              >
                Delete
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
