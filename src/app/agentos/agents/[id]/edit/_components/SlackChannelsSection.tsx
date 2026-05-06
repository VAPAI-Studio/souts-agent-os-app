'use client';
/**
 * Phase 6 / Plan 06-03 — Slack Channels section on the Agent Edit page.
 *
 * UI-SPEC §Surface 2 (Slack section, lines 257-271):
 *   - Multi-select rendered as a list of checkboxes (MVP).
 *   - Channels fetched dynamically from /api/integrations/slack/channels.
 *   - Save button persists agents.config.slack_channels via saveSlackChannels.
 *
 * testid contract: section + list + per-channel + save button (see
 *   data-testid attributes below for the exact strings).
 */
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { saveSlackChannels } from '../_actions';

type Channel = { id: string; name: string };

export interface SlackChannelsSectionProps {
  agentId: string;
  initialChannelIds: string[];
}

export function SlackChannelsSection({
  agentId,
  initialChannelIds,
}: SlackChannelsSectionProps) {
  const [available, setAvailable] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialChannelIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/slack/channels')
      .then((r) => r.json())
      .then((d: { channels?: Channel[] }) => {
        if (cancelled) return;
        setAvailable(d.channels ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(`Failed to load channels: ${String(e)}`);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveSlackChannels(agentId, [...selected]);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Channels saved.');
      }
    });
  };

  return (
    <section data-testid="slack-channels-section" className="mt-xl">
      <h2 className="text-18 font-semibold">Slack Channels</h2>
      <p className="text-13 text-text-muted">
        Which channels this agent can read and post to. The bot must be invited
        to the channel before it appears here.
      </p>
      {loading && (
        <p className="text-13 text-text-muted mt-sm">Loading channels…</p>
      )}
      {!loading && available.length === 0 && !error && (
        <p className="text-13 text-text-muted mt-sm">
          No channels available. Connect Slack and invite the bot to channels first.
        </p>
      )}
      {available.length > 0 && (
        <ul data-testid="slack-channels-list" className="mt-sm flex flex-col gap-1">
          {available.map((c) => (
            <li key={c.id} className="py-1">
              <label className="flex items-center gap-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  data-testid={`slack-channel-${c.id}`}
                />
                <span>#{c.name}</span>
                <span className="font-mono text-13 text-text-muted">
                  ({c.id})
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
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
          disabled={isPending || loading}
          data-testid="save-slack-channels-btn"
        >
          {isPending ? 'Saving…' : 'Save channels'}
        </Button>
      </div>
    </section>
  );
}
