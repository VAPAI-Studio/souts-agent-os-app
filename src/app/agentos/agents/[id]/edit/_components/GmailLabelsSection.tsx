'use client';
/**
 * Phase 7 / Plan 07-02 — Gmail Label Allowlist section on the Agent Edit page.
 *
 * Renders a free-text add/remove chip UI for Gmail label names (e.g., "INBOX", "P0",
 * "Customer-Reports"). Since Gmail labels are user-defined and there is no simple API
 * to enumerate them without a token, we use free-text input + chip display instead of
 * a checkbox list (unlike SlackChannelsSection which fetches available channels).
 *
 * Allowlist semantics (enforced by hooks/gmail_allowlist.py):
 *   - Empty list = inbox-implicit (agent can read the entire connected inbox).
 *   - Non-empty = agent can only read/operate on threads that have at least ONE
 *     of the listed labels. Use Gmail system labels (INBOX, SENT, SPAM, P0, etc.)
 *     or custom label names exactly as they appear in Gmail.
 *
 * testid contract:
 *   gmail-labels-section, gmail-label-input, add-gmail-label-btn,
 *   gmail-label-chip-{label}, save-gmail-labels-btn.
 */
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { saveGmailLabels } from '../_actions';

export interface GmailLabelsSectionProps {
  agentId: string;
  /** Pre-populated from agents.config.gmail_label_allowlist (string[]). */
  initialLabels: string[];
}

export function GmailLabelsSection({
  agentId,
  initialLabels,
}: GmailLabelsSectionProps) {
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addLabel = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (labels.includes(trimmed)) {
      setError('Label already in list.');
      return;
    }
    setLabels((prev) => [...prev, trimmed]);
    setNewLabel('');
    setError(null);
  };

  const removeLabel = (label: string) => {
    setLabels((prev) => prev.filter((l) => l !== label));
  };

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveGmailLabels(agentId, labels);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Gmail labels saved.');
      }
    });
  };

  return (
    <section data-testid="gmail-labels-section" className="mt-xl">
      <h2 className="text-18 font-semibold">Gmail Label Allowlist</h2>
      <p className="text-13 text-text-muted">
        Empty list = the agent can read your entire inbox. Add labels (e.g.,{' '}
        <code>INBOX</code>, <code>P0</code>, <code>Customer-Reports</code>) to
        scope it down. The agent can only read threads that have at least one of
        the listed labels.
      </p>

      {labels.length > 0 && (
        <ul className="mt-sm flex flex-wrap gap-2">
          {labels.map((label) => (
            <li
              key={label}
              data-testid={`gmail-label-chip-${label}`}
              className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-13"
            >
              <span>{label}</span>
              <button
                type="button"
                aria-label={`Remove label ${label}`}
                onClick={() => removeLabel(label)}
                className="ml-1 text-text-muted hover:text-destructive"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-sm flex gap-sm items-end">
        <div className="flex-1">
          <Input
            id="new-gmail-label"
            type="text"
            data-testid="gmail-label-input"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="INBOX, P0, Customer-Reports…"
            onKeyDown={(e) => e.key === 'Enter' && addLabel()}
          />
        </div>
        <Button
          intent="secondary"
          size="sm"
          onClick={addLabel}
          type="button"
          data-testid="add-gmail-label-btn"
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
          data-testid="save-gmail-labels-btn"
        >
          {isPending ? 'Saving…' : 'Save labels'}
        </Button>
      </div>
    </section>
  );
}
