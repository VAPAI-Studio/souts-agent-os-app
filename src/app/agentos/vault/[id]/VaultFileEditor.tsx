'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { updateVaultFile } from '../_actions';

// Pitfall 8: @uiw/react-md-editor uses window — must be loaded with ssr:false.
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface Props {
  id: string;
  initialContent: string;
  initialSensitive: boolean;
}

export function VaultFileEditor({ id, initialContent, initialSensitive }: Props) {
  const [content, setContent] = useState<string>(initialContent);
  const [isSensitive, setIsSensitive] = useState<boolean>(initialSensitive);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateVaultFile(id, content, isSensitive);
      if (!res.ok) setError(res.error);
      else setSavedAt(new Date().toISOString());
    });
  }

  return (
    <Card>
      <CardBody>
        <div data-color-mode="light" data-testid="md-editor-wrap">
          <MDEditor
            value={content}
            onChange={(v) => setContent(v ?? '')}
            height={500}
          />
        </div>

        <label className="flex items-center gap-sm text-[13px] mt-md">
          <input
            type="checkbox"
            checked={isSensitive}
            onChange={(e) => setIsSensitive(e.target.checked)}
            data-testid="sensitive-toggle"
          />
          Mark as sensitive
        </label>

        {error && (
          <span
            data-testid="action-error"
            className="text-destructive text-[13px] block mt-sm"
          >
            Action failed: {error}. Try again or contact your admin.
          </span>
        )}
        {savedAt && (
          <span
            data-testid="save-confirm"
            className="text-[12px] text-text-muted block mt-sm"
          >
            Saved at {savedAt.slice(11, 19)}
          </span>
        )}

        <div className="flex gap-sm mt-md">
          <Button
            intent="primary"
            onClick={onSave}
            disabled={isPending}
            data-testid="save-btn"
          >
            {isPending ? '...' : 'Save changes'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
