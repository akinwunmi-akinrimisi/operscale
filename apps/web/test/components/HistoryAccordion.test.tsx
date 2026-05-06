// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  HistoryAccordion,
  type HistoryEvent,
} from '../../src/app/admin/orders/[id]/components/HistoryAccordion';

afterEach(() => {
  cleanup();
});

describe('HistoryAccordion', () => {
  it('starts collapsed and shows summary line', () => {
    render(<HistoryAccordion events={[]} submittedAt="2026-05-06T11:55:00Z" />);
    expect(screen.queryByText(/No events yet/)).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click and renders events chronologically', () => {
    const events: HistoryEvent[] = [
      { occurred_at: '2026-05-06T11:55:00Z', event_type: 'form_submitted', payload: null },
      {
        occurred_at: '2026-05-06T11:57:00Z',
        event_type: 'ai_analysis_enqueued',
        payload: null,
      },
    ];
    render(<HistoryAccordion events={events} submittedAt="2026-05-06T11:55:00Z" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('form_submitted')).toBeInTheDocument();
    expect(screen.getByText('ai_analysis_enqueued')).toBeInTheDocument();
  });

  it('summary mentions re-analyze count when > 1 enqueue events present', () => {
    const events: HistoryEvent[] = [
      { occurred_at: '2026-05-06T11:55:00Z', event_type: 'ai_analysis_enqueued', payload: null },
      { occurred_at: '2026-05-06T11:58:00Z', event_type: 'ai_analysis_enqueued', payload: null },
    ];
    render(<HistoryAccordion events={events} submittedAt="2026-05-06T11:55:00Z" />);
    expect(screen.getByText(/Re-analyzed 1/)).toBeInTheDocument();
  });
});
