'use client';
/**
 * Plan 08-04 / Phase 8 — Wizard Step 7: Schedule.
 *
 * Client component that renders SchedulePresetSelector + saves via
 * saveScheduleStep Server Action, then navigates to Step 8 (Review).
 *
 * schedule_enabled stays false on activation per CONTEXT.md decision #16.
 * The schedule is captured here but the user must explicitly enable it from
 * the Edit page after confirming the agent works correctly.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SchedulePresetSelector } from './_components/SchedulePresetSelector';
import { saveScheduleStep } from './_actions';

export function ScheduleStep({
  draft,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}) {
  const router = useRouter();
  const [cron, setCron] = useState<string>(draft.schedule_cron ?? '');
  const [timezone, setTimezone] = useState<string>(
    draft.schedule_timezone ?? 'America/Mexico_City',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    setSaving(true);
    setError(null);
    const result = await saveScheduleStep(draft.id as string, {
      schedule_cron: cron,
      schedule_timezone: timezone,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/review?draft=${draft.id}`);
  }

  return (
    <Card data-testid="wizard-step-7">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Schedule defines when this agent runs automatically. The schedule will
          be <strong>disabled by default</strong> on activation — enable it from
          the Edit page after you confirm the agent works correctly.
        </p>

        <SchedulePresetSelector
          cron={cron}
          timezone={timezone}
          onCronChange={setCron}
          onTimezoneChange={setTimezone}
        />

        {error && (
          <p
            data-testid="schedule-step-error"
            className="text-destructive text-xs"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-between mt-4">
          <Button asChild intent="ghost" size="sm">
            <a
              href={`/agentos/agents/new/autonomy?draft=${draft.id}`}
              data-testid="wizard-back-btn"
            >
              Back
            </a>
          </Button>
          <Button
            onClick={handleNext}
            intent="primary"
            size="sm"
            data-testid="wizard-next-btn"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
