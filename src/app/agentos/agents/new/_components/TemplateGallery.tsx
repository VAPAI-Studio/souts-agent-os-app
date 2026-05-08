'use client';
/**
 * TemplateGallery — Step 0 of the wizard.
 *
 * Renders 4 cards: "Start from blank" + 3 template cards.
 * Each card submits a small form calling the appropriate Server Action and
 * then redirects to /agentos/agents/new/basic-info?draft=<id>.
 *
 * Plan 08-02 / Phase 8
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createDraft, createDraftFromTemplate } from '../../_actions';

interface TemplateCardData {
  slug: string;
  name: string;
  description: string;
  department?: string;
}

const TEMPLATE_CARDS: TemplateCardData[] = [
  {
    slug: 'blank',
    name: 'Start from blank',
    description: 'Build your agent step by step with no pre-filled defaults.',
  },
  {
    slug: 'coo-daily-report',
    name: 'COO Daily Report',
    description: 'Reads Slack channels and Calendar, writes a structured daily ops report.',
    department: 'COO',
  },
  {
    slug: 'content-drafter',
    name: 'Content Drafter',
    description: 'Reads briefs from Google Drive and drafts marketing content for review.',
    department: 'Marketing',
  },
  {
    slug: 'task-summarizer',
    name: 'Task Summarizer',
    description: 'Queries Notion databases and summarizes weekly task progress.',
    department: 'Project',
  },
];

export function TemplateGallery() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(slug: string) {
    setLoading(slug);
    setError(null);
    let result: { ok: boolean; data?: { id: string }; error?: string };
    if (slug === 'blank') {
      result = await createDraft({ name: 'Untitled Agent', department: 'coo' });
    } else {
      result = await createDraftFromTemplate(
        slug as 'coo-daily-report' | 'content-drafter' | 'task-summarizer',
      );
    }
    if (!result.ok) {
      setError(result.error ?? 'Failed to create draft');
      setLoading(null);
      return;
    }
    router.push(`/agentos/agents/new/basic-info?draft=${result.data!.id}`);
  }

  return (
    <div data-testid="template-gallery">
      {error && (
        <p className="text-destructive text-sm mb-4" data-testid="gallery-error">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATE_CARDS.map((card) => (
          <Card
            key={card.slug}
            data-testid={`template-card-${card.slug}`}
            className="flex flex-col"
          >
            <CardHeader className="flex-col items-start gap-1">
              <span className="font-semibold text-[14px]">{card.name}</span>
              {card.department && (
                <span className="text-xs text-muted-foreground">{card.department}</span>
              )}
            </CardHeader>
            <CardBody className="flex flex-col gap-4 flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {card.description}
              </p>
              <Button
                intent={card.slug === 'blank' ? 'primary' : 'secondary'}
                size="sm"
                disabled={loading !== null}
                onClick={() => handleSelect(card.slug)}
              >
                {loading === card.slug ? 'Creating...' : card.slug === 'blank' ? 'Start blank' : 'Use template'}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
