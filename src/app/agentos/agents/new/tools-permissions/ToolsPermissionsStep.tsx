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
 *
 * 2026-05-09: added Advanced safety collapsible (sensitive_tools +
 * denylist_globs) — moved here from the misnamed Step 4 Context Sources.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { ToolPermissionsSection } from '../../[id]/edit/_components/ToolPermissionsSection';
import { patchDraft } from '../../_actions';

interface PermissionRow {
  tool_name: string;
  level: string;
}

interface ToolsPermissionsStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
  initialPerms: PermissionRow[];
}

function arrayToLines(arr: unknown): string {
  if (!Array.isArray(arr)) return '';
  return arr.join('\n');
}

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ToolsPermissionsStep({ draft, initialPerms }: ToolsPermissionsStepProps) {
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read existing values from draft.config (where they're persisted).
  const config = (draft.config as Record<string, unknown> | null) ?? {};
  const initialSensitive = arrayToLines(config.sensitive_tools);
  const initialDenylist = arrayToLines(config.denylist_globs);

  async function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const sensitive = linesToArray(String(fd.get('sensitive_tools') || ''));
    const denylist = linesToArray(String(fd.get('denylist_globs') || ''));

    const result = await patchDraft(draft.id as string, {
      sensitive_tools: sensitive,
      denylist_globs: denylist,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/autonomy?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleNext}
      data-testid="wizard-step-5"
      className="flex flex-col gap-lg"
    >
      {/* Phase 8 / Plan 08-04: auto-derive info banner */}
      <div
        data-testid="auto-derive-info"
        className="text-[12px] text-text-muted border border-border p-2 rounded-md"
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

      {/* Advanced safety (collapsible) — sensitive_tools + denylist_globs */}
      <div className="flex flex-col gap-sm max-w-[520px]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          data-testid="advanced-safety-toggle"
          className="text-[13px] text-text-muted hover:text-text self-start cursor-pointer"
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? '▾' : '▸'} Advanced safety
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-md pl-md border-l border-border">
            <FormField
              label="Sensitive tools"
              htmlFor="sensitive_tools"
              hint="Tool names (one per line) that require extra caution. These are logged with additional detail."
            >
              <Textarea
                id="sensitive_tools"
                name="sensitive_tools"
                defaultValue={initialSensitive}
                rows={3}
                placeholder="e.g. Bash&#10;Python&#10;mcp__slack__slack_send_message"
                data-testid="field-sensitive_tools"
                error={!!error}
              />
            </FormField>

            <FormField
              label="Denylist globs"
              htmlFor="denylist_globs"
              hint="File path patterns (one per line) the agent must never read or write."
            >
              <Textarea
                id="denylist_globs"
                name="denylist_globs"
                defaultValue={initialDenylist}
                rows={3}
                placeholder="e.g. **/.env&#10;**/secrets/**&#10;**/*.key"
                data-testid="field-denylist_globs"
                error={!!error}
              />
            </FormField>
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive text-[13px]" data-testid="step-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-xs max-w-[520px]">
        <Link
          href={`/agentos/agents/new/context-sources?draft=${draft.id}`}
          data-testid="wizard-back-btn"
          className="text-[13px] text-text-muted hover:text-text"
        >
          Back
        </Link>
        <Button
          type="submit"
          intent="primary"
          size="md"
          disabled={saving}
          data-testid="wizard-next-btn"
        >
          {saving ? 'Saving...' : 'Next'}
        </Button>
      </div>
    </form>
  );
}
