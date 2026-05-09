/**
 * Phase 6 / Plan 06-03 — GET /api/integrations/slack/channels
 *
 * Admin-only Route Handler that lists Slack channels for the per-agent
 * allowlist editor (SlackChannelsSection on /agents/<id>/edit).
 *
 * Token strategy (Phase 6.1 dual-token install):
 *   - The bot install row (xoxb-) is the token whose membership matters for
 *     posting. We call conversations.list with it FIRST to learn which
 *     channels the bot is already in.
 *   - The user OAuth row (xoxp-) typically has wider scopes (channels:read +
 *     groups:read) and can enumerate the workspace's full channel list. We
 *     call it SECOND and merge: any channel from the user listing that the
 *     bot didn't see is added with is_member=false, so admins can pre-
 *     allowlist channels and /invite the bot afterwards.
 *   - If only one token is present, we use whichever works.
 *   - If both fail (or only the bot is connected and lacks scopes), we
 *     surface the Slack error code so the UI can show "Slack API: <code>".
 *
 * Returns: [{id, name, is_member, is_private}, ...]
 * On no connected row: {channels: []}.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/encryption';

interface SlackChannel {
  id: string;
  name: string;
  is_member?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
}

interface OutChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_private: boolean;
}

function _serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

interface SlackListResult {
  channels: SlackChannel[];
  ok: boolean;
  error?: string;
}

async function listChannelsWithToken(token: string): Promise<SlackListResult> {
  const resp = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await resp.json()) as {
    channels?: SlackChannel[];
    ok?: boolean;
    error?: string;
  };
  return {
    channels: json.channels ?? [],
    ok: !!json.ok,
    error: json.error,
  };
}

function _decrypt(ciphertext: string | undefined): string | null {
  if (!ciphertext) return null;
  try {
    return decryptToken(ciphertext);
  } catch {
    return null;
  }
}

export async function GET() {
  await requireAdmin('/api/integrations/slack/channels');

  const supabase = _serviceClient();
  const { data: conns } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('metadata')
    .eq('integration', 'slack')
    .eq('status', 'connected');

  if (!conns || conns.length === 0) {
    return NextResponse.json({ channels: [] });
  }

  // Identify rows: bot install carries bot_user_id; user OAuth typically
  // does not (or carries slack_user_id). Phase 6.1 metadata.token_type
  // is also written but we don't rely on it (older rows may lack it).
  const botRow = conns.find((c) => {
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    return (
      m.token_type === 'bot' || (m.token_type !== 'user' && typeof m.bot_user_id === 'string')
    );
  });
  const userRow = conns.find((c) => {
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    return m.token_type === 'user' || typeof m.slack_user_id === 'string';
  });

  const botToken = botRow
    ? _decrypt(
        (botRow.metadata as { access_token_ciphertext?: string } | null)
          ?.access_token_ciphertext,
      )
    : null;
  const userToken = userRow
    ? _decrypt(
        (userRow.metadata as { access_token_ciphertext?: string } | null)
          ?.access_token_ciphertext,
      )
    : null;

  // Call both in parallel when present.
  const [botRes, userRes] = await Promise.all([
    botToken
      ? listChannelsWithToken(botToken)
      : Promise.resolve<SlackListResult | null>(null),
    userToken
      ? listChannelsWithToken(userToken)
      : Promise.resolve<SlackListResult | null>(null),
  ]);

  // Merge: start with whichever token returned channels, layer the other on top.
  // Bot's is_member is authoritative for "can the bot post here right now".
  const merged = new Map<string, OutChannel>();

  function ingest(list: SlackChannel[], source: 'bot' | 'user') {
    for (const c of list) {
      if (c.is_archived) continue;
      const prev = merged.get(c.id);
      if (!prev) {
        merged.set(c.id, {
          id: c.id,
          name: c.name,
          is_member: source === 'bot' ? !!c.is_member : false,
          is_private: !!c.is_private,
        });
      } else if (source === 'bot' && c.is_member) {
        // Bot is a member — that's the authoritative posting signal.
        merged.set(c.id, { ...prev, is_member: true });
      }
    }
  }

  if (userRes?.ok) ingest(userRes.channels, 'user');
  if (botRes?.ok) ingest(botRes.channels, 'bot');

  // If both calls failed (or no token returned ok), surface the most informative error.
  if (merged.size === 0) {
    const error = botRes?.error ?? userRes?.error ?? 'no_channels';
    if (error && error !== 'no_channels') {
      return NextResponse.json(
        { channels: [], error },
        { status: 502 },
      );
    }
    return NextResponse.json({ channels: [] });
  }

  return NextResponse.json({ channels: [...merged.values()] });
}
