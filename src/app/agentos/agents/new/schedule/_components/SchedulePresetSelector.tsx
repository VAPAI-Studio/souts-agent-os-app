'use client';
/**
 * Plan 08-04 / Phase 8 — Schedule preset selector for Wizard Step 7.
 *
 * 5 presets exactly (per CONTEXT.md decision):
 *   1. Every weekday at 9am   → 0 9 * * 1-5
 *   2. Every Monday at 9am    → 0 9 * * 1
 *   3. Daily at 6pm           → 0 18 * * *
 *   4. Every hour             → 0 * * * *
 *   5. Custom cron...         → reveals raw text input (escape hatch)
 *
 * "No schedule (run only manually)" is NOT a preset.
 * Users achieve no-schedule by selecting "Custom cron..." and leaving the
 * cron input empty. The wizard always sets schedule_enabled=false on activation
 * per CONTEXT.md decision #16, so an empty cron effectively means no schedule.
 */
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

export const SCHEDULE_PRESETS = [
  { label: 'Every weekday at 9am', cron: '0 9 * * 1-5' },
  { label: 'Every Monday at 9am', cron: '0 9 * * 1' },
  { label: 'Daily at 6pm', cron: '0 18 * * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Custom cron...', cron: 'CUSTOM' },
] as const;

export function SchedulePresetSelector({
  cron,
  timezone,
  onCronChange,
  onTimezoneChange,
}: {
  cron: string;
  timezone: string;
  onCronChange: (v: string) => void;
  onTimezoneChange: (v: string) => void;
}) {
  // Determine which preset matches the current cron value.
  const matchingPreset = SCHEDULE_PRESETS.find(
    (p) => p.cron === cron && p.cron !== 'CUSTOM',
  );
  // If cron is empty OR doesn't match a preset, treat as Custom
  // (empty cron means "no schedule" effectively — schedule_enabled stays false).
  const selectedLabel = matchingPreset ? matchingPreset.label : 'Custom cron...';
  const isCustom = selectedLabel === 'Custom cron...';

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Schedule preset" htmlFor="field-schedule-preset">
        <Select
          id="field-schedule-preset"
          data-testid="field-schedule-preset"
          value={selectedLabel}
          onChange={(e) => {
            const preset = SCHEDULE_PRESETS.find(
              (p) => p.label === e.target.value,
            );
            if (!preset) return;
            if (preset.cron === 'CUSTOM') {
              // Reveal the custom input. If current cron matches a named preset,
              // clear it so the user starts fresh; otherwise keep existing value.
              if (matchingPreset) onCronChange('');
              return;
            }
            onCronChange(preset.cron);
          }}
        >
          {SCHEDULE_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </Select>
      </FormField>

      {isCustom && (
        <FormField
          label="Custom cron expression"
          htmlFor="field-schedule-cron"
          hint="5-field cron (e.g., 0 9 * * 1-5). Leave empty for no schedule."
        >
          <Input
            id="field-schedule-cron"
            data-testid="field-schedule-cron"
            value={cron}
            onChange={(e) => onCronChange(e.target.value)}
            placeholder="0 9 * * 1-5"
            className="font-mono"
          />
        </FormField>
      )}

      {!isCustom && cron && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="field-schedule-cron-readonly"
        >
          Cron: <code>{cron}</code>
        </p>
      )}

      <FormField label="Timezone" htmlFor="field-schedule-timezone">
        <Input
          id="field-schedule-timezone"
          data-testid="field-schedule-timezone"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          placeholder="America/Mexico_City"
        />
      </FormField>
    </div>
  );
}
