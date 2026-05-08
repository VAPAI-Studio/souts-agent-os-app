'use client';

/**
 * Phase 6 / Plan 06-02 — UI-SPEC §Surface 2 lines 192-220.
 * Tool Permissions section on the Agent Edit page.
 *
 * Renders one row per registered tool with a Select for the 5 levels:
 *   no_access | read_only | draft_only | execute_with_approval | execute_autonomously
 *
 * REQUIRES_APPROVAL clamp: tools in the hard-floor set hide the
 * 'Execute autonomously' option from their Select — operators cannot grant a
 * level that the gate would clamp to 'approval' anyway. Mirrors
 * souts-agent-os-modal/hooks/approval.py REQUIRES_APPROVAL frozenset.
 *
 * testid contract:
 *   - tools-section
 *   - tool-permission-row-{tool_name}
 *   - tool-permission-select-{tool_name}
 *   - bulk-set-{integration_key}
 *   - save-tool-permissions-btn
 */
import { useState, useTransition } from 'react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { saveToolPermissions } from '../_actions';
import { REGISTRY } from '@/app/agentos/tools/_data/registry';
import { RequiredMcpServersSection } from './RequiredMcpServersSection';

// REQUIRES_APPROVAL frozenset mirror — must stay in lockstep with
// souts-agent-os-modal/hooks/approval.py REQUIRES_APPROVAL.
//
// Phase 6.1 / Plan 06.1-02: Slack writes sourced from fixture
//   (souts-agent-os-modal/tests/fixtures/mcp_tool_names_slack.json write_tool_names).
// Phase 8 / Plan 08-04: Fixed drift from prior Phase-7 placeholder names.
//   Drive: mcp__drive__write / mcp__drive__edit replaced with real fixture names.
//   Notion: mcp__notion__create_page etc. replaced with real kebab-case fixture names.
//   Calendar: mcp__google_calendar__create_event / update_event added (were missing).
//   Gmail: mcp__gmail__send / mcp__gmail__draft_send REMOVED (not in Python frozenset).
const REQUIRES_APPROVAL = new Set<string>([
  // Slack writes (Phase 6.1 fixture-derived from mcp_tool_names_slack.json)
  'mcp__slack__slack_send_message',
  'mcp__slack__slack_schedule_message',
  'mcp__slack__slack_create_canvas',
  'mcp__slack__slack_update_canvas',
  // Google Calendar write tools (Phase 7 / Plan 07-01)
  'mcp__google_calendar__create_event',
  'mcp__google_calendar__update_event',
  // Google Drive write tools (Phase 7 / Plan 07-03 — fixture mcp_tool_names_drive.json)
  'mcp__google_drive__create_file',
  'mcp__google_drive__update_file',
  'mcp__google_drive__move_file',
  'mcp__google_drive__share_file',
  'mcp__google_drive__trash_file',
  // Notion write tools (Phase 7 / Plan 07-04 — fixture mcp_tool_names_notion.json; kebab-case)
  'mcp__notion__notion-create-pages',
  'mcp__notion__notion-update-page',
  'mcp__notion__notion-move-pages',
  'mcp__notion__notion-duplicate-page',
  'mcp__notion__notion-create-database',
  'mcp__notion__notion-update-data-source',
  'mcp__notion__notion-create-view',
  'mcp__notion__notion-update-view',
  'mcp__notion__notion-create-comment',
  'mcp__notion__notion-append-blocks',
]);

const PERMISSION_LEVELS = [
  { value: 'no_access', label: 'No access' },
  { value: 'read_only', label: 'Read only' },
  { value: 'draft_only', label: 'Draft only' },
  { value: 'execute_with_approval', label: 'Execute with approval' },
  { value: 'execute_autonomously', label: 'Execute autonomously' },
];

interface PermissionRow {
  tool_name: string;
  level: string;
}

interface ToolPermissionsSectionProps {
  agentId: string;
  initialPerms: PermissionRow[];
  /** Phase 8 / Plan 08-04: current required_mcp_servers for the RequiredMcpServersSection */
  requiredMcpServers?: string[];
  /** Whether the current user can edit permissions (owner or admin). Defaults to true. */
  canEdit?: boolean;
}

