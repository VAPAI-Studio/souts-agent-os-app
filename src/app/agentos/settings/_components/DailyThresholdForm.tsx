'use client';
/**
 * Plan 09-04 — DailyThresholdForm (Client Component).
 *
 * Admin-only form that sets the org-wide daily aggregate spend alert threshold.
 * On save, calls saveDailyThresholdAction Server Action.
 *
 * Testid contract: daily-threshold-input, daily-threshold-save.
 */
import { useState, useTransition } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { saveDailyThresholdAction } from '../_actions';

interface DailyThresholdFormProps {
  /** Current threshold from org_settings. null = disabled. */
  initialThreshold: number | null;
}

export function DailyThresholdForm({ initialThreshold }: DailyThresholdFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveDailyThresholdAction(fd);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-md max-w-[480px]">
          <h3 className="text-[13px] font-medium text-text">Daily aggregate spend alert</h3>
          <FormField
            label="Daily threshold (USD)"
            htmlFor="threshold_usd"
            hint="Slack DM to admins fires once per UTC day when total spend exceeds this threshold. Leave empty to disable."
          >
            <Input
              id="threshold_usd"
              name="threshold_usd"
              data-testid="daily-threshold-input"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialThreshold == null ? '' : String(initialThreshold)}
              placeholder="Disabled"
              inputMode="decimal"
            />
          </FormField>
          {error && (
            <p className="text-destructive text-[13px]" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-text-muted text-[13px]" role="status">
              Threshold saved.
            </p>
          )}
          <Button
            type="submit"
            intent="primary"
            size="md"
            disabled={isPending}
            data-testid="daily-threshold-save"
          >
            {isPending ? 'Saving...' : 'Save threshold'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
