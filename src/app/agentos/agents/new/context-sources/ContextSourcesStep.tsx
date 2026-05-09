'use client';
/**
 * Step 4: Context Sources
 *
 * Defines what knowledge the agent has access to when it runs:
 *   - project_id  → which project's vault scope is mounted at /workspace/vault/
 *                    at runtime (Phase 4 memory layer). Determines what files
 *                    the agent can read by default.
 *   - context_notes → freeform "what should this agent know about the
 *                    company / domain?" prepended to the system prompt at
 *                    runtime. Lives in config.context_notes.
 *
 * Both optional — agents can ship without project assignment (agent-only vault
 * scope) or without notes. Step is skip-able.
 *
 * Plan 08-02 / Phase 8 — rewritten 2026-05-09 to be actual context sources
 * (the original step was misnamed; it held sensitive_tools + denylist_globs
 * which now live on Step 5 Tools/Permissions).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/ui/FormField';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { patchDraft } from '../../_actions';

interface ContextSourcesStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draft: Record<string, any>;
  projects: Array<{ id: string; name: string }>;
}

export function ContextSourcesStep({ draft, projects }: ContextSourcesStepProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialNotes =
    (draft.config as Record<string, unknown> | null)?.context_notes ?? '';
  const initialProjectId = (draft.project_id as string | null) ?? '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const projectId = String(fd.get('project_id') || '').trim();
    const contextNotes = String(fd.get('context_notes') || '').trim();

    const result = await patchDraft(draft.id as string, {
      project_id: projectId === '' ? null : projectId,
      config: {
        ...((draft.config as Record<string, unknown>) || {}),
        context_notes: contextNotes,
      },
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
      className="flex flex-col gap-md max-w-[520px]"
      data-testid="wizard-step-4"
    >
      <FormField
        label="Project"
        htmlFor="project_id"
        hint="Determines which project's vault files the agent can read at runtime. Leave blank for agent-only scope."
      >
        <Select
          id="project_id"
          name="project_id"
          defaultValue={initialProjectId}
          data-testid="field-project_id"
          error={!!error}
        >
          <option value="">— No project (agent-only scope) —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Context notes"
        htmlFor="context_notes"
        hint="Optional. Freeform context the agent should always know about — e.g. company name, key people, voice/tone, recurring constraints. Prepended to the system prompt at runtime."
      >
        <Textarea
          id="context_notes"
          name="context_notes"
          defaultValue={String(initialNotes)}
          rows={6}
          placeholder="e.g. The company is VAPAI Studio. Always refer to clients as 'partners'. Never mention pricing in public posts unless explicitly approved. Slack workspace is vapaistudio.slack.com."
          data-testid="field-context_notes"
          error={!!error}
        />
      </FormField>

      {error && (
        <p className="text-destructive text-[13px]" data-testid="step-error">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-xs">
        <Link
          href={`/agentos/agents/new/instructions?draft=${draft.id}`}
          data-testid="wizard-back-btn"
          className="text-[13px] text-text-muted hover:text-text"
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