export function ToolPermissionsSection({
  agentId,
  initialPerms,
  requiredMcpServers = [],
  canEdit = true,
}: ToolPermissionsSectionProps) {
  const initialMap = Object.fromEntries(
    initialPerms.map((p) => [p.tool_name, p.level]),
  );
  const [perms, setPerms] = useState<Record<string, string>>(initialMap);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const onLevelChange = (tool: string, level: string) => {
    setPerms((prev) => ({ ...prev, [tool]: level }));
  };

  const onBulkSet = (integrationKey: string, level: string) => {
    if (!level) return;
    const target = REGISTRY.find((i) => i.key === integrationKey);
    if (!target) return;
    const next = { ...perms };
    for (const t of target.tools) {
      next[t.name] = level;
    }
    setPerms(next);
  };

  const onSave = () => {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const rows = Object.entries(perms).map(([tool_name, level]) => ({
        tool_name,
        level,
      }));
      const res = await saveToolPermissions(agentId, rows);
      if (!res.ok) {
        setError(res.error);
      } else {
        setSavedAt(new Date().toISOString());
      }
    });
  };

  return (
    <section
      data-testid="tools-section"
      className="flex flex-col gap-md mt-xl"
    >
      <div>
        <h2 className="text-[16px] font-semibold text-text">Tool Permissions</h2>
        <p className="text-[13px] text-text-muted mt-1">
          Control which tools this agent can use. No access means the agent
          cannot call the tool at all.
        </p>
      </div>

      {/* Bulk set per integration */}
      <div className="flex flex-col gap-sm">
        {REGISTRY.filter((i) => !i.placeholder).map((integration) => (
          <div
            key={integration.key}
            className="flex items-center gap-sm flex-wrap"
          >
            <span className="text-[13px] text-text-muted">
              Set all {integration.label} tools to:
            </span>
            <Select
              onChange={(e) => onBulkSet(integration.key, e.target.value)}
              data-testid={`bulk-set-${integration.key}`}
              defaultValue=""
              className="max-w-[240px]"
            >
              <option value="" disabled>
                —
              </option>
              {PERMISSION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      <Table>
        <THead>
          <Tr>
            <Th>Tool</Th>
            <Th>Description</Th>
            <Th>Permission</Th>
          </Tr>
        </THead>
        <TBody>
          {REGISTRY.filter((i) => !i.placeholder).flatMap((integration) =>
            integration.tools.map((tool) => {
              const isReqApp = REQUIRES_APPROVAL.has(tool.name);
              const currentLevel = perms[tool.name] ?? 'no_access';
              return (
                <Tr
                  key={tool.name}
                  data-testid={`tool-permission-row-${tool.name}`}
                >
                  <Td className="font-mono text-[12px]">{tool.name}</Td>
                  <Td>{tool.description}</Td>
                  <Td>
                    <Select
                      value={currentLevel}
                      onChange={(e) =>
                        onLevelChange(tool.name, e.target.value)
                      }
                      data-testid={`tool-permission-select-${tool.name}`}
                    >
                      {PERMISSION_LEVELS.filter(
                        (l) =>
                          !(isReqApp && l.value === 'execute_autonomously'),
                      ).map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </Select>
                    {isReqApp && (
                      <span className="text-[11px] text-text-muted block mt-1">
                        Maximum: Execute with approval
                      </span>
                    )}
                  </Td>
                </Tr>
              );
            }),
          )}
        </TBody>
      </Table>

      {error && (
        <p
          data-testid="tools-error"
          className="text-destructive text-[13px]"
          role="alert"
        >
          {error}
        </p>
      )}
      {savedAt && !error && (
        <p className="text-success text-[13px]" data-testid="tools-saved">
          Saved {new Date(savedAt).toLocaleTimeString()}
        </p>
      )}

      <div>
        <Button
          intent="primary"
          size="sm"
          onClick={onSave}
          disabled={isPending}
          data-testid="save-tool-permissions-btn"
        >
          {isPending ? 'Saving…' : 'Save tool permissions'}
        </Button>
      </div>

      {/* Phase 8 / Plan 08-04: Required MCP Servers UI (closes Phase 7.1 backlog item #3) */}
      <RequiredMcpServersSection
        agentId={agentId}
        initial={requiredMcpServers}
        canEdit={canEdit}
      />
    </section>
  );
}
