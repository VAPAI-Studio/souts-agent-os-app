import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

/**
 * Phase 16 / Plan 16-08 (VAULT-03): daily-report detail view.
 *
 * Renders the markdown of a single COO daily report stored in the vault at
 * `/company/daily-reports/{date}.md`. Admin-gated (require_role admin). Reads the
 * vault_files row + downloads the object from Storage via the authenticated RLS
 * client (same pattern as /agentos/vault/[id]), NOT the orchestrator endpoint.
 *
 * Public URL shape: https://agent-os.vapai.studio/agentos/reports/daily/{date}
 * (this is the URL the COO chat reply links to — VAULT-04).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_REPORTS_PREFIX = '/company/daily-reports/';

export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  await requireAdmin(`/agentos/reports/daily/${date}`);

  // Defense: reject non-date params (traversal / garbage) before any storage lookup.
  const validDate = DATE_RE.test(date);

  const supabase = await createClient();

  let markdown = '';
  let found = false;

  if (validDate) {
    const reportPath = `${DAILY_REPORTS_PREFIX}${date}.md`;
    const { data: file } = await supabase
      .schema('agentos')
      .from('vault_files')
      .select('storage_object_id, updated_at')
      .eq('path', reportPath)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (file?.storage_object_id) {
      try {
        const { data: blob } = await supabase.storage
          .from('vault')
          .download(file.storage_object_id);
        if (blob) {
          markdown = await blob.text();
          found = markdown.length > 0;
        }
      } catch {
        /* treated as not-found below */
      }
    }
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="daily-report-detail-page">
      <PageHeader
        title={
          <span className="font-mono" data-testid="daily-report-date">
            {validDate ? date : 'Invalid date'}
          </span>
        }
        actions={
          <Button asChild intent="ghost" size="sm" data-testid="back-to-reports-link">
            <Link href="/agentos/reports/daily">All reports</Link>
          </Button>
        }
      />

      {!validDate && (
        <Card>
          <CardBody>
            <span data-testid="daily-report-invalid" className="text-destructive text-[13px]">
              Invalid report date. Expected format YYYY-MM-DD.
            </span>
          </CardBody>
        </Card>
      )}

      {validDate && !found && (
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold mb-xs" data-testid="daily-report-notfound">
              No report for {date}
            </h2>
            <p className="text-[13px] text-text-muted">
              There is no daily report stored for this date.
            </p>
          </CardBody>
        </Card>
      )}

      {validDate && found && (
        <Card>
          <CardBody>
            <article
              data-testid="daily-report-markdown"
              className="flex flex-col gap-sm text-[14px] leading-relaxed"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-[20px] font-semibold mt-md mb-xs">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-[16px] font-semibold mt-md mb-xs">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[14px] font-semibold mt-sm mb-xs">{children}</h3>
                  ),
                  p: ({ children }) => <p className="mb-xs">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="list-disc pl-lg flex flex-col gap-[2px] mb-xs">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-lg flex flex-col gap-[2px] mb-xs">{children}</ol>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} className="text-accent underline" rel="noreferrer">
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-[12px] bg-surface-muted px-[4px] py-[1px] rounded">
                      {children}
                    </code>
                  ),
                  table: ({ children }) => (
                    <table className="border-collapse text-[13px] my-sm">{children}</table>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-sm py-[2px] text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-sm py-[2px]">{children}</td>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </article>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
