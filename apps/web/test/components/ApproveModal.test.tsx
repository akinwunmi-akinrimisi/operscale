// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { ApproveModal } from '../../src/app/admin/orders/[id]/components/ApproveModal';

afterEach(() => cleanup());

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  mockRefresh.mockReset();
});

describe('ApproveModal', () => {
  it('closes + refreshes on 200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    const onClose = vi.fn();
    render(<ApproveModal open onClose={onClose} orderId="abc" customerEmail="x@y.com" />);
    fireEvent.click(screen.getByRole('button', { name: /Approve and send/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows inline error on non-502 failure', async () => {
    mockFetch.mockResolvedValueOnce({ status: 500, json: async () => ({ error: 'db_down' }) });
    render(<ApproveModal open onClose={() => {}} orderId="abc" customerEmail="x@y.com" />);
    fireEvent.click(screen.getByRole('button', { name: /Approve and send/ }));
    await waitFor(() => expect(screen.getByText(/Approval failed/)).toBeInTheDocument());
  });
});
