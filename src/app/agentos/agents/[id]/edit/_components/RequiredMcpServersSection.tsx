'use client';
/**
 * Plan 08-04 / Phase 8 — Required MCP Servers section.
 *
 * Closes Phase 7.1 backlog item #3: Edit page UI didn't expose required_mcp_servers.
 *
 * Renders one checkbox per known MCP server. Checking/unchecking persists via
 * saveRequiredMcpServers Server Action. The section is also reused inside
 * ToolPermissionsSection so it appears in the wizard's Step 5 automatically.
 *
 * Note: Auto-derive runs server-side inside saveToolPermissions — when the user
 * grants any non-no_access permission for an mcp__<server>__<tool>, the server
 * auto-adds that server to required_mcp_servers. Manual selections here override
 * the auto-derive for the current save; subsequent saveToolPermissions calls will
 * re-derive (the last-write wins; manual additions of 'slack_bot' are preserved
 * by the auto-derive logic).
 *
 * testid contract:
 *   - required-mcp-servers-section
 *   - required-mcp-checkbox-{key}  (slack, slack_bot, google_calendar, gmail, google_drive, notion)
 *   - required-mcp-saving
 *   - required-mcp-error
 */
import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { saveRequiredMcpServers } from '../_actions';

// LOCKED list — must match runner.py mcp_servers_dict keys and existing tool name patterns.
const KNOWN_SERVERS: ReadonlyArray<{ key: string; label: string; note?: string }> = [
  { key: 'slack', label: 'Slack' },
  {
    key: 'slack_bot',
    label: 'Slack (bot identity)',
    note: 'COO supervisor only — usually not needed',
  },
  { key: 'google_calendar', label: 'Google Calendar' },
  { key: 'gmail', label: 'Gmail' },
  { key: 'google_drive', label: 'Google Drive' },
  { key: 'notion', label: 'Notion' },
];

export function RequiredMcpServersSection({
  agentId,
  initial,
  canEdit,
}: {
  agentId: string;
  initial: string[];
  canEdit: boolean;
}) {
  const [servers, setServers] = useState<string[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    const next = servers.includes(key)
      ? servers.filter((s) => s !== key)
      : [...servers, key];
    setServers(next);
    startTransition(async () => {
      setError(null);
      const result = await saveRequiredMcpServers(agentId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Card data-testid="required-mcp-servers-section" className="mt-4">
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-medium text-base">Required MCP Servers</h3>
        <p className="text-xs text-muted-foreground">
          MCP servers that must be initialized for this agent to run.
          Auto-managed by tool permissions — granting any non-"No access"
          permission for an MCP tool auto-adds that server. Override manually
          here.
        </p>
        <ul className="flex flex-col gap-1 mt-2">
          {KNOWN_SERVERS.map((s) => {
            const checked = servers.includes(s.key);
            return (
              <li key={s.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`required-mcp-${s.key}`}
                  data-testid={`required-mcp-checkbox-${s.key}`}
                  checked={checked}
                  disabled={!canEdit || isPending}
                  onChange={() => toggle(s.key)}
                  className="h-4 w-4"
                />
                <Label htmlFor={`required-mcp-${s.key}`} className="text-sm">
                  {s.label}
                </Label>
                {s.note && (
                  <span className="text-xs text-muted-foreground">
                    {s.note}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {isPending && (
          <p
            data-testid="required-mcp-saving"
            className="text-xs text-muted-foreground"
          >
            Saving…
          </p>
        )}
        {error && (
          <p
            data-testid="required-mcp-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
