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
  const { data: conn } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('metadata')
    .eq('integration', 'slack')
    .eq('status', 'connected')
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ channels: [] });
  }

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
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = (await resp.json()) as { channels?: SlackChannel[]; ok?: boolean };

  const channels = (json.channels ?? [])
    .filter((c) => c.is_member)
    .map((c) => ({ id: c.id, name: c.name }));

  return NextResponse.json({ channels });
}
