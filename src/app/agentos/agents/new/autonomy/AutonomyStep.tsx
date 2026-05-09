'use client';
/**
 * Step 6: Autonomy — autonomy_level, model_tier, max_turns, budget_cap_usd
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
import { MonthlyBudgetSection } from '../../[id]/edit/_components/MonthlyBudgetSection';

const AUTONOMY_LEVELS = [
  { value: 'manual', label: 'Manual — user triggers every run' },
  { value: 'suggestive', label: 'Suggestive — agent suggests, user decides' },
  { value: 'semi_autonomous', label: 'Semi-autonomous — runs with approval on sensitive actions' },
  { value: 'autonomous_with_approvals', label: 'Autonomous with approvals — fully autonomous except gated tools' },
] as const;

const MODEL_TIERS = [
  { value: 'haiku', label: 'Haiku — fastest, lowest cost' },
  { value: 'sonnet', label: 'Sonnet — balanced (recommended)' },
  { value: 'opus', label: 'Opus — most capable, highest cost' },
] as const;

type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]['value'];
type ModelTier = (typeof MODEL_TIERS)[number]['value'];

interface AutonomyStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}

export function AutonomyStep({ draft }: AutonomyStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const autonomyLevel = String(fd.get('autonomy_level') || '') as AutonomyLevel;
    const modelTier = String(fd.get('model_tier') || '') as ModelTier;
    const maxTurns = Number(fd.get('max_turns'));
    const budgetCapUsd = Number(fd.get('budget_cap_usd'));
    // Plan 09-04: monthly_budget_usd — empty string → null (no cap).
    const rawMonthlyBudget = String(fd.get('monthly_budget_usd') ?? '').trim();
    const monthly_budget_usd: number | null =
      rawMonthlyBudget === '' ? null : Number(rawMonthlyBudget);

    if (maxTurns < 1 || maxTurns > 100) {
      setError('max_turns must be between 1 and 100');
      setSubmitting(false);
      return;
    }
    if (budgetCapUsd <= 0) {
      setError('Budget cap must be greater than $0');
      setSubmitting(false);
      return;
    }
    if (monthly_budget_usd !== null && (Number.isNaN(monthly_budget_usd) || monthly_budget_usd < 0)) {
      setError('Monthly budget must be a non-negative number');
      setSubmitting(false);
      return;
    }

    const result = await patchDraft(draft.id as string, {
      autonomy_level: autonomyLevel,
      model_tier: modelTier,
      max_turns: maxTurns,
      budget_cap_usd: budgetCapUsd,
      monthly_budget_usd,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Step 7 (Schedule) will be built in Plan 08-04.
    // For now, redirect to schedule — this will 404 until Plan 08-04 lands.
    router.push(`/agentos/agents/new/schedule?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-[520px]"
    >
      <FormField label="Autonomy level" htmlFor="autonomy_level">
        <Select
          id="autonomy_level"
          name="autonomy_level"
          defaultValue={(draft.autonomy_level || 'semi_autonomous') as string}
          required
          data-testid="field-autonomy_level"
          error={!!error}
        >
          {AUTONOMY_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Model tier" htmlFor="model_tier">
        <Select
          id="model_tier"
          name="model_tier"
          defaultValue={(draft.model_tier || 'sonnet') as string}
          required
          data-testid="field-model_tier"
          error={!!error}
        >
          {MODEL_TIERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Max turns"
        htmlFor="max_turns"
        hint="Maximum number of agent turns per run (1–100)."
      >
        <Input
          id="max_turns"
          name="max_turns"
          type="number"
          min={1}
          max={100}
          defaultValue={(draft.max_turns as number) ?? 25}
          required
          data-testid="field-max_turns"
          error={!!error}
        />
      </FormField>

      <FormField
        label="Budget cap (USD)"
        htmlFor="budget_cap_usd"
        hint="Maximum spend per run in USD. The run is stopped if this is exceeded."
      >
        <Input
          id="budget_cap_usd"
          name="budget_cap_usd"
          type="number"
          min={0.01}
          step={0.01}
          defaultValue={(draft.budget_cap_usd as number) ?? 1.0}
          required
          data-testid="field-budget_cap_usd"
          error={!!error}
        />
      </FormField>

      {/* Plan 09-04: Monthly budget — same component as Edit page for AGENT-03 parity. */}
      <MonthlyBudgetSection
        initialValue={(draft.monthly_budget_usd as number | null | undefined) ?? null}
        fieldName="monthly_budget_usd"
        inputId="wizard_monthly_budget_usd"
      />

      {error && (
        <p className="text-destructive text-[13px]" data-testid="step-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Link
          href={`/agentos/agents/new/tools-permissions?draft=${draft.id}`}
          data-testid="wizard-back-btn"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
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
