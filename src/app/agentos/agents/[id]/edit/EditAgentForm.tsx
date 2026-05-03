'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateAgent } from '../../_actions';

const DEPARTMENTS = [
  'CEO',
  'COO',
  'Marketing',
  'Sales',
  'Project',
  'Creative',
  'Production',
] as const;
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

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="edit-agent-form"
      style={{ display: 'grid', gap: '1rem', maxWidth: 600 }}
    >
      <label>
        Name{' '}
        <input
          name="name"
          defaultValue={agent.name}
          required
          minLength={3}
          maxLength={50}
          data-testid="field-name"
        />
      </label>
      <label>
        Department
        <select
          name="department"
          defaultValue={agent.department}
          required
          data-testid="field-department"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label>
        System prompt
        <textarea
          name="system_prompt"
          rows={5}
          defaultValue={agent.system_prompt}
          required
          data-testid="field-system_prompt"
        />
      </label>
      <label>
        Autonomy
        <select
          name="autonomy_level"
          defaultValue={agent.autonomy_level}
          data-testid="field-autonomy_level"
        >
          {AUTONOMY.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model tier
        <select
          name="model_tier"
          defaultValue={agent.model_tier}
          data-testid="field-model_tier"
        >
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        max_turns{' '}
        <input
          name="max_turns"
          type="number"
          min={1}
          max={200}
          defaultValue={agent.max_turns}
          required
          data-testid="field-max_turns"
        />
      </label>
      <label>
        Budget cap{' '}
        <input
          name="budget_cap_usd"
          type="number"
          step="0.01"
          min={0}
          defaultValue={agent.budget_cap_usd ?? 0}
          required
          data-testid="field-budget_cap_usd"
        />
      </label>
      <label>
        Sensitive tools (csv){' '}
        <input
          name="sensitive_tools"
          defaultValue={(agent.config?.sensitive_tools ?? []).join(', ')}
          data-testid="field-sensitive_tools"
        />
      </label>
      <label>
        Denylist globs (csv){' '}
        <input
          name="denylist_globs"
          defaultValue={(agent.config?.denylist_globs ?? []).join(', ')}
          data-testid="field-denylist_globs"
        />
      </label>
      {error && (
        <p style={{ color: 'red' }} data-testid="form-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} data-testid="save-btn">
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
