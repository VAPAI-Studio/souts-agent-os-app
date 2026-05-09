/**
 * Phase 6 / Plan 06-03 — GET /api/integrations/slack/channels
 *
 * Admin-only Route Handler that lists the Slack channels the connected bot
 * is a member of. The Agent Edit page's SlackChannelsSection fetches this
 * and renders one checkbox per channel so admins can build the per-agent
 * allowlist that lands in agents.config.slack_channels.
 *
 * Steps:
 *   1. requireAdmin — JWT app_role gate.
 *   2. Read the connected slack tool_connections row (status='connected').
 *   3. Decrypt the OAuth bearer token via decryptToken (mirror-encryption pattern,
 *      same key used in souts-agent-os-modal/runner.py:_decrypt_token).
 *   4. Call the Slack Web API channel-listing endpoint (see fetch URL below)
 *      with types=public_channel,private_channel and filter to is_member=true
 *      so the user only sees channels the bot is already in (preflight will
 *      catch any drift).
 *   5. Return [{id, name}, ...] as JSON.
 *
 * On no connected row: returns {channels: []} (the section displays a "connect
 * Slack first" message).
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

function _serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function GET() {
  await requireAdmin('/api/integrations/slack/channels');

  const supabase = _serviceClient();
  // Prefer the bot install row (has bot_user_id) — it's the one whose token
  // posts as the bot. There may be both a user-OAuth and a bot-install row
  // marked 'connected'; pick the bot if available, else the first.
  const { data: conns } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('metadata')
    .eq('integration', 'slack')
    .eq('status', 'connected');

  if (!conns || conns.length === 0) {
    return NextResponse.json({ channels: [] });
  }

  const botRow = conns.find((c) => {
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    return typeof m.bot_user_id === 'string';
  });
  const conn = botRow ?? conns[0];

  const metadata = conn.metadata as { access_token_ciphertext?: string } | null;
  const ciphertext = metadata?.access_token_ciphertext;
  if (!ciphertext) {
    return NextResponse.json({ channels: [] });
  }

  let token: string;
  try {
    token = decryptToken(ciphertext);
  } catch {
    return NextResponse.json(
      { error: 'token_decrypt_failed', channels: [] },
      { status: 500 },
    );
  }

  // Slack Web API channel-listing call below — public + private. Limit 200
  // (single page covers the common case; pagination deferred until needed).
  const resp = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=200',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await resp.json()) as {
    channels?: SlackChannel[];
    ok?: boolean;
    error?: string;
  };

  if (!json.ok) {
    return NextResponse.json(
      { channels: [], error: json.error ?? 'slack_api_error' },
      { status: 502 },
    );
  }

  // Return ALL channels (public + private the token can see). The UI surfaces
  // is_member so admins know whether the bot can already post there. Selecting
  // a non-member channel is allowed — the runner allowlist gate fires before
  // the post, and the user is prompted to /invite the bot to that channel.
  const channels = (json.channels ?? [])
    .filter((c) => !c.is_archived)
    .map((c) => ({
      id: c.id,
      name: c.name,
      is_member: !!c.is_member,
      is_private: !!c.is_private,
    }));

  return NextResponse.json({ channels });
}
