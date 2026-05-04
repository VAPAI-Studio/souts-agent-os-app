'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { uploadVaultDocument } from '../_actions';

type Scope = 'company' | 'project' | 'agent';

export function UploadDocumentForm() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('company');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await uploadVaultDocument(formData);
      if (!res.ok) setError(res.error);
      else router.push(`/agentos/vault/${res.data.id}`);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-md">
      <FormField label="File" htmlFor="file" hint="PDF, MD, or TXT — max 50 MB">
        <input
          type="file"
          id="file"
          name="file"
          accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
          required
          data-testid="file-input"
          className="text-[13px]"
        />
      </FormField>
      <FormField label="Scope" htmlFor="scope">
        <Select
          id="scope"
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as Scope)}
          data-testid="scope-select"
        >
          <option value="company">Company</option>
          <option value="project">Project</option>
          <option value="agent">Agent</option>
        </Select>
      </FormField>
      {scope === 'project' && (
        <FormField label="Project ID" htmlFor="project_id">
          <Input id="project_id" name="project_id" required />
        </FormField>
      )}
      {scope === 'agent' && (
        <FormField label="Agent ID" htmlFor="agent_id">
          <Input id="agent_id" name="agent_id" required />
        </FormField>
      )}
      <FormField label="Sensitivity" htmlFor="is_sensitive">
        <label className="flex items-center gap-sm text-[13px]">
          <input
            type="checkbox"
            id="is_sensitive"
            name="is_sensitive"
            data-testid="sensitive-checkbox"
          />
          Mark as sensitive
        </label>
      </FormField>

      {error && (
        <span data-testid="action-error" className="text-destructive text-[13px]">
          Action failed: {error}. Try again or contact your admin.
        </span>
      )}

      <div className="flex gap-sm">
        <Button
          type="submit"
          intent="primary"
          disabled={isPending}
          data-testid="upload-btn"
        >
          {isPending ? '...' : 'Upload'}
        </Button>
      </div>
    </form>
  );
}
