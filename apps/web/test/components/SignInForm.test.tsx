// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockSignInWithOtp = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  getSupabaseBrowser: () => ({
    auth: { signInWithOtp: mockSignInWithOtp },
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import { SignInForm } from '../../src/app/admin/SignInForm';

beforeEach(() => {
  mockSignInWithOtp.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SignInForm', () => {
  it('renders idle state with disabled button', () => {
    render(<SignInForm />);
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('enables submit once an email is typed', () => {
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
  });

  it('disables submit when email is cleared after typing', () => {
    render(<SignInForm />);
    const input = screen.getByPlaceholderText(/you@/);
    fireEvent.change(input, { target: { value: 'akinolaakinrimisi@gmail.com' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Send sign-in link/ })).toBeDisabled();
  });

  it('shows the sent state on success', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'akinolaakinrimisi@gmail.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeInTheDocument());
    expect(screen.getByText(/akinolaakinrimisi@gmail\.com/)).toBeInTheDocument();
  });

  it('shows the error state on failure', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Resend down' } });
    render(<SignInForm />);
    fireEvent.change(screen.getByPlaceholderText(/you@/), {
      target: { value: 'x@y.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send sign-in link/ }));
    await waitFor(() => expect(screen.getByText(/Resend down/)).toBeInTheDocument());
  });
});

describe('SignInForm with ?reason=not_authenticated', () => {
  it('renders the reason banner', async () => {
    vi.doMock('next/navigation', () => ({
      useSearchParams: () => new URLSearchParams('reason=not_authenticated'),
    }));
    vi.resetModules();
    const { SignInForm: SignInFormFresh } = await import('../../src/app/admin/SignInForm');
    render(<SignInFormFresh />);
    expect(screen.getByText(/Sign in to access the CRM/)).toBeInTheDocument();
  });
});
