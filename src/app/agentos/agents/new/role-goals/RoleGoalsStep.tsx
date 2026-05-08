'use client';
/**
 * Step 2: Role / Goals — stores role_summary in config.role_summary
 * Plan 08-02 / Phase 8
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { patchDraft } from '../../_actions';

interface RoleGoalsStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}

export function RoleGoalsStep({ draft }: RoleGoalsStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const existingRole = ((draft.config as Record<string, unknown> | null)?.role_summary as string) || '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const roleSummary = String(fd.get('role_summary') || '');

    if (roleSummary.length > 500) {
      setError('Role summary must be 500 characters or fewer');
      setSubmitting(false);
      return;
    }

    const existingConfig = (draft.config as Record<string, unknown>) || {};
    const result = await patchDraft(draft.id as string, {
      config: { ...existingConfig, role_summary: roleSummary },
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/instructions?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-[520px]"
    >
      <FormField
        label="Role and goals"
        htmlFor="role_summary"
        hint="Describe what this agent is for and what it should accomplish (0-500 chars). Optional but recommended."
      >
        <Textarea
          id="role_summary"
          name="role_summary"
          defaultValue={existingRole}
          rows={4}
          maxLength={500}
          placeholder="e.g. This agent monitors our Slack channels daily and synthesizes a management briefing..."
          data-testid="field-role_summary"
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
          href={`/agentos/agents/new/basic-info?draft=${draft.id}`}
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
