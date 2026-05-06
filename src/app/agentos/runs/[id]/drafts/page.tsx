/**
 * Phase 6 / Plan 06-02b — Drafts viewer page.
 *
 * Server Component. Reads vault/drafts/{run_id}/_meta.json + each draft file
 * from Supabase Storage (service-role bypass — admin-only route gate enforced).
 * Renders one DraftCard per draft. Empty state when no drafts directory exists.
 *
 * UI-SPEC §Surface 3 lines 288-326 + Copywriting Contract lines 421-431.
 */
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/supabase/agentos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { DraftCard, type DraftRecord, type DraftStatus } from './_components/DraftCard';

interface DraftMetaEntry {
  tool_name: string;
  seq: number;
  created_at: string;
  discarded_at: string | null;
  sent_at: string | null;
  send_run_id: string | null;
}

interface DraftSidecar {
  drafts: Record<string, DraftMetaEntry>;
}

interface DraftFilePayload {
  draft_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  created_at: string;
  agent_id: string;
  run_id: string;
  seq: number;
}

function _serviceRoleStorageClient() {
  // Inline service-role client — Phase 4 SUMMARY noted createServiceRoleClient
  // is not exported from lib/supabase/server.ts. Same pattern used in
  // _actions.ts of this plan + Plan 04-05's vault Server Actions.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // service-role client never sets cookies
        },
      },
    },
  );
}

function _safeTool(toolName: string): string {
  return toolName.replace('mcp__', '').replace(/__/g, '_');
}

function _statusFromMeta(entry: DraftMetaEntry): DraftStatus {
  if (entry.discarded_at) return 'discarded';
  if (entry.sent_at) return 'sent';
  return 'pending';
}

async function _loadSidecar(
  supabase: ReturnType<typeof _serviceRoleStorageClient>,
  runId: string,
): Promise<DraftSidecar | null> {
  try {
    const { data: blob, error } = await supabase.storage
      .from('vault')
      .download(`drafts/${runId}/_meta.json`);
    if (error || !blob) return null;
    const text = await blob.text();
    return JSON.parse(text) as DraftSidecar;
  } catch {
    return null;
  }
}

async function _loadDraftFile(
  supabase: ReturnType<typeof _serviceRoleStorageClient>,
  runId: string,
  seq: number,
  toolName: string,
): Promise<DraftFilePayload | null> {
  const safe = _safeTool(toolName);
  const path = `drafts/${runId}/${String(seq).padStart(4, '0')}_${safe}.json`;
  try {
    const { data: blob, error } = await supabase.storage
      .from('vault')
      .download(path);
    if (error || !blob) return null;
    const text = await blob.text();
    return JSON.parse(text) as DraftFilePayload;
  } catch {
    return null;
  }
}

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: runId } = await params;
  await requireAdmin(`/agentos/runs/${runId}/drafts`);

  const supabase = _serviceRoleStorageClient();
  const sidecar = await _loadSidecar(supabase, runId);
  const runIdShort = runId.slice(0, 8);

  const backLink = (
    <Link
      href={`/agentos/runs/${runId}`}
      className="text-accent text-[13px] hover:underline"
    >
      ← Back to run
    </Link>
  );

  if (!sidecar || !sidecar.drafts || Object.keys(sidecar.drafts).length === 0) {
    return (
      <section
        className="flex flex-col gap-lg"
        data-testid="drafts-page"
      >
        <PageHeader
          title={
            <>
              Drafts for run{' '}
              <span className="font-mono text-text-muted">{runIdShort}</span>
            </>
          }
          actions={backLink}
        />
        <Card data-testid="drafts-empty-state">
          <CardBody>
            <h2 className="text-[14px] font-semibold mb-sm">
              No drafts for this run
            </h2>
            <p className="text-[13px] text-text-muted">
              This run did not produce any draft actions. Drafts are created
              when a tool has permission level &lsquo;draft only&rsquo;.
            </p>
          </CardBody>
        </Card>
      </section>
    );
  }

  // Load each draft file in parallel; skip any that fail to load.
  const entries = Object.entries(sidecar.drafts);
  const drafts: DraftRecord[] = [];
  await Promise.all(
    entries.map(async ([draftId, meta]) => {
      const draftFile = await _loadDraftFile(
        supabase,
        runId,
        meta.seq,
        meta.tool_name,
      );
      if (!draftFile) return;
      drafts.push({
        draft_id: draftId,
        tool_name: draftFile.tool_name,
        tool_input: draftFile.tool_input,
        created_at: draftFile.created_at,
        seq: draftFile.seq,
        status: _statusFromMeta(meta),
        send_run_id: meta.send_run_id ?? null,
      });
    }),
  );

  // Sort by seq ascending so the list mirrors agent execution order.
  drafts.sort((a, b) => a.seq - b.seq);

  return (
    <section
      className="flex flex-col gap-lg"
      data-testid="drafts-page"
    >
      <PageHeader
        title={
          <>
            Drafts for run{' '}
            <span className="font-mono text-text-muted">{runIdShort}</span>
          </>
        }
        actions={backLink}
      />
      <div className="flex flex-col gap-md">
        {drafts.map((d) => (
          <DraftCard key={d.draft_id} draft={d} runId={runId} />
        ))}
      </div>
    </section>
  );
}
