'use client';

import { useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { IntegrationDef } from '../_data/registry';
import { ToolsDrillIn } from './ToolsDrillIn';

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
  // For MVP, use direct URLs. Each provider's full client_id is exposed via
  // a public env var; the redirect_uri is derived from window.location.origin.
  // Falls back to '#' when client_id is unset (development without OAuth).
  if (integrationKey === 'slack') {
    // Goes through /api/oauth/slack/start so the CSRF state cookie is set
    // before the redirect to Slack — the callback verifies cookie === state.
    return '/api/oauth/slack/start';
  }
  if (integrationKey === 'google_calendar') {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return '#';
    const scope = 'https://www.googleapis.com/auth/calendar';
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  }
  return '#';
}

export function IntegrationCard({ integration, connected }: IntegrationCardProps) {
  const [open, setOpen] = useState(false);
  const panelId = `tools-drill-${integration.key}`;
  const toolCount = integration.tools.length;

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
