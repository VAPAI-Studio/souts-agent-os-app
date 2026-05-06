'use client';
/**
 * Plan 06-03b — Schedule section on the Agent Edit page.
 *
 * UI-SPEC §Surface 2 testid contract:
 *   schedule-enabled, schedule-cron, schedule-timezone, schedule-next-fires,
 *   save-schedule-btn.
 *
 * Validation:
 *   - cron-parser parses the cron expression in the chosen IANA timezone.
 *   - On parse failure, the next-fires preview hides AND the Save button disables.
 *   - On success, the next 3 fire times render (ISO strings) below the form.
 *
 * Server-side defense-in-depth: saveSchedule re-parses with cron-parser and rejects
 * malformed input, even though the client gates the Save button.
 */
import { useMemo, useState, useTransition } from 'react';
import { CronExpressionParser } from 'cron-parser';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { saveSchedule } from '../_actions';

// Common IANA timezones — full picker deferred to v2.
const COMMON_TIMEZONES = [
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
];

export interface ScheduleSectionInitial {
  schedule_cron: string | null;
  schedule_timezone: string | null;
  schedule_enabled: boolean;
}

export interface ScheduleSectionProps {
  agentId: string;
  initial: ScheduleSectionInitial;
}

export function ScheduleSection({ agentId, initial }: ScheduleSectionProps) {
  const [enabled, setEnabled] = useState(initial.schedule_enabled);
  const [cron, setCron] = useState(initial.schedule_cron ?? '0 9 * * 1-5');
  const [tz, setTz] = useState(
    initial.schedule_timezone ?? 'America/Mexico_City',
  );
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextFires = useMemo<Date[] | null>(() => {
    try {
      const interval = CronExpressionParser.parse(cron, { tz });
      return [
        interval.next().toDate(),
        interval.next().toDate(),
        interval.next().toDate(),
      ];
    } catch {
      return null;
    }
  }, [cron, tz]);

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveSchedule(agentId, {
        schedule_cron: cron,
        schedule_timezone: tz,
        schedule_enabled: enabled,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Schedule saved.');
      }
    });
  };

  return (
    <section
      data-testid="schedule-section"
      className="flex flex-col gap-md max-w-[600px] mt-lg"
    >
      <h2 className="text-[15px] font-semibold">Schedule</h2>

      <FormField label="Enable scheduled runs" htmlFor="schedule-enabled-input">
        <input
          id="schedule-enabled-input"
          type="checkbox"
          data-testid="schedule-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
      </FormField>

      <FormField
        label="Cron expression"
        htmlFor="schedule-cron-input"
        hint="5-field cron (e.g., 0 9 * * 1-5 = weekdays at 09:00)"
      >
        <Input
          id="schedule-cron-input"
          type="text"
          data-testid="schedule-cron"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          className="font-mono"
          placeholder="0 9 * * 1-5"
          error={!nextFires}
        />
      </FormField>
      {!nextFires && (
        <p
          className="text-destructive text-[13px]"
          role="alert"
          data-testid="schedule-cron-error"
        >
          Invalid cron expression. Use 5-field format: minute hour day-of-month month day-of-week.
        </p>
      )}

      <FormField label="Timezone" htmlFor="schedule-timezone-input">
        <Select
          id="schedule-timezone-input"
          data-testid="schedule-timezone"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          {COMMON_TIMEZONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </FormField>

      {nextFires && (
        <div
          data-testid="schedule-next-fires"
          className="text-text-muted text-[13px] font-mono"
        >
          <p className="mb-1">Next 3 scheduled fires:</p>
          <ul className="list-disc pl-5">
            {nextFires.map((d, i) => (
              <li key={i}>{d.toISOString()}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p
          className="text-destructive text-[13px]"
          role="alert"
          data-testid="schedule-error"
        >
          {error}
        </p>
      )}
      {okMessage && (
        <p
          className="text-text-muted text-[13px]"
          role="status"
          data-testid="schedule-ok"
        >
          {okMessage}
        </p>
      )}

      <Button
        intent="primary"
        size="md"
        onClick={onSave}
        disabled={isPending || !nextFires}
        data-testid="save-schedule-btn"
      >
        {isPending ? 'Saving...' : 'Save schedule'}
      </Button>
    </section>
  );
}
