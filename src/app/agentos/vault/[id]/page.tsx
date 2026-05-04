import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAgentosRole } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { VaultFileEditor } from './VaultFileEditor';
import { VaultFileActions } from './VaultFileActions';

export default async function VaultFileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAgentosRole(`/agentos/vault/${id}`);
  const supabase = await createClient();

  const { data: file, error } = await supabase
    .schema('agentos')
    .from('vault_files')
    .select(
      'id, path, name, scope, project_id, agent_id, storage_object_id, is_sensitive, size_bytes, content_sha256, updated_at',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !file) notFound();

  // Download content via authenticated client (storage RLS gate is
  // vault_objects_select_authenticated from Plan 04-01).
  let content = '';
  try {
    if (file.storage_object_id) {
      const { data: blob } = await supabase.storage
        .from('vault')
        .download(file.storage_object_id);
      if (blob) content = await blob.text();
    }
  } catch {
    /* empty content acceptable */
  }

  return (
    <div className="flex flex-col gap-lg" data-testid="vault-detail-page">
      <PageHeader
        title={
          <span className="flex items-center gap-sm">
            <span data-testid="vault-name">{file.name}</span>
            {file.is_sensitive && <Badge tone="warning">sensitive</Badge>}
          </span>
        }
        actions={
          <div className="flex gap-sm">
            <Button asChild intent="ghost" size="sm" data-testid="history-link">
              <Link href={`/agentos/vault/${id}/history`}>Version history</Link>
            </Button>
            <VaultFileActions id={id} />
          </div>
        }
      />

      <Card>
        <CardBody>
          <dl className="grid grid-cols-2 gap-sm text-[13px]">
            <dt className="text-text-muted">Path</dt>
            <dd className="font-mono text-[12px]">{file.path}</dd>
            <dt className="text-text-muted">Scope</dt>
            <dd>{file.scope}</dd>
            <dt className="text-text-muted">SHA-256</dt>
            <dd className="font-mono text-[12px] truncate">
              {file.content_sha256}
            </dd>
            <dt className="text-text-muted">Updated</dt>
            <dd className="font-mono text-[12px]">
              {file.updated_at?.slice(0, 19)}
            </dd>
          </dl>
        </CardBody>
      </Card>

      <VaultFileEditor
        id={id}
        initialContent={content}
        initialSensitive={file.is_sensitive}
      />
    </div>
  );
}
