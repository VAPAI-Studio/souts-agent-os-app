'use client';
/**
 * ConfigSummaryPane — read-only config summary with per-section "Edit" jump links.
 *
 * Renders 7 sections, one per wizard step 1-7. Each section has an "Edit" link
 * that navigates back to that step preserving the draft ID.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ConfigSummaryPane({ draft }: { draft: Record<string, any> }) {
  const editLink = (slug: string) => `/agentos/agents/new/${slug}?draft=${draft.id}`;
  return (
    <Card data-testid="config-summary-pane">
      <CardBody className="flex flex-col gap-0">
        <h3 className="font-medium text-base mb-3">Configuration</h3>

        <Section title="Basic Info" editHref={editLink('basic-info')} testid="summary-basic-info">
          <Field label="Name" value={draft.name} />
          <Field label="Department" value={draft.department} />
        </Section>

        <Section title="Role / Goals" editHref={editLink('role-goals')} testid="summary-role-goals">
          <Field label="Role summary" value={draft.config?.role_summary || '—'} />
        </Section>

        <Section title="Instructions" editHref={editLink('instructions')} testid="summary-instructions">
          <Field
            label="System prompt"
            value={
              draft.system_prompt && draft.system_prompt.length > 200
                ? draft.system_prompt.slice(0, 200) + '…'
                : draft.system_prompt || '—'
            }
          />
        </Section>

        <Section title="Context Sources" editHref={editLink('context-sources')} testid="summary-context-sources">
          <Field label="Sensitive tools" value={(draft.sensitive_tools ?? []).join(', ') || '—'} />
          <Field label="Denylist globs" value={(draft.denylist_globs ?? []).join(', ') || '—'} />
        </Section>

        <Section title="Tools / Permissions" editHref={editLink('tools-permissions')} testid="summary-tools-permissions">
          <Field label="Required MCP servers" value={(draft.required_mcp_servers ?? []).join(', ') || '—'} />
        </Section>

        <Section title="Autonomy" editHref={editLink('autonomy')} testid="summary-autonomy">
          <Field label="Level" value={draft.autonomy_level} />
          <Field label="Model" value={draft.model_tier} />
          <Field label="Max turns" value={draft.max_turns} />
          <Field label="Budget cap (USD)" value={`$${draft.budget_cap_usd}`} />
        </Section>

        <Section title="Schedule" editHref={editLink('schedule')} testid="summary-schedule">
          <Field label="Cron" value={draft.schedule_cron || '—'} />
          <Field label="Timezone" value={draft.schedule_timezone || '—'} />
        </Section>
      </CardBody>
    </Card>
  );
}

function Section({
  title,
  editHref,
  testid,
  children,
}: {
  title: string;
  editHref: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testid}
      className="border-t border-border pt-2 mt-2 first:border-t-0 first:mt-0 first:pt-0"
    >
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium">{title}</h4>
        <Link
          href={editHref}
          className="text-xs text-accent hover:underline"
          data-testid={`${testid}-edit-link`}
        >
          Edit
        </Link>
      </div>
      <div className="mt-1 text-xs text-muted-foreground space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground text-right">{String(value ?? '—')}</span>
    </div>
  );
}
