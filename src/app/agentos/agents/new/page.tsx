/**
 * Step 0: Template Gallery
 *
 * The entry point for the 8-step wizard. User selects a template (or blank)
 * to create a draft agent row, then is redirected to Step 1 (Basic Info).
 *
 * Plan 08-02 / Phase 8 — replaces the old single-page NewAgentForm.
 */
import { requireAdmin } from '@/lib/supabase/agentos';
import { PageHeader } from '@/components/ui/PageHeader';
import { TemplateGallery } from './_components/TemplateGallery';

// Static imports so tsc can verify the files exist and slugs are type-safe.
// These are also imported by _actions.ts for createDraftFromTemplate.
import cooTemplate from './templates/coo-daily-report.json';
import contentDrafterTemplate from './templates/content-drafter.json';
import taskSummarizerTemplate from './templates/task-summarizer.json';

// Suppress unused-variable warnings — imports are for tsc contract verification.
void cooTemplate;
void contentDrafterTemplate;
void taskSummarizerTemplate;

export default async function NewAgentPage() {
  await requireAdmin('/agentos/agents/new');
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Create new agent"
        meta={<span className="text-sm text-muted-foreground">Choose a starting point</span>}
      />
      <TemplateGallery />
    </section>
  );
}
