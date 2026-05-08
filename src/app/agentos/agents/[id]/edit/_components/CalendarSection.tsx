'use client';
/**
 * Phase 7 / Plan 07-01 — Calendar IDs section on the Agent Edit page.
 *
 * Upgraded from Phase 6 singular text input (calendar_id: string) to
 * multi-select list (calendar_ids: string[]) to support per-agent calendar
 * ID allowlists. Backward-compat: parent reads agents.config.calendar_ids ??
 * [agents.config.calendar_id].filter(Boolean) before passing initialCalendarIds.
 *
 * UI-SPEC §Surface 2:
 *   - Multi-select: list of editable rows, each with a text input + remove button.
 *   - Add new calendar ID via text input + "Add" button.
 *   - Save persists agents.config.calendar_ids[] via saveCalendarIds Server Action.
 *
 * testid contract: calendar-section, calendar-id-input (per-row), add-calendar-id-btn,
 *   save-calendar-ids-btn.
 */
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { saveCalendarIds } from '../_actions';

export interface CalendarSectionProps {
  agentId: string;
  /** Pre-populated from agents.config.calendar_ids (Phase 7) or
   *  [agents.config.calendar_id].filter(Boolean) (Phase 6 backward-compat).
   *  Parent is responsible for the fallback merge. */
  initialCalendarIds: string[];
}

export function CalendarSection({
  agentId,
  initialCalendarIds,
}: CalendarSectionProps) {
  const [calendarIds, setCalendarIds] = useState<string[]>(initialCalendarIds);
  const [newId, setNewId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addCalendarId = () => {
    const trimmed = newId.trim();
    if (!trimmed) return;
    if (calendarIds.includes(trimmed)) {
      setError('Calendar ID already in list.');
      return;
    }
    setCalendarIds((prev) => [...prev, trimmed]);
    setNewId('');
    setError(null);
  };

  const removeCalendarId = (id: string) => {
    setCalendarIds((prev) => prev.filter((c) => c !== id));
  };

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveCalendarIds(agentId, calendarIds);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Calendar IDs saved.');
      }
    });
  };

  return (
    <section data-testid="calendar-section" className="mt-xl">
      <h2 className="text-18 font-semibold">Google Calendar</h2>
      <p className="text-13 text-text-muted">
        Calendar IDs this agent can read and write. Add &quot;primary&quot; for
        the connected account&apos;s primary calendar, or paste a fully-qualified
        calendar ID (e.g., <code>abc123@group.calendar.google.com</code>).
      </p>

      {calendarIds.length > 0 && (
        <ul className="mt-sm flex flex-col gap-1">
          {calendarIds.map((id) => (
            <li key={id} className="flex items-center gap-sm">
              <Input
                type="text"
                value={id}
                readOnly
                data-testid="calendar-id-input"
                className="flex-1 font-mono text-13"
              />
              <Button
                intent="secondary"
                size="sm"
                onClick={() => removeCalendarId(id)}
                type="button"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-sm flex gap-sm items-end">
        <div className="flex-1">
          <Input
            id="new-calendar-id"
            type="text"
            data-testid="calendar-id-input"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder='primary or abc123@group.calendar.google.com'
            onKeyDown={(e) => e.key === 'Enter' && addCalendarId()}
          />
        </div>
        <Button
          intent="secondary"
          size="sm"
          onClick={addCalendarId}
          type="button"
          data-testid="add-calendar-id-btn"
        >
          Add
        </Button>
      </div>

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
          data-testid="save-calendar-ids-btn"
        >
          {isPending ? 'Saving…' : 'Save calendar IDs'}
        </Button>
      </div>
    </section>
  );
}
