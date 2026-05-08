'use client';
/**
 * Step 3: Instructions — system_prompt (50-10000 chars)
 * Plan 08-02 / Phase 8
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { patchDraft } from '../../_actions';

interface InstructionsStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}

export function InstructionsStep({ draft }: InstructionsStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const systemPrompt = String(fd.get('system_prompt') || '').trim();

    if (!systemPrompt) {
      setError('System prompt is required');
      setSubmitting(false);
      return;
    }
    if (systemPrompt.length < 50) {
      setError('System prompt must be at least 50 characters');
      setSubmitting(false);
      return;
    }
    if (systemPrompt.length > 10000) {
      setError('System prompt must be 10,000 characters or fewer');
      setSubmitting(false);
      return;
    }

    const result = await patchDraft(draft.id as string, { system_prompt: systemPrompt });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/context-sources?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-[640px]"
    >
      <FormField
        label="System prompt"
        htmlFor="system_prompt"
        hint="The core instructions the agent follows on every run (50–10,000 chars)."
      >
        <Textarea
          id="system_prompt"
          name="system_prompt"
          defaultValue={(draft.system_prompt as string) || ''}
          rows={12}
          maxLength={10000}
          placeholder="You are a senior operations analyst. Your job is to..."
          required
          data-testid="field-system_prompt"
          error={!!error}
        />
      </FormField>

      {error && (
        <p className="text-destructive text-[13px]" data-testid="step-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Link
          href={`/agentos/agents/new/role-goals?draft=${draft.id}`}
          data-testid="wizard-back-btn"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </Link>
        <Button
          type="submit"
          intent="primary"
          size="md"
          disabled={submitting}
          data-testid="wizard-next-btn"
        >
          {submitting ? 'Saving...' : 'Next'}
        </Button>
      </div>
    </form>
  );
}
