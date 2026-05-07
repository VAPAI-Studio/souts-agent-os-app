/**
 * Phase 6 / Plan 06-02 — Task 1 RED scaffold for Agent Edit Tools section.
 *
 * NOTE: Same vitest-not-installed footnote as tools-page.test.tsx. The
 * equivalent live-browser assertions are run via e2e/agent-edit-tools.spec.ts
 * once UI-SPEC Surface 2 lands.
 *
 * Asserted behavior (mirrors UI-SPEC §Surface 2 lines 184-220):
 *   - testid 'tools-section' exists
 *   - testid 'tool-permission-row-mcp__slack__slack_send_message' exists
 *   - testid 'tool-permission-select-mcp__slack__slack_send_message' exists
 *   - For tools in REQUIRES_APPROVAL, the Select hides "Execute autonomously"
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolPermissionsSection } from '@/app/agentos/agents/[id]/edit/_components/ToolPermissionsSection';

describe('agent-edit-tools', () => {
  it('renders tool permission rows with REQUIRES_APPROVAL clamp', () => {
    render(
      <ToolPermissionsSection
        agentId="00000000-0000-0000-0000-000000000001"
        initialPerms={[]}
      />,
    );
    expect(screen.getByTestId('tools-section')).toBeInTheDocument();
    expect(
      screen.getByTestId('tool-permission-row-mcp__slack__slack_send_message'),
    ).toBeInTheDocument();
    const select = screen.getByTestId(
      'tool-permission-select-mcp__slack__slack_send_message',
    ) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // REQUIRES_APPROVAL clamp: execute_autonomously must NOT be a selectable option.
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).not.toContain('execute_autonomously');
  });

  it('allows execute_autonomously for non-REQUIRES_APPROVAL tools', () => {
    render(
      <ToolPermissionsSection
        agentId="00000000-0000-0000-0000-000000000001"
        initialPerms={[]}
      />,
    );
    const readSelect = screen.getByTestId(
      'tool-permission-select-mcp__slack__slack_search_channels',
    ) as HTMLSelectElement;
    const options = Array.from(readSelect.options).map((o) => o.value);
    expect(options).toContain('execute_autonomously');
  });
});
