/**
 * Plan 09-04 — CapReachedBanner (Server Component).
 *
 * Renders a red Card-styled banner on the Agent Detail page when the agent is paused
 * due to its monthly budget cap being reached. Pure render, no state.
 *
 * Testid: cap-reached-banner-{agentId}
 */
import { Card, CardBody } from '@/components/ui/Card';

export interface CapReachedBannerProps {
  /** Agent UUID — used for unique testid suffix. */
  agentId: string;
  /** agents.monthly_budget_usd */
  monthlyBudgetUsd: number;
  /** agents.monthly_spent_usd */
  monthlySpentUsd: number;
  /** agents.monthly_period_start — ISO date string or null. */
  monthlyPeriodStart: string | null;
}

export function CapReachedBanner({
  agentId,
  monthlyBudgetUsd,
  monthlySpentUsd,
}: CapReachedBannerProps) {
  return (
    <Card
      data-testid={`cap-reached-banner-${agentId}`}
      className="border-destructive bg-destructive/10"
    >
      <CardBody className="flex items-center gap-md">
        <div className="flex-1">
          <div className="text-[13px] font-medium text-destructive">
            Budget cap reached this month
          </div>
          <div className="text-[12px] text-text-muted">
            ${monthlySpentUsd.toFixed(2)} of ${monthlyBudgetUsd.toFixed(2)} spent.{' '}
            Resumes on the 1st of next month.
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
