/**
 * Phase 6 / Plan 06-02 — static catalog of integrations + their tools.
 * Phase 6.1 / Plan 06.1-02 — Slack tool names updated to live-MCP fixture names
 *   (souts-agent-os-modal/tests/fixtures/mcp_tool_names_slack.json captured 2026-05-07).
 *   Old names like mcp__slack__post_message removed; live MCP advertises
 *   mcp__slack__slack_send_message (redundant slack_-leaf-prefix).
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
  type: 'read' | 'write' | 'draft';
  defaultPermission: 'always_allowed' | 'approval_gated' | 'draft_only';
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
      // Reads — always allowed
      { name: 'mcp__slack__slack_search_channels',           description: 'Search Slack channels by name or description', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_search_public',             description: 'Search messages and files in public channels', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_search_public_and_private', description: 'Search messages across all accessible channels', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_search_users',              description: 'Search Slack users by name or profile', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_read_channel',              description: 'Read messages from a Slack channel', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_read_thread',               description: 'Read replies in a Slack thread', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_read_canvas',               description: 'Read a Slack canvas document', type: 'read', defaultPermission: 'always_allowed' },
      { name: 'mcp__slack__slack_read_user_profile',         description: 'Read a Slack user profile', type: 'read', defaultPermission: 'always_allowed' },
      // Writes — approval-gated
      { name: 'mcp__slack__slack_send_message',     description: 'Send a message to a channel or DM (also handles thread replies via thread_ts)', type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__slack_schedule_message', description: 'Schedule a message for future delivery',                                          type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__slack_create_canvas',    description: 'Create a Slack Canvas document',                                                  type: 'write', defaultPermission: 'approval_gated' },
      { name: 'mcp__slack__slack_update_canvas',    description: 'Update an existing Slack Canvas document',                                        type: 'write', defaultPermission: 'approval_gated' },
      // Draft — separate pathway
      { name: 'mcp__slack__slack_send_message_draft', description: 'Create a Slack draft (saved to Drafts, not sent)', type: 'draft', defaultPermission: 'draft_only' },
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
