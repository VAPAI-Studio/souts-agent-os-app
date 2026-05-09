'use client';
/**
 * Phase 6 / Plan 06-03 — Slack Channels section on the Agent Edit page.
 *
 * Renders the agent's per-channel allowlist. Pulls available channels from
 * /api/integrations/slack/channels (now returns all visible channels, with
 * is_member flag). Selected channels are saved to agents.config.slack_channels.
 *
 * UX:
 *   - Channels the bot is already in: show first, can be ticked freely.
 *   - Channels the bot is NOT in: show below with "(invite bot)" hint.
 *     Ticking still works — the runner allowlist gate fires before any post,
 *     and the user must invite the bot to that channel for posts to land.
 *   - Manual add: paste a channel ID (e.g. C0ACU3ZC6S3) for channels not in
 *     the list (DMs, channels the bot can't enumerate, etc).
 */
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { saveSlackChannels } from '../_actions';

type Channel = {
  id: string;
  name: string;
  is_member?: boolean;
  is_private?: boolean;
};

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
  const [manualId, setManualId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/slack/channels')
      .then((r) => r.json())
      .then((d: { channels?: Channel[]; error?: string }) => {
        if (cancelled) return;
        setAvailable(d.channels ?? []);
        if (d.error) setError(`Slack API: ${d.error}`);
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

  const { memberChannels, nonMemberChannels, manuallyAdded } = useMemo(() => {
    const known = new Set(available.map((c) => c.id));
    const member = available.filter((c) => c.is_member);
    const nonMember = available.filter((c) => !c.is_member);
    const manual = [...selected].filter((id) => !known.has(id));
    return {
      memberChannels: member,
      nonMemberChannels: nonMember,
      manuallyAdded: manual,
    };
  }, [available, selected]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onAddManual = () => {
    const id = manualId.trim();
    if (!id) return;
    // Slack channel IDs start with C (public), G (private legacy), or D (DM).
    if (!/^[CGD][A-Z0-9]{8,}$/i.test(id)) {
      setError(`"${id}" doesn't look like a Slack channel ID (starts with C, G, or D).`);
      return;
    }
    setError(null);
    const next = new Set(selected);
    next.add(id.toUpperCase());
    setSelected(next);
    setManualId('');
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
        Channels this agent is allowed to read and post to. Posts to a channel
        the bot hasn&apos;t joined will fail — invite the bot with{' '}
        <span className="font-mono">/invite @AgentOS</span> in that channel
        first.
      </p>

      {loading && (
        <p className="text-13 text-text-muted mt-sm">Loading channels…</p>
      )}

      {!loading && available.length === 0 && manuallyAdded.length === 0 && !error && (
        <p className="text-13 text-text-muted mt-sm">
          No channels available. Connect Slack first.
        </p>
      )}

      {memberChannels.length > 0 && (
        <>
          <h3 className="text-13 font-medium mt-md">Bot is a member</h3>
          <ul
            data-testid="slack-channels-list"
            className="mt-sm flex flex-col gap-1"
          >
            {memberChannels.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                checked={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </ul>
        </>
      )}

      {nonMemberChannels.length > 0 && (
        <>
          <h3 className="text-13 font-medium mt-md text-text-muted">
            Bot not in channel — must be invited before it can post
          </h3>
          <ul
            data-testid="slack-channels-non-member-list"
            className="mt-sm flex flex-col gap-1"
          >
            {nonMemberChannels.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                checked={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                muted
              />
            ))}
          </ul>
        </>
      )}

      {manuallyAdded.length > 0 && (
        <>
          <h3 className="text-13 font-medium mt-md text-text-muted">
            Manually added (channel ID)
          </h3>
          <ul className="mt-sm flex flex-col gap-1">
            {manuallyAdded.map((id) => (
              <li key={id} className="py-1">
                <label className="flex items-center gap-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggle(id)}
                  />
                  <span className="font-mono text-13">{id}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-md flex flex-col gap-sm">
        <label className="text-13 font-medium" htmlFor="slack-manual-id">
          Add channel by ID
        </label>
        <p className="text-13 text-text-muted">
          For channels not in the list above (e.g. private channels the bot can&apos;t
          enumerate yet). Find the ID in Slack: channel name → About → bottom of panel.
        </p>
        <div className="flex gap-sm">
          <Input
            id="slack-manual-id"
            placeholder="C0ACU3ZC6S3"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            data-testid="slack-channel-manual-input"
            className="font-mono max-w-[260px]"
          />
          <Button
            intent="secondary"
            size="sm"
            onClick={onAddManual}
            data-testid="slack-channel-manual-add-btn"
            type="button"
          >
            Add
          </Button>
        </div>
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
      <div className="mt-md">
        <Button
          intent="primary"
          size="sm"
          onClick={onSave}
          disabled={isPending || loading}
          data-testid="save-slack-channels-btn"
          type="button"
        >
          {isPending ? 'Saving…' : 'Save channels'}
        </Button>
      </div>
    </section>
  );
}

function ChannelRow({
  channel,
  checked,
  onToggle,
  muted,
}: {
  channel: Channel;
  checked: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  return (
    <li className="py-1">
      <label
        className={
          muted
            ? 'flex items-center gap-sm cursor-pointer text-text-muted'
            : 'flex items-center gap-sm cursor-pointer'
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          data-testid={`slack-channel-${channel.id}`}
        />
        <span>
          {channel.is_private ? '🔒 ' : '#'}
          {channel.name}
        </span>
        <span className="font-mono text-13 text-text-muted">({channel.id})</span>
      </label>
    </li>
  );
}
