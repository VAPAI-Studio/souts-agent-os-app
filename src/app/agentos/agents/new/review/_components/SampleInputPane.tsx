'use client';
/**
 * SampleInputPane — free-text textarea + per-department suggestion chips.
 *
 * Renders a textarea for the sample input and 2-3 inline suggestion chips
 * tailored to the agent's department. Clicking a chip fills the textarea.
 *
 * Plan 08-03 / Phase 8 / AGENT-11
 */
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

const DEPARTMENT_SUGGESTIONS: Record<string, string[]> = {
  coo: [
    "Generate today's daily ops report.",
    "Summarize this week's team blockers.",
    'Draft an end-of-quarter status email.',
  ],
  ceo: [
    'Brief me on the top 3 strategic risks this week.',
    "Summarize last month's company-wide KPIs.",
    'Draft a board update.',
  ],
  marketing: [
    'Draft a launch tweet for our new feature X.',
    "Summarize last week's campaign performance.",
    'Write a 3-paragraph blog intro about Y.',
  ],
  sales: [
    'Draft a follow-up email to lead Acme Co.',
    "Summarize this week's pipeline movement.",
    'Prep talking points for next demo.',
  ],
  project: [
    "Summarize this week's tasks across active projects.",
    'List blocked tasks and their owners.',
    'Draft a sprint retro outline.',
  ],
  creative: [
    'Brainstorm 5 visual concepts for campaign Z.',
    'Draft a creative brief for upcoming shoot.',
    'List open creative reviews.',
  ],
  production: [
    "Summarize this week's render queue status.",
    'List assets pending approval.',
    'Draft a hand-off note for engineering.',
  ],
};

export function SampleInputPane({
  department,
  value,
  onChange,
  onRun,
  disabled,
}: {
  department: string;
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  disabled: boolean;
}) {
  const suggestions = DEPARTMENT_SUGGESTIONS[department?.toLowerCase()] ?? [];
  return (
    <Card data-testid="sample-input-pane">
      <CardBody>
        <h3 className="font-medium text-base">Sample input</h3>
        <Textarea
          data-testid="field-sample-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What should the agent do?"
          rows={4}
          className="mt-2"
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2" data-testid="sample-input-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                data-testid={`suggestion-chip-${i}`}
                onClick={() => onChange(s)}
                className="text-xs px-2 py-1 border border-border rounded-md hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button
            data-testid="run-test-btn"
            onClick={onRun}
            disabled={disabled || !value.trim()}
            intent="primary"
            size="sm"
          >
            {disabled ? 'Running…' : 'Run Test'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
