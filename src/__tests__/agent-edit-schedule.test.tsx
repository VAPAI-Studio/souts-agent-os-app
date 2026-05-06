/**
 * Plan 06-03b — RED test for ScheduleSection.
 *
 * Asserts the testid contract from 06-UI-SPEC §Surface 2 Schedule section:
 *   schedule-enabled, schedule-cron, schedule-timezone, schedule-next-fires, save-schedule-btn.
 *
 * Verifies the next-3-fires preview renders when the cron expression is valid.
 *
 * RED until Task 4 ships ScheduleSection.tsx.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the Server Action — never actually called in this unit test.
vi.mock('../app/agentos/agents/[id]/edit/_actions', () => ({
  saveSchedule: vi.fn().mockResolvedValue({ ok: true }),
}));

// Import the component AFTER vi.mock is set up.
import { ScheduleSection } from '../app/agentos/agents/[id]/edit/_components/ScheduleSection';

describe('ScheduleSection', () => {
  const baseInitial = {
    schedule_cron: '0 9 * * 1-5',
    schedule_timezone: 'America/Mexico_City',
    schedule_enabled: false,
  };

  it('renders all required testid contract elements', () => {
    render(
      <ScheduleSection
        agentId="00000000-0000-0000-0000-000000000001"
        initial={baseInitial}
      />,
    );

    expect(screen.getByTestId('schedule-enabled')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-cron')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-timezone')).toBeInTheDocument();
    expect(screen.getByTestId('save-schedule-btn')).toBeInTheDocument();
  });

  it('renders next-fires preview when cron expression is valid', () => {
    render(
      <ScheduleSection
        agentId="00000000-0000-0000-0000-000000000001"
        initial={baseInitial}
      />,
    );
    // Valid cron + tz → next-fires preview must render.
    expect(screen.getByTestId('schedule-next-fires')).toBeInTheDocument();
    expect(screen.getByText(/Next 3 scheduled fires/i)).toBeInTheDocument();
  });
});
