/**
 * Plan 09-04 — Vitest unit tests for MonthlyBudgetSection.
 *
 * Covers 6 behaviors:
 *   1. initialValue=null renders empty input
 *   2. initialValue=50.5 renders input with value="50.5"
 *   3. Form submit yields FormData with monthly_budget_usd value
 *   4. Clearing the input (empty string) yields FormData with empty monthly_budget_usd (NULL on server)
 *   5. Negative value: input has min=0 attribute (HTML5 validation)
 *   6. step="0.01" attribute present for 2-decimal-place precision
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Import the component under test.
import { MonthlyBudgetSection } from '../app/agentos/agents/[id]/edit/_components/MonthlyBudgetSection';

describe('MonthlyBudgetSection', () => {
  it('Test 1: initialValue=null renders empty input', () => {
    render(
      <form>
        <MonthlyBudgetSection initialValue={null} />
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('Test 2: initialValue=50.5 renders input with value="50.5"', () => {
    render(
      <form>
        <MonthlyBudgetSection initialValue={50.5} />
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input') as HTMLInputElement;
    expect(input.value).toBe('50.5');
  });

  it('Test 3: typing then submitting form yields FormData with monthly_budget_usd value', () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      expect(fd.get('monthly_budget_usd')).toBe('25');
    });
    render(
      <form onSubmit={onSubmit}>
        <MonthlyBudgetSection initialValue={null} />
        <button type="submit">Submit</button>
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('Test 4: clearing the input (empty string) yields FormData with empty monthly_budget_usd', () => {
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      expect(fd.get('monthly_budget_usd')).toBe('');
    });
    render(
      <form onSubmit={onSubmit}>
        <MonthlyBudgetSection initialValue={100} />
        <button type="submit">Submit</button>
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('Test 5: input has min=0 attribute for HTML5 negative-value validation', () => {
    render(
      <form>
        <MonthlyBudgetSection initialValue={null} />
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input') as HTMLInputElement;
    expect(input.min).toBe('0');
  });

  it('Test 6: input has step="0.01" for 2-decimal-place precision', () => {
    render(
      <form>
        <MonthlyBudgetSection initialValue={null} />
      </form>,
    );
    const input = screen.getByTestId('monthly-budget-input') as HTMLInputElement;
    expect(input.step).toBe('0.01');
  });
});
