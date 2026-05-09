'use client';
/**
 * Plan 09-04 — Monthly budget section for the Agent Edit page.
 *
 * Pure render component (no local state, no Server Action call — the field is part of
 * the EditAgentForm submit pipeline and lands in the form's native FormData). The
 * same component is reused in Wizard Step 6 (AutonomyStep) for AGENT-03 parity.
 *
 * Testid contract: monthly-budget-section, monthly-budget-input, monthly-spent-display.
 */
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';

export interface MonthlyBudgetSectionProps {
  /** Current agents.monthly_budget_usd — null means no cap. */
  initialValue: number | null;
  /** Current agents.monthly_spent_usd — shown for context when provided. */
  initialSpent?: number;
  /** Field name submitted in FormData. Default: 'monthly_budget_usd'. */
  fieldName?: string;
  /** id attribute for label htmlFor wiring. Default: 'monthly_budget_usd'. */
  inputId?: string;
}

export function MonthlyBudgetSection({
  initialValue,
  initialSpent,
  fieldName = 'monthly_budget_usd',
  inputId = 'monthly_budget_usd',
}: MonthlyBudgetSectionProps) {
  return (
    <section data-testid="monthly-budget-section" className="flex flex-col gap-sm">
      <h3 className="text-[13px] font-medium text-text">Monthly budget</h3>
      <FormField
        label="Monthly cap (USD)"
        htmlFor={inputId}
        hint="Resets on the 1st of each month. Agent auto-pauses when reached. Leave empty for no cap."
      >
        <Input
          id={inputId}
          name={fieldName}
          data-testid="monthly-budget-input"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initialValue == null ? '' : String(initialValue)}
          placeholder="No cap"
          inputMode="decimal"
        />
      </FormField>
      {typeof initialSpent === 'number' && (
        <div className="text-[12px] text-text-muted" data-testid="monthly-spent-display">
          This month: ${initialSpent.toFixed(2)} spent
        </div>
      )}
    </section>
  );
}
