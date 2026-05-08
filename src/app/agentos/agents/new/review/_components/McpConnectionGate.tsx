'use client';
/**
 * McpConnectionGate — hard gate on missing MCP server connections.
 *
 * - If no MCP servers are required, renders a soft "none required" message.
 * - If all required servers are connected, renders a success indicator.
 * - If any are missing, renders a red banner with per-server "Connect <X>" links.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import Link from 'next/link';

export function McpConnectionGate({
  requiredServers,
  connectedServers,
  missingServers,
}: {
  requiredServers: string[];
  connectedServers: string[];
  missingServers: string[];
}) {
  void connectedServers; // available for future use

  if (requiredServers.length === 0) {
    return (
      <div data-testid="mcp-gate-empty" className="text-xs text-muted-foreground">
        No MCP servers required for this agent.
      </div>
    );
  }
  if (missingServers.length === 0) {
    return (
      <div data-testid="mcp-gate-ok" className="text-xs text-success">
        All required MCP servers connected: {requiredServers.join(', ')}.
      </div>
    );
  }
  return (
    <div
      data-testid="mcp-gate-blocked"
      className="border border-destructive bg-destructive/10 text-destructive p-3 rounded-md flex flex-col gap-1"
      role="alert"
    >
      <strong className="text-sm">Missing tool connections</strong>
      <p className="text-xs">
        This agent requires the following MCP servers to function. Connect them before activating.
      </p>
      <ul className="text-xs flex flex-col gap-1 mt-1">
        {missingServers.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className="font-mono">{s}</span>
            <Link
              href="/agentos/tools"
              data-testid={`mcp-gate-connect-${s}`}
              className="text-accent hover:underline"
            >
              Connect {s} &rarr;
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
