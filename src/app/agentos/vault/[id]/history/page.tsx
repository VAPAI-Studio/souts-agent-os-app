import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

export default async function VaultHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgentosRole(`/agentos/vault/${id}/history`);
  const supabase = await createClient();

  const { data: file } = await supabase
    .schema('agentos')
    .from('vault_files')
    .select('id, name, path')
    .eq('id', id)
    .single();
  if (!file) notFound();

  const { data: history, error } = await supabase
    .schema('agentos')
    .from('vault_history')
    .select(
      'id, size_bytes, content_sha256, edited_by, edited_by_agent_id, created_at',
    )
    .eq('vault_file_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-lg" data-testid="vault-history-page">
      <PageHeader
        title={`Version history: ${file.name}`}
        actions={
          <Button asChild intent="ghost" size="sm">
            <Link href={`/agentos/vault/${id}`}>Back to file</Link>
          </Button>
        }
      />
      {error && (
        <Card>
          <CardBody>
            <span
              data-testid="history-load-error"
              className="text-destructive text-[13px]"
            >
              Failed to load history: {error.message}
            </span>
          </CardBody>
        </Card>
      )}
      {!error && (!history || history.length === 0) && (
        <Card>
          <CardBody>
            <p className="text-[13px] text-text-muted">
              No version history yet for this file.
            </p>
          </CardBody>
        </Card>
      )}
      {history && history.length > 0 && (
        <Card>
          <Table data-testid="vault-history-table">
            <THead>
              <Tr>
                <Th>When</Th>
                <Th>Size</Th>
                <Th>SHA-256</Th>
                <Th>Edited by</Th>
              </Tr>
            </THead>
            <TBody>
              {history.map((h) => (
                <Tr key={h.id} data-testid={`history-row-${h.id}`}>
                  <Td>
                    <span className="font-mono text-[12px]">
                      {h.created_at?.slice(0, 19)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">
                      {h.size_bytes ?? 0}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] truncate">
                      {h.content_sha256 ?? ''}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">
                      {h.edited_by_agent_id
                        ? `agent:${h.edited_by_agent_id.slice(0, 8)}`
                        : (h.edited_by?.slice(0, 8) ?? '—')}
                    </span>
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
