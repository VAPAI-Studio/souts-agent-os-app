import Link from 'next/link';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

/**
 * Phase 16 / Plan 16-08 (VAULT-03): daily-report list view.
 *
 * Reverse-chronological list of all COO daily reports stored in the vault under
 * `/company/daily-reports/{YYYY-MM-DD}.md`. Admin-gated (require_role admin) — anon
 * redirects to /login, non-admin redirects to /agentos/no-access. Reads vault_files
 * directly via the authenticated RLS client (same pattern as /agentos/vault), NOT
 * through the orchestrator HTTP endpoint. No pagination — v1.2 corpus is ~30 entries.
 */

const DAILY_REPORTS_PREFIX = '/company/daily-reports/';
// Canonical daily report file name: YYYY-MM-DD.md (excludes coo-briefing-*.md etc).
const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function DailyReportsListPage() {
  await requireAdmin('/agentos/reports/daily');
  const supabase = await createClient();

  const { data: files, error } = await supabase
    .schema('agentos')
    .from('vault_files')
    .select('id, path, name, size_bytes, updated_at')
    .like('path', `${DAILY_REPORTS_PREFIX}%`)
    .is('deleted_at', null)
    .order('path', { ascending: false });

  // Keep only canonical YYYY-MM-DD.md reports, derive the date, sort newest-first,
  // and de-dupe by date (a date may have more than one vault row across migrations).
  const seen = new Set<string>();
  const reports = (files ?? [])
    .map((f) => {
      const m = DATE_FILE_RE.exec(f.name ?? '');
      return m ? { date: m[1], size_bytes: f.size_bytes ?? 0 } : null;
    })
    .filter((r): r is { date: string; size_bytes: number } => r !== null)
    .filter((r) => {
      if (seen.has(r.date)) return false;
      seen.add(r.date);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-lg" data-testid="daily-reports-page">
      <PageHeader title="Daily reports" />

      {error && (
        <Card>
          <CardBody>
            <span data-testid="daily-reports-load-error" className="text-destructive text-[13px]">
              Failed to load daily reports: {error.message}
            </span>
          </CardBody>
        </Card>
      )}

      {!error && reports.length === 0 && (
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold mb-xs">No reports yet</h2>
            <p className="text-[13px] text-text-muted">
              COO daily reports will appear here once generated.
            </p>
          </CardBody>
        </Card>
      )}

      {reports.length > 0 && (
        <Card>
          <Table data-testid="daily-reports-table">
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Size</Th>
                <Th>Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {reports.map((r) => (
                <Tr key={r.date} data-testid={`daily-report-row-${r.date}`}>
                  <Td>
                    <span className="font-mono text-[13px]">{r.date}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">{formatSize(r.size_bytes)}</span>
                  </Td>
                  <Td>
                    <Button
                      asChild
                      intent="ghost"
                      size="sm"
                      data-testid={`open-daily-report-${r.date}`}
                    >
                      <Link href={`/agentos/reports/daily/${r.date}`}>Open</Link>
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
