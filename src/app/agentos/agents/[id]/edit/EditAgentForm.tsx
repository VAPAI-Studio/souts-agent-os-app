'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAgent } from '../../_actions';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const DEPARTMENTS = [
  'ceo',
  'coo',
  'marketing',
  'sales',
  'project',
  'creative',
  'production',
] as const;
const DEPARTMENT_LABELS: Record<(typeof DEPARTMENTS)[number], string> = {
  ceo: 'CEO',
  coo: 'COO',
  marketing: 'Marketing',
  sales: 'Sales',
  project: 'Project',
  creative: 'Creative',
  production: 'Production',
};
const AUTONOMY = [
  'manual',
  'suggestive',
  'semi_autonomous',
  'autonomous_with_approvals',
] as const;
const MODELS = ['haiku', 'sonnet', 'opus'] as const;

type Department = (typeof DEPARTMENTS)[number];
type Autonomy = (typeof AUTONOMY)[number];
type Model = (typeof MODELS)[number];

interface AgentRow {
  id: string;
  name: string;
  department: Department;
  system_prompt: string;
  autonomy_level: Autonomy;
  model_tier: Model;
  max_turns: number;
  budget_cap_usd: number | null;
  config?: {
    sensitive_tools?: string[];
    denylist_globs?: string[];
  } | null;
}

export function EditAgentForm({ agent }: { agent: AgentRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await updateAgent(agent.id, {
      name: String(fd.get('name')),
      department: fd.get('department') as Department,
      system_prompt: String(fd.get('system_prompt')),
      autonomy_level: fd.get('autonomy_level') as Autonomy,
      model_tier: fd.get('model_tier') as Model,
      max_turns: Number(fd.get('max_turns')),
      budget_cap_usd: Number(fd.get('budget_cap_usd')),
      sensitive_tools: String(fd.get('sensitive_tools') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      denylist_globs: String(fd.get('denylist_globs') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/${agent.id}`);
  }

  const hasError = !!error;

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="edit-agent-form"
      className="flex flex-col gap-md max-w-[600px]"
    >
      <FormField label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          defaultValue={agent.name}
          required
          minLength={3}
          maxLength={50}
          data-testid="field-name"
          error={hasError}
        />
      </FormField>
      <FormField label="Department" htmlFor="department">
        <Select
          id="department"
          name="department"
          defaultValue={agent.department}
          required
          data-testid="field-department"
          error={hasError}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {DEPARTMENT_LABELS[d]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="System prompt" htmlFor="system_prompt">
        <Textarea
          id="system_prompt"
          name="system_prompt"
          rows={5}
          defaultValue={agent.system_prompt}
          required
          data-testid="field-system_prompt"
          error={hasError}
        />
      </FormField>
      <FormField label="Autonomy level" htmlFor="autonomy_level">
        <Select
          id="autonomy_level"
          name="autonomy_level"
          defaultValue={agent.autonomy_level}
          data-testid="field-autonomy_level"
          error={hasError}
        >
          {AUTONOMY.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Model tier" htmlFor="model_tier">
        <Select
          id="model_tier"
          name="model_tier"
          defaultValue={agent.model_tier}
          data-testid="field-model_tier"
          error={hasError}
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="max_turns" htmlFor="max_turns">
        <Input
          id="max_turns"
          name="max_turns"
          type="number"
          min={1}
          max={200}
          defaultValue={agent.max_turns}
          required
          data-testid="field-max_turns"
          error={hasError}
        />
      </FormField>
      <FormField label="Budget cap (USD)" htmlFor="budget_cap_usd">
        <Input
          id="budget_cap_usd"
          name="budget_cap_usd"
          type="number"
          step="0.01"
          min={0}
          defaultValue={agent.budget_cap_usd ?? 0}
          required
          data-testid="field-budget_cap_usd"
          error={hasError}
        />
      </FormField>
      <FormField
        label="Sensitive tools"
        htmlFor="sensitive_tools"
        hint="Comma-separated, e.g. Bash,Python"
      >
        <Input
          id="sensitive_tools"
          name="sensitive_tools"
          defaultValue={(agent.config?.sensitive_tools ?? []).join(', ')}
          data-testid="field-sensitive_tools"
          error={hasError}
        />
      </FormField>
      <FormField
        label="Denylist globs"
        htmlFor="denylist_globs"
        hint="Comma-separated, e.g. **/.env,**/secrets/**"
      >
        <Input
          id="denylist_globs"
          name="denylist_globs"
          defaultValue={(agent.config?.denylist_globs ?? []).join(', ')}
          data-testid="field-denylist_globs"
          error={hasError}
        />
      </FormField>
      {error && (
        <p data-testid="form-error" className="text-destructive text-[13px]">
          {error}
        </p>
      )}
      <Button
        type="submit"
        intent="primary"
        size="md"
        disabled={submitting}
        data-testid="submit-btn"
      >
        {submitting ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  );
}
