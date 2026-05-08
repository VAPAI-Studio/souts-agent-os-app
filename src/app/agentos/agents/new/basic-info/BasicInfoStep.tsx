'use client';
/**
 * Step 1: Basic Info — name + department
 * Plan 08-02 / Phase 8
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { patchDraft } from '../../_actions';

const DEPARTMENTS = [
  { value: 'ceo', label: 'CEO' },
  { value: 'coo', label: 'COO' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'project', label: 'Project' },
  { value: 'creative', label: 'Creative' },
  { value: 'production', label: 'Production' },
] as const;

type Department = (typeof DEPARTMENTS)[number]['value'];

interface BasicInfoStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}

export function BasicInfoStep({ draft }: BasicInfoStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const department = String(fd.get('department') || '') as Department;

    if (!name || name.length < 1) {
      setError('Name is required');
      setSubmitting(false);
      return;
    }
    if (name.length > 100) {
      setError('Name must be 100 characters or fewer');
      setSubmitting(false);
      return;
    }

    const result = await patchDraft(draft.id as string, { name, department });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/role-goals?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-[520px]"
    >
      <FormField label="Agent name" htmlFor="name">
        <Input
          id="name"
          name="name"
          defaultValue={(draft.name !== 'Untitled Agent' ? draft.name : '') as string}
          placeholder="e.g. COO Daily Report Agent"
          maxLength={100}
          required
          data-testid="field-name"
          error={!!error}
        />
      </FormField>

      <FormField label="Department" htmlFor="department">
        <Select
          id="department"
          name="department"
          defaultValue={(draft.department || 'coo') as string}
          required
          data-testid="field-department"
          error={!!error}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </FormField>

      {error && (
        <p className="text-destructive text-[13px]" data-testid="step-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/agentos/agents/new"
          data-testid="wizard-back-btn"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to templates
        </Link>
        <Button
          type="submit"
          intent="primary"
          size="md"
          disabled={submitting}
          data-testid="wizard-next-btn"
        >
          {submitting ? 'Saving...' : 'Next'}
        </Button>
      </div>
    </form>
  );
}
