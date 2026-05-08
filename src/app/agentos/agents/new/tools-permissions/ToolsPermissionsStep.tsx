'use client';
/**
 * Step 5: Tools / Permissions
 *
 * Wraps the existing ToolPermissionsSection from the Edit page so the same
 * tool-permission UI surfaces during wizard creation. The draft agent already
 * has an ID and seeded agent_tool_permissions rows (seeded by createAgent or
 * createDraftFromTemplate). Also shows a required_mcp_servers toggle row via
 * RequiredMcpServersSection (mounted transitively by ToolPermissionsSection as
 * of Plan 08-04).
 *
 * Plan 08-02 / Phase 8 — updated Plan 08-04 to add auto-derive info banner +
 * required_mcp_servers props + wizard-step-5 testid.
 */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ToolPermissionsSection } from '../../[id]/edit/_components/ToolPermissionsSection';

interface PermissionRow {
  tool_name: string;
  level: string;
}

interface ToolsPermissionsStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
  initialPerms: PermissionRow[];
}

export function ToolsPermissionsStep({ draft, initialPerms }: ToolsPermissionsStepProps) {
  const router = useRouter();

  function handleNext() {
    router.push(`/agentos/agents/new/autonomy?draft=${draft.id}`);
  }

  return (
    <div data-testid="wizard-step-5" className="flex flex-col gap-6">
      {/* Phase 8 / Plan 08-04: auto-derive info banner */}
      <div
        data-testid="auto-derive-info"
        className="text-xs text-muted-foreground border border-border p-2 rounded-md"
      >
        <strong>Auto-managed:</strong> Granting any non-&ldquo;No access&rdquo; permission for a
        tool from an MCP server automatically adds that server to &ldquo;Required MCP Servers&rdquo;
        below. You can override manually.
      </div>

      {/* ToolPermissionsSection now mounts RequiredMcpServersSection internally (Plan 08-04) */}
      <ToolPermissionsSection
        agentId={draft.id as string}
        initialPerms={initialPerms}
        requiredMcpServers={(draft.required_mcp_servers as string[] | null) ?? []}
        canEdit
      />

      <div className="flex items-center gap-3 pt-2 max-w-[520px]">
        <Link
          href={`/agentos/agents/new/context-sources?draft=${draft.id}`}
          data-testid="wizard-back-btn"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </Link>
        <Button
          type="button"
          intent="primary"
          size="md"
          onClick={handleNext}
          data-testid="wizard-next-btn"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
