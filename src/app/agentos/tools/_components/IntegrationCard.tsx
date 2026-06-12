'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { IntegrationDef } from '../_data/registry';
import { ToolsDrillIn } from './ToolsDrillIn';
import { disconnectIntegrationAction } from '../_actions';

interface IntegrationCardProps {
  integration: IntegrationDef;
  connected: boolean;
}

/**
 * Phase 6 / Plan 06-02 — UI-SPEC §Surface 1 lines 144-178.
 * Renders a single integration row with status badge + connect/tools actions.
 *
 * testid contract:
 *   - integration-card-{key}
 *   - integration-status-{key}
 *   - tools-connect-{key}
 *   - drill-in panel below card when 'Tools' is clicked
 */
function buildOAuthInitUrl(integrationKey: string): string {
  // All integrations route through their /api/oauth/{provider}/start handler
  // so CSRF state cookies (and PKCE verifier for Notion) are set server-side
  // before the redirect to the provider.
  if (integrationKey === 'slack') {
    return '/api/oauth/slack/start';
  }
  if (integrationKey === 'notion') {
    return '/api/oauth/notion/start';
  }
  if (
    integrationKey === 'google_calendar' ||
    integrationKey === 'google_drive' ||
    integrationKey === 'gmail'
  ) {
    // /api/oauth/google/start reads ?integration= and sets the
    // google_oauth_integration cookie so the shared callback knows which
    // tool_connections row to upsert.
    return `/api/oauth/google/start?integration=${encodeURIComponent(integrationKey)}`;
  }
  return '#';
}

export function IntegrationCard({ integration, connected }: IntegrationCardProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const panelId = `tools-drill-${integration.key}`;
  const toolCount = integration.tools.length;

  function handleDisconnect() {
    if (
      !window.confirm(
        `Disconnect ${integration.label}? The agent will stop using this source until you reconnect it.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await disconnectIntegrationAction(integration.key);
      if (!result.ok) {
        window.alert(`Could not disconnect: ${result.error}`);
        return;
      }
      setOpen(false);
      router.refresh(); // re-fetch the page so the badge flips to "Not connected"
    });
  }

  const oauthUrl = buildOAuthInitUrl(integration.key);
  const connectLabel = `Connect ${integration.label}`;

  return (
    <div data-testid={`integration-card-${integration.key}`}>
      <Card>
        <CardBody>
          <div className="flex items-start gap-md">
            {/* logo placeholder 32x32 */}
            <div className="w-8 h-8 rounded bg-surface flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-sm flex-wrap">
                <span className="text-[16px] font-semibold text-text">
                  {integration.label}
                </span>
                <Badge
                  data-testid={`integration-status-${integration.key}`}
                  tone={connected ? 'accent' : 'neutral'}
                >
                  {connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
              <div className="text-[13px] text-text-muted mt-1">
                {connected ? 'Connected as bot' : 'Not connected'}
              </div>
              {!integration.placeholder && (
                <div className="text-[13px] text-text-muted mt-1">
                  {toolCount} tools available
                </div>
              )}
            </div>

            <div className="flex items-center gap-sm flex-shrink-0">
              {connected && !integration.placeholder && (
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={() => setOpen((prev) => !prev)}
                  aria-expanded={open}
                  aria-controls={panelId}
                >
                  Tools
                </Button>
              )}
              {connected && (
                <Button
                  intent="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isPending}
                  data-testid={`tools-disconnect-${integration.key}`}
                >
                  {isPending ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              )}
              {!connected && !integration.placeholder && (
                <Button
                  asChild
                  intent="secondary"
                  size="sm"
                  data-testid={`tools-connect-${integration.key}`}
                >
                  <a href={oauthUrl}>{connectLabel}</a>
                </Button>
              )}
              {integration.placeholder && (
                <Button
                  intent="secondary"
                  size="sm"
                  disabled
                  data-testid={`tools-connect-${integration.key}`}
                  aria-disabled="true"
                >
                  Coming soon
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
      {open && !integration.placeholder && (
        <div id={panelId}>
          <ToolsDrillIn integration={integration} />
        </div>
      )}
    </div>
  );
}
