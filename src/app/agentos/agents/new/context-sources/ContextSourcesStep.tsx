'use client';
/**
 * Step 4: Context Sources — sensitive_tools and denylist_globs arrays.
 * Each is edited as one item per line in a textarea.
 * Plan 08-02 / Phase 8
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { patchDraft } from '../../_actions';

interface ContextSourcesStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
}

function arrayToLines(arr: unknown): string {
  if (!Array.isArray(arr)) return '';
  return arr.join('\n');
}

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ContextSourcesStep({ draft }: ContextSourcesStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const sensitiveTools = linesToArray(String(fd.get('sensitive_tools') || ''));
    const denylistGlobs = linesToArray(String(fd.get('denylist_globs') || ''));

    const result = await patchDraft(draft.id as string, {
      sensitive_tools: sensitiveTools,
      denylist_globs: denylistGlobs,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/agentos/agents/new/tools-permissions?draft=${draft.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-[520px]"
    >
      <FormField
        label="Sensitive tools"
        htmlFor="sensitive_tools"
        hint="Tool names (one per line) that require extra caution. These are logged with additional detail."
      >
        <Textarea
          id="sensitive_tools"
          name="sensitive_tools"
          defaultValue={arrayToLines(draft.sensitive_tools)}
          rows={4}
          placeholder="e.g. Bash&#10;Python&#10;mcp__slack__slack_send_message"
          data-testid="field-sensitive_tools"
          error={!!error}
        />
      </FormField>

      <FormField
        label="Denylist globs"
        htmlFor="denylist_globs"
        hint="File path patterns (one per line) the agent must never read or write."
      >
        <Textarea
          id="denylist_globs"
          name="denylist_globs"
          defaultValue={arrayToLines(draft.denylist_globs)}
          rows={4}
          placeholder="e.g. **/.env&#10;**/secrets/**&#10;**/*.key"
          data-testid="field-denylist_globs"
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
          href={`/agentos/agents/new/instructions?draft=${draft.id}`}
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
