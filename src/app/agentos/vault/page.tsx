import Link from 'next/link';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

type Scope = 'company' | 'project' | 'agent';

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: Scope }>;
}) {
  await requireAgentosRole('/agentos/vault');
  const params = await searchParams;
  const scope: Scope = (params?.scope as Scope) ?? 'company';

  const supabase = await createClient();
  const { data: files, error } = await supabase
    .schema('agentos')
    .from('vault_files')
    .select('id, path, name, scope, project_id, agent_id, size_bytes, is_sensitive, updated_at')
    .eq('scope', scope)
    .is('deleted_at', null)
    .order('path', { ascending: true });

  return (
    <div className="flex flex-col gap-lg" data-testid="vault-page">
      <PageHeader
        title="Vault"
        actions={
          <div className="flex gap-sm">
            <Button asChild intent="secondary" size="sm" data-testid="upload-document-link">
              <Link href="/agentos/vault/upload">Upload document</Link>
            </Button>
            <Button asChild intent="primary" size="sm" data-testid="new-vault-file-link">
              <Link href="/agentos/vault/new">New file</Link>
            </Button>
          </div>
        }
      />

      {/* Scope tabs */}
      <nav aria-label="Vault scope" className="flex gap-sm border-b border-border">
        {(['company', 'project', 'agent'] as Scope[]).map((s) => (
          <Link
            key={s}
            href={`/agentos/vault?scope=${s}`}
            data-testid={`scope-tab-${s}`}
            className={
              s === scope
                ? 'px-md py-sm border-b-2 border-accent text-accent text-[13px]'
                : 'px-md py-sm border-b-2 border-transparent text-text-muted hover:text-text text-[13px]'
            }
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>

      {error && (
        <Card>
          <CardBody>
            <span data-testid="vault-load-error" className="text-destructive text-[13px]">
              Failed to load vault: {error.message}
            </span>
          </CardBody>
        </Card>
      )}

      {!error && (!files || files.length === 0) && (
        <Card>
          <CardBody>
            <h2 className="text-[16px] font-semibold mb-xs">No files in {scope} scope yet</h2>
            <p className="text-[13px] text-text-muted">
              Create a Markdown file or upload a document to get started.
            </p>
          </CardBody>
        </Card>
      )}

      {files && files.length > 0 && (
        <Card>
          <Table data-testid="vault-table">
            <THead>
              <Tr>
                <Th>Path</Th>
                <Th>Name</Th>
                <Th>Sensitive</Th>
                <Th>Size</Th>
                <Th>Updated</Th>
                <Th>Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {files.map((f) => (
                <Tr key={f.id} data-testid={`vault-row-${f.id}`}>
                  <Td>
                    <span className="font-mono text-[12px]">{f.path}</span>
                  </Td>
                  <Td>{f.name}</Td>
                  <Td>
                    {f.is_sensitive ? (
                      <Badge tone="warning" data-testid={`sensitive-badge-${f.id}`}>
                        sensitive
                      </Badge>
                    ) : (
                      <span className="text-text-muted text-[12px]">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">{f.size_bytes ?? 0}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[12px]">
                      {f.updated_at?.slice(0, 19) ?? ''}
                    </span>
                  </Td>
                  <Td>
                    <Button
                      asChild
                      intent="ghost"
                      size="sm"
                      data-testid={`open-vault-${f.id}`}
                    >
                      <Link href={`/agentos/vault/${f.id}`}>Open</Link>
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
