import { requireAgentosRole } from '@/lib/supabase/agentos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { UploadDocumentForm } from './UploadDocumentForm';

export default async function VaultUploadPage() {
  await requireAgentosRole('/agentos/vault/upload');
  return (
    <div className="flex flex-col gap-lg" data-testid="vault-upload-page">
      <PageHeader title="Upload document" />
      <Card>
        <CardBody>
          <p className="text-[13px] text-text-muted mb-md">
            Upload PDF, MD, or TXT (max 50 MB). Uploaded documents are chunked
            and embedded for semantic retrieval on the next agent run that
            touches the same scope.
          </p>
          <UploadDocumentForm />
        </CardBody>
      </Card>
    </div>
  );
}
