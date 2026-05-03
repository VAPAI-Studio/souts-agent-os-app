'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAgent } from '../_actions';

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

export function NewAgentForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createAgent({
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
    router.push(`/agentos/agents/${result.data!.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="new-agent-form"
      style={{ display: 'grid', gap: '1rem', maxWidth: 600 }}
    >
      <label>
        Name{' '}
        <input
          name="name"
          minLength={3}
          maxLength={50}
          required
          data-testid="field-name"
        />
      </label>
      <label>
        Department
        <select name="department" required data-testid="field-department">
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
          required
          data-testid="field-system_prompt"
        />
      </label>
      <label>
        Autonomy level
        <select
          name="autonomy_level"
          defaultValue="semi_autonomous"
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
          defaultValue="sonnet"
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
        max_turns
        <input
          name="max_turns"
          type="number"
          min={1}
          max={200}
          defaultValue={25}
          required
          data-testid="field-max_turns"
        />
      </label>
      <label>
        Budget cap (USD)
        <input
          name="budget_cap_usd"
          type="number"
          min={0}
          step="0.01"
          defaultValue={1.0}
          required
          data-testid="field-budget_cap_usd"
        />
      </label>
      <label>
        Sensitive tools (comma-separated, e.g. Bash,Python)
        <input name="sensitive_tools" data-testid="field-sensitive_tools" />
      </label>
      <label>
        Denylist globs (comma-separated, e.g. **/.env,**/secrets/**)
        <input name="denylist_globs" data-testid="field-denylist_globs" />
      </label>
      {error && (
        <p data-testid="form-error" style={{ color: 'red' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} data-testid="submit-btn">
        {submitting ? 'Creating...' : 'Create agent'}
      </button>
    </form>
  );
}
