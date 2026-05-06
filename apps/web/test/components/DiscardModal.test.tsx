// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({ auth: { getSession: mockGetSession } }),
}));
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DiscardModal } from '../../src/app/admin/orders/[id]/components/DiscardModal';

afterEach(() => cleanup());

beforeEach(() => {
  mockFetch.mockReset();
  mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  mockPush.mockReset();
  mockRefresh.mockReset();
});

describe('DiscardModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DiscardModal open={false} onClose={() => {}} orderId="abc" />);
    expect(container.firstChild).toBeNull();
  });

  it('clamps reason input to 500 chars', () => {
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    const ta = screen.getByPlaceholderText(/spam, fake/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'x'.repeat(600) } });
    expect(ta.value.length).toBe(500);
  });

  it('POSTs with reason on confirm and pushes on 200', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.change(screen.getByPlaceholderText(/spam, fake/), { target: { value: 'spam' } });
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/pending-review'));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ order_id: 'abc', reason: 'spam' });
  });

  it('omits reason when empty', async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ order_id: 'abc' });
  });

  it('handles 409 with current_status banner', async () => {
    mockFetch.mockResolvedValueOnce({ status: 409, json: async () => ({ current_status: 'paid' }) });
    render(<DiscardModal open onClose={() => {}} orderId="abc" />);
    fireEvent.click(screen.getByRole('button', { name: /^Discard$/ }));
    await waitFor(() => expect(screen.getByText(/already paid/)).toBeInTheDocument());
  });
});
