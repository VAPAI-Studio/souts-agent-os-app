'use client';
/**
 * Phase 6 / Plan 06-03 — Calendar ID section on the Agent Edit page.
 *
 * UI-SPEC §Surface 2 (Calendar section, lines 273-285):
 *   - Single text input for the Google Calendar ID.
 *   - Accepts "primary" or fully-qualified "<id>@group.calendar.google.com".
 *   - Save button persists agents.config.calendar_id via saveCalendarId.
 *
 * testid contract: section + input + save button (see data-testid attributes
 *   below for the exact strings).
 */
import { useState, useTransition } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { saveCalendarId } from '../_actions';

export interface CalendarSectionProps {
  agentId: string;
  initialCalendarId: string | null;
}

export function CalendarSection({
  agentId,
  initialCalendarId,
}: CalendarSectionProps) {
  const [calendarId, setCalendarId] = useState(initialCalendarId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveCalendarId(agentId, calendarId);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Calendar saved.');
      }
    });
  };

  return (
    <section data-testid="calendar-section" className="mt-xl">
      <h2 className="text-18 font-semibold">Google Calendar</h2>
      <FormField
        label="Calendar ID"
        htmlFor="calendar-id"
        hint='Paste the calendar ID from Google Calendar settings — e.g. "primary" or "abc123@group.calendar.google.com".'
      >
        <Input
          id="calendar-id"
          type="text"
          data-testid="calendar-id-input"
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          placeholder="primary or abc123@group.calendar.google.com"
        />
      </FormField>
      {error && (
        <p className="text-destructive mt-sm text-13" role="alert">
          {error}
        </p>
      )}
      {okMessage && (
        <p className="text-13 mt-sm" role="status">
          {okMessage}
        </p>
      )}
      <div className="mt-sm">
        <Button
          intent="primary"
          size="sm"
          onClick={onSave}
          disabled={isPending}
          data-testid="save-calendar-btn"
        >
          {isPending ? 'Saving…' : 'Save calendar'}
        </Button>
      </div>
    </section>
  );
}
