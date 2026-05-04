'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { softDeleteVaultFile } from '../_actions';

export function VaultFileActions({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm('Delete this vault file? Version history is preserved.')) return;
    startTransition(async () => {
      const res = await softDeleteVaultFile(id);
      if (!res.ok) alert(`Action failed: ${res.error}. Try again or contact your admin.`);
      else router.push('/agentos/vault');
    });
  }

  return (
    <Button
      intent="destructive"
      size="sm"
      onClick={onDelete}
      disabled={isPending}
      data-testid="delete-vault-btn"
    >
      {isPending ? '...' : 'Delete'}
    </Button>
  );
}
