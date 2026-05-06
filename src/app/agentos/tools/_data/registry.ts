/**
 * Phase 6 / Plan 06-02 — static catalog of integrations + their tools.
 *
 * This file is the source of truth for /agentos/tools and the seed list of
 * tool names used by createAgent (`agent_tool_permissions` seed rows). It is
 * NOT a DB query — it describes the registered integrations, their MCP tool
 * names, and per-tool metadata.
 *
 * Source-of-truth duplication note:
 *   ALL_REGISTERED_TOOLS below mirrors the list-of-strings hard-coded in
 *   souts-agent-os-app/src/app/agentos/agents/_actions.ts createAgent seed
 *   path. When adding/removing a tool, update BOTH places. A polish-phase
 *   refactor can collapse this once Server Actions can import from app paths
 *   without breaking webpack module resolution from the action runtime.
 */

export type ToolDef = {
  name: string;
  description: string;
  type: 'read' | 'write';
  defaultPermission: 'always_allowed' | 'approval_gated';
};

export type IntegrationDef = {
  key: string;          // matches mcp_servers key — load-bearing for mcp__{key}__*
  label: string;        // display name
  tools: ToolDef[];
  placeholder: boolean; // true = Phase 7+ (Connect button disabled)
};

export const REGISTRY: IntegrationDef[] = [
  {
    key: 'slack',
    label: 'Slack',
    placeholder: false,
    tools: [
      { name: 'mcp__slack__list_channels', description: 'List accessible channels', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__get_channel_history', description: 'Read messages from a channel', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__search_messages', description: 'Search across allowlisted channels', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__post_message', description: 'Post a message to a channel', type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__post_thread', description: 'Reply in a thread', type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__send_dm', description: 'Send a direct message', type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__draft_dm', description: 'Draft a direct message (no send)', type: 'write', defaultPermission: 'always_allowed' },
    ],
  },
  {
    key: 'google_calendar',
    label: 'Google Calendar',
    placeholder: false,
    tools: [
      { name: 'mcp__google_calendar__list_calendars', description: 'List accessible calendars', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__google_calendar__list_events', description: 'List events from a calendar', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__google_calendar__get_event', description: 'Get a specific event by ID', type: 'read', defaultPermission: 'always_allowed' },
    ],
  },
  { key: 'gmail', label: 'Gmail', placeholder: true, tools: [] },
  { key: 'drive', label: 'Google Drive', placeholder: true, tools: [] },
  { key: 'notion', label: 'Notion', placeholder: true, tools: [] },
];

export const ALL_REGISTERED_TOOLS: string[] = REGISTRY
  .filter((i) => !i.placeholder)
  .flatMap((i) => i.tools.map((t) => t.name));
