// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { ReanalyzeModal } from '../../src/app/admin/orders/[id]/components/ReanalyzeModal';

afterEach(() => cleanup());

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

describe('ReanalyzeModal', () => {
  it('disables submit until note has 10+ chars', () => {
    render(<ReanalyzeModal open onClose={() => {}} briefId="brief-1" priorRunId="run-1" />);
    const btn = screen.getByRole('button', { name: /^Re-analyze$/ });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), { target: { value: 'short' } });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), { target: { value: 'this note is long enough now' } });
    expect(btn).not.toBeDisabled();
  });

  it('POSTs with re_analyze_same_frameworks trigger', async () => {
    mockFetch.mockResolvedValueOnce({ status: 202, json: async () => ({}) });
    render(<ReanalyzeModal open onClose={() => {}} briefId="brief-1" priorRunId="run-1" />);
    fireEvent.change(screen.getByPlaceholderText(/educational angle/), { target: { value: 'add more urgency to the angles' } });
    fireEvent.click(screen.getByRole('button', { name: /^Re-analyze$/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      brief_id: 'brief-1',
      trigger_type: 're_analyze_same_frameworks',
      prior_run_id: 'run-1',
      founder_note: 'add more urgency to the angles',
    });
  });
});
